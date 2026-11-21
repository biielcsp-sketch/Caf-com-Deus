import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

// S3 (headers de segurança): @supabase/ssr usa sameSite "lax" por padrão
// (adequado) mas não seta "secure" — setamos explícito para produção.
// "httpOnly" fica de propósito como false: é o próprio @supabase/ssr que
// exige leitura via document.cookie no client para gerenciar a sessão —
// setar httpOnly quebraria o login, não é uma opção de hardening viável
// aqui (a sessão em si é um JWT de curta duração, renovado pelo proxy.ts).
// Diagnóstico de 11/09/2026 — a tela de trocar senha mostrava
// "Forbidden use of secret API key in browser", em inglês e sem contexto.
// A variável no Netlify estava certa; o que estava errado era o JAVASCRIPT
// publicado: `NEXT_PUBLIC_*` é colada dentro do bundle na hora da BUILD, e o
// deploy no ar tinha sido feito 32 minutos ANTES de a variável ser corrigida.
// O servidor lê a variável em tempo de execução, então lá já estava certo —
// só o navegador continuava com a chave antiga. Trocar a variável no painel
// não conserta isso: só um deploy novo.
//
// `lib/env.ts` não pega esse caso e não tem como pegar: ele roda no servidor,
// onde o valor já é o novo. O que dá para fazer é o navegador falhar
// explicando, em vez de repassar a mensagem críptica do Supabase.
function assertChavePublica(key: string) {
  const ehSecreta =
    key.startsWith("sb_secret_") ||
    (key.split(".").length === 3 &&
      (() => {
        try {
          return JSON.parse(atob(key.split(".")[1]))?.role === "service_role";
        } catch {
          return false;
        }
      })());

  if (ehSecreta) {
    throw new Error(
      "O site foi publicado com a chave secreta do Supabase no lugar da chave pública. " +
        "Corrija NEXT_PUBLIC_SUPABASE_ANON_KEY nas variáveis do Netlify e REFAÇA O DEPLOY — " +
        "trocar a variável sozinha não resolve, porque essa chave fica colada no JavaScript " +
        "na hora da build. Depois, rotacione a chave secreta no Supabase: ela esteve pública.",
    );
  }
  return key;
}

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    assertChavePublica(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    {
      cookieOptions: {
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    },
  );
}
