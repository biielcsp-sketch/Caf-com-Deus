import "server-only";

/**
 * Erro cuja `message` já é redigida para a usuária final (validação de
 * regra de negócio, ex.: "e-mail já cadastrado"). Nunca lance uma AppError
 * a partir de `error.message` do Supabase/Postgres — isso reintroduziria o
 * vazamento que este arquivo existe para evitar.
 */
export class AppError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AppError";
  }
}

/**
 * Ponto único por onde todo erro vindo de uma chamada ao Supabase/Postgres
 * deve passar. Loga o erro real e completo no servidor (nunca escondido de
 * quem desenvolve, só de quem usa a tela) e lança uma AppError com mensagem
 * genérica seguro para a UI — detalhe de constraint, coluna ou query nunca
 * chega ao client.
 */
export function dbError(
  error: unknown,
  context: string,
  fallback = "Não foi possível completar a operação. Tente novamente.",
): never {
  console.error("[db:%s]", context, error);
  // Revisão v41 (item 2.9): o erro original vai junto em `cause`. Sem isso,
  // `isRlsDenied()` (auth-audit.service.ts) nunca casava com nada: ele
  // procura o texto do erro 42501 do Postgres, mas quem chegava até ele era
  // sempre esta AppError de mensagem genérica — ou seja, os quatro pontos do
  // app que deveriam gravar `access_denied` no auth_audit_log nunca
  // gravavam. `cause` fica só no servidor: a Server Action converte a
  // exceção por `toUserMessage()`, que devolve string, então nada disso
  // chega ao navegador.
  throw new AppError(fallback, { cause: error });
}

/**
 * Usado pelas Server Actions ao converter uma exceção de service em
 * mensagem de UI: preserva a mensagem só quando é uma AppError (deliberada
 * e já segura); qualquer outra coisa é um erro não classificado — loga o
 * real no servidor e devolve mensagem genérica, nunca repassa `e.message`
 * cru.
 */
export function toUserMessage(
  e: unknown,
  context: string,
  fallback = "Ocorreu um erro. Tente novamente.",
): string {
  if (e instanceof AppError) return e.message;
  console.error("[action:%s]", context, e);
  return fallback;
}

/**
 * Texto completo do erro, descendo a cadeia de `cause`, para MOSTRAR À ADMIN
 * numa tela de diagnóstico — nunca para usuária comum.
 *
 * Existe porque `dbError()` troca a mensagem real por uma genérica (é o que
 * impede detalhe de query de vazar para quem usa o sistema) e guarda a
 * original em `cause`. Quando quem está olhando é quem cuida do sistema, a
 * mensagem genérica não ajuda em nada — é justamente o texto do Postgres/
 * PostgREST que diz o que fazer.
 */
export function detalhesDoErro(e: unknown, padrao = "Falha não identificada."): string {
  const partes: string[] = [];
  let atual: unknown = e;

  for (let i = 0; atual != null && i < 5; i += 1) {
    if (atual instanceof Error) {
      if (atual.message) partes.push(atual.message);
      atual = atual.cause;
    } else if (typeof atual === "object" && "message" in atual) {
      partes.push(String((atual as { message: unknown }).message));
      atual = null;
    } else {
      partes.push(String(atual));
      atual = null;
    }
  }

  return partes.join(" — ") || padrao;
}
