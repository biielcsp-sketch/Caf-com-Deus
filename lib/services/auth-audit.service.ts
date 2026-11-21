import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums, Json } from "@/types/database.types";

async function requestMeta() {
  const h = await headers();
  return {
    ip: h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for") ?? null,
    userAgent: h.get("user-agent"),
  };
}

// S5: log de eventos de autenticação/acesso negado, separado do audit_log
// (que cobre mutação de dado de negócio). Nunca deixamos uma falha aqui
// travar o fluxo do usuário — só logamos o erro e seguimos, mesma regra do
// prompt para não transformar auditoria em ponto único de falha.
//
// Revisão v41 (item 2.2): o client é o `service_role`, não o da sessão.
// `app_log_auth_event` é SECURITY DEFINER e aceita profile_id e tipo de
// evento do chamador; com EXECUTE aberto para `anon` (chave pública),
// qualquer pessoa podia inserir um `login_success` forjado no nome de
// qualquer perfil e esvaziar o valor deste log. O EXECUTE agora é só de
// service_role, então a chamada tem que partir daqui — e o evento
// `login_failed` continua sendo gravável antes de existir sessão, que é o
// caso que motivou a função a ser chamável por `anon` em primeiro lugar.
export async function logAuthEvent(
  event: Enums<"auth_audit_event">,
  profileId: string | null,
  metadata?: Json,
) {
  try {
    const { ip, userAgent } = await requestMeta();
    const supabase = createAdminClient();
    // Os tipos gerados marcam p_profile_id/p_ip_address/p_user_agent como
    // `string` (não `string | null`) porque o gerador do Supabase não
    // introspecciona nulabilidade de parâmetro escalar — a função aceita
    // NULL normalmente em runtime (nenhum é NOT NULL na assinatura SQL).
    await supabase.rpc("app_log_auth_event", {
      p_profile_id: profileId,
      p_event: event,
      p_ip_address: ip,
      p_user_agent: userAgent,
      p_metadata: metadata ?? null,
    } as unknown as Parameters<typeof supabase.rpc<"app_log_auth_event">>[1]);
  } catch (e) {
    console.error(`[auth-audit] falha ao registrar evento "${event}":`, e);
  }
}

// Uma violação de RLS em INSERT/UPDATE chega do Postgres como erro 42501
// ("new row violates row-level security policy" / "permission denied for
// table ..."). Uma leitura bloqueada por RLS não gera erro nenhum — a
// policy de SELECT simplesmente filtra a linha, então não tem como
// distinguir "não existe" de "está escondida por RLS" nesse caminho (é
// assim que RLS de SELECT é desenhado, de propósito, para evitar
// enumeração). Por isso só capturamos acesso negado em escrita.
//
// Revisão v41 (item 2.9): esta função olhava só a `message` do erro que
// chega na Server Action — e essa mensagem é sempre a genérica da AppError
// criada por `dbError()`, nunca o texto do Postgres. Resultado: os quatro
// pontos do app que chamam isto nunca registravam `access_denied`. Agora
// `dbError()` preserva o erro original em `cause`, e a varredura desce a
// cadeia de causas até achar (ou não) a assinatura do 42501.
//
// Continuamos casando por texto, e não por `.code`: o erro do PostgREST
// chega como objeto simples, e o formato do `.code` varia entre o cliente
// JS e o driver — o texto do 42501 é estável nos dois.
export function isRlsDenied(error: unknown): boolean {
  const pattern = /row-level security policy|permission denied for table/i;
  let current: unknown = error;

  for (let depth = 0; current != null && depth < 5; depth += 1) {
    const message =
      current instanceof Error
        ? current.message
        : typeof current === "object" && "message" in current
          ? String((current as { message: unknown }).message)
          : String(current);
    if (pattern.test(message)) return true;
    current = current instanceof Error ? current.cause : null;
  }

  return false;
}
