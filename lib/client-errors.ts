// Tradução de erro para telas que rodam no navegador.
//
// Separado de `lib/errors.ts` de propósito: aquele é `server-only` e não pode
// ser importado de um Client Component.

// O Next.js gera um identificador novo para cada Server Action a cada build.
// Quem estava com a página aberta quando um deploy sai continua pedindo o
// identificador antigo, que já não existe no servidor — e o erro que aparece
// é "Server Action ... was not found on the server", em inglês e sem dizer o
// que fazer. Não é defeito do app: é a página estar velha.
//
// Isso importa aqui mais do que num site comum porque o Café com Deus Shine é
// um PWA — as líderes deixam ele aberto no celular por dias.
export function erroDeVersaoAntiga(e: unknown): boolean {
  const mensagem = e instanceof Error ? e.message : String(e);
  return /Server Action .*(was not found|not found on the server)|Failed to find Server Action/i.test(
    mensagem,
  );
}

export const MENSAGEM_VERSAO_ANTIGA =
  "O aplicativo foi atualizado enquanto esta página estava aberta. Recarregue para continuar.";

export function mensagemDeErro(e: unknown, padrao = "Não foi possível concluir."): string {
  if (erroDeVersaoAntiga(e)) return MENSAGEM_VERSAO_ANTIGA;
  const mensagem = e instanceof Error ? e.message : "";
  return mensagem || padrao;
}
