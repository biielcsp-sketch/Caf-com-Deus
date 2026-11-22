"use client";

import { useEffect } from "react";

// Rede de segurança: o projeto não tinha NENHUM error boundary, então
// qualquer exceção que escapasse caía na tela de erro crua do Next
// ("Application error: a server-side exception has occurred"), sem
// explicação e sem caminho de volta. As Server Actions agora devolvem
// `{ error }` em vez de lançar — isto aqui é para o que ainda assim escapar.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[erro nao tratado]", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-3 p-6">
      <h1 className="text-xl font-semibold text-foreground">Algo deu errado por aqui</h1>
      <p className="text-sm text-muted-foreground">
        Não conseguimos carregar esta tela. Você pode tentar de novo — se continuar
        acontecendo, avise a equipe informando o código abaixo.
      </p>
      {error.digest && (
        <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
          {error.digest}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="btn btn-primary"
        >
          Tentar de novo
        </button>
        <a
          href="/inicio"
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground"
        >
          Voltar ao início
        </a>
      </div>
    </div>
  );
}
