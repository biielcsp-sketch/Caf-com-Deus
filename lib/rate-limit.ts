import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// S4 (rate limiting): sem Upstash (exigiria criar conta de terceiro sem
// aprovação prévia) e sem Map em memória (não sobrevive a múltiplas
// instâncias serverless) — os limites reais ficam fixos em funções
// SECURITY DEFINER no Postgres (ver migration s4_rate_limiting.sql), que já
// é compartilhado entre todas as instâncias por natureza. Aqui só chamamos
// a função certa por chave.
//
// Revisão v41 (item 2.1): usa o client `service_role`, não o da sessão. As
// funções abaixo tinham EXECUTE para `anon`, e como a chave anon é pública
// qualquer pessoa podia chamar `app_check_login_rate_limit('email-alheio')`
// dez vezes e trancar o login daquela pessoa — em loop, para sempre. O
// EXECUTE agora é só de service_role (migration
// 20260911140000_hardening_rpc_grants_and_atomic_distribution.sql), o que
// obriga a chamada a vir daqui, do servidor. Nenhum uso de service_role
// aqui toca dado de negócio: as cinco funções só leem e escrevem
// `rate_limit_events`, tabela sem policy que ninguém mais acessa.
type RateLimitRpc =
  | "app_check_login_rate_limit"
  | "app_check_claim_account_rate_limit"
  | "app_check_participant_write_rate_limit"
  | "app_check_public_enrollment_rate_limit";

async function hit(rpc: RateLimitRpc, key: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc(rpc, { p_key: key });

  if (error) {
    // Uma falha no rate limiter (ex.: instabilidade momentânea do banco)
    // nunca pode travar uma ação legítima — loga e libera (fail-open).
    console.error("[rate-limit] %s falhou, liberando por padrão:", rpc, error.message);
    return true;
  }

  return data === true;
}

export function checkLoginRateLimit(email: string) {
  return hit("app_check_login_rate_limit", email.trim().toLowerCase());
}

export function checkClaimAccountRateLimit(email: string) {
  return hit("app_check_claim_account_rate_limit", email.trim().toLowerCase());
}

export function checkParticipantWriteRateLimit(userId: string) {
  return hit("app_check_participant_write_rate_limit", userId);
}

// Q1 (cadastro público via QR Code): por IP, não por usuária — quem
// preenche o formulário público ainda não tem sessão nem e-mail conhecido
// até o submit terminar.
export function checkPublicEnrollmentRateLimit(ip: string) {
  return hit("app_check_public_enrollment_rate_limit", ip);
}
