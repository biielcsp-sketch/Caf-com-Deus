import "server-only";
import { z } from "zod";

// S7 (validação de variáveis de ambiente no boot): se alguma variável
// obrigatória estiver ausente ou em formato errado, a aplicação falha ao
// subir com uma mensagem clara — nunca sobe "quebrada pela metade" com uma
// feature de segurança silenciosamente desativada por falta de
// configuração. `instrumentation.ts` importa este módulo assim que o
// processo do servidor inicia, forçando o parse abaixo a rodar antes de
// qualquer requisição ser atendida (não só quando a rota que usa a
// variável for chamada pela primeira vez).
// Revisão v41 — diagnóstico do erro "Forbidden use of secret API key in
// browser" na tela de trocar senha: a chave que o navegador usa não era a
// pública. A checagem que já existia aqui só olhava o prefixo
// `sb_secret_` e a igualdade entre as duas variáveis — as chaves no formato
// legado (JWT, começam com "eyJ") passavam pelas duas mesmo sendo a chave de
// service_role, porque o prefixo é o mesmo da anon e o valor era diferente
// do que estava em SUPABASE_SERVICE_ROLE_KEY (basta ter rotacionado a chave
// depois de colar a antiga no lugar errado). O papel está escrito dentro do
// próprio token: é ele que decidimos ler.
function jwtRole(key: string): string | null {
  const parts = key.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload: unknown = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const role = (payload as { role?: unknown } | null)?.role;
    return typeof role === "string" ? role : null;
  } catch {
    return null;
  }
}

const ServerEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ error: "precisa ser uma URL válida (ex.: https://xxxx.supabase.co)" }),
  // Esta vai inteira para o JavaScript do navegador (todo NEXT_PUBLIC_ vai).
  // Por isso só pode ser a chave pública: `sb_publishable_...` ou a anon
  // legada (um JWT, que começa com "eyJ"). Já aconteceu de a chave secreta
  // ser colada aqui por engano — e uma chave `sb_secret_` publicada assim
  // ignora toda a RLS para quem abrir o código-fonte da página. Agora a
  // aplicação se recusa a subir nesse estado em vez de servir o buraco.
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, { error: "não pode ficar vazia" })
    .refine((v) => !v.startsWith("sb_secret_"), {
      error:
        "está com a chave SECRETA (sb_secret_...), que vai parar no navegador de quem abrir o site. " +
        "Use a publishable (sb_publishable_...), em Supabase → Project Settings → API Keys",
    })
    .refine((v) => jwtRole(v) === null || jwtRole(v) === "anon", {
      error:
        'está com uma chave cujo papel interno é "service_role", não "anon" — ela ignora toda a RLS e ' +
        "vai inteira para o navegador. O Supabase recusa essa chave no navegador com a mensagem " +
        '"Forbidden use of secret API key in browser", que é como isso aparece na tela de senha. ' +
        "Use a chave anon/publishable, em Supabase → Project Settings → API Keys",
    }),
  // Chave mestra — ignora RLS. Nunca prefixar com NEXT_PUBLIC_, nunca
  // importar este módulo de um Client Component (o "server-only" acima já
  // impede isso na build).
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, { error: "não pode ficar vazia" })
    .refine((v) => !v.startsWith("sb_publishable_"), {
      error:
        "está com a chave PÚBLICA (sb_publishable_...). Quem precisa dela aqui é o que roda no " +
        "servidor e depende de ignorar a RLS (convite de líder, autocadastro) — com a pública, " +
        "essas ações falham em runtime, não na build",
    })
    .refine((v) => jwtRole(v) === null || jwtRole(v) === "service_role", {
      error:
        'está com uma chave cujo papel interno não é "service_role". As ações administrativas do ' +
        "servidor dependem dela para ignorar a RLS e vão falhar sem aviso",
    }),
});

function loadServerEnv() {
  const result = ServerEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!result.success) {
    const details = result.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(
      `Configuração de ambiente inválida — corrija .env.local (ou as variáveis do Netlify) antes de subir a aplicação:\n${details}`,
    );
  }

  // A mesma checagem por outro ângulo: mesmo que um dia a secreta mude de
  // prefixo, ela nunca pode ser igual à chave que vai para o navegador.
  if (
    result.data.NEXT_PUBLIC_SUPABASE_ANON_KEY === result.data.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error(
      "Configuração de ambiente inválida — NEXT_PUBLIC_SUPABASE_ANON_KEY está com o mesmo " +
        "valor de SUPABASE_SERVICE_ROLE_KEY. A primeira é publicada no navegador; a segunda " +
        "ignora toda a RLS. Troque a NEXT_PUBLIC_ pela chave publishable.",
    );
  }

  return result.data;
}

export const serverEnv = loadServerEnv();
