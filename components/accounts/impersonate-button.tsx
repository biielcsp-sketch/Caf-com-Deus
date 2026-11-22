"use client";

import { useState, useTransition } from "react";
import { startImpersonationAction } from "@/app/actions/impersonation";
import { Button } from "@/components/ui/Button";

export function ImpersonateButton({ profileId, name }: { profileId: string; name: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (
      !window.confirm(
        `Ver o sistema como ${name}? Você vai navegar com a conta dessa pessoa, e o que fizer vale como se fosse ela, até clicar em "Voltar".`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        // Em sucesso a ação redireciona e esta chamada nunca devolve; só volta
        // aqui quando houve erro.
        const resultado = await startImpersonationAction(profileId);
        if (resultado?.error) setError(resultado.error);
      } catch {
        setError("Não foi possível entrar. Verifique a conexão e tente de novo.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-danger">{error}</p>}
      <div>
        <Button variant="secondary" disabled={isPending} onClick={handleClick}>
          {isPending ? "Entrando..." : "Ver como esta pessoa"}
        </Button>
      </div>
    </div>
  );
}
