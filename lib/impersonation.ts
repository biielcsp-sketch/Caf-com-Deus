// Constantes e regra de validade do "Ver como esta pessoa". Sem `server-only`
// de propósito: o proxy.ts também precisa do nome do cookie.

// Id opaco da linha em impersonation_sessions (httpOnly, só o servidor lê).
export const IMPERSONATION_COOKIE = "cafe_imp";
// Nome da pessoa visitada, só para a faixa "Você está vendo como ...".
export const IMPERSONATION_NAME_COOKIE = "cafe_imp_nome";

// Quanto tempo a visita pode durar. Passado isso, "Voltar" não reassume a
// conta do desenvolvedor: é preciso entrar de novo com a própria senha.
export const IMPERSONATION_MAX_AGE_SECONDS = 8 * 60 * 60;

export function impersonationCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - IMPERSONATION_MAX_AGE_SECONDS * 1000);
}

export function isImpersonationExpired(startedAt: string | Date, now: Date = new Date()): boolean {
  return new Date(startedAt).getTime() <= impersonationCutoff(now).getTime();
}
