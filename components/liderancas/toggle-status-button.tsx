"use client";

import { useState, useTransition } from "react";
import { toggleLeaderStatusAction } from "@/app/actions/leaders";
import { Button } from "@/components/ui/Button";

export function ToggleStatusButton({ id, status }: { id: string; status: "ativa" | "inativa" }) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button
        variant={status === "ativa" ? "danger" : "secondary"}
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setErro(null);
            // A action devolve `{ error }` em vez de lançar — antes a falha
            // não aparecia em lugar nenhum: o botão voltava ao normal e nada
            // tinha acontecido.
            const resultado = await toggleLeaderStatusAction(id, status);
            if (resultado?.error) setErro(resultado.error);
          })
        }
      >
        {isPending ? "Salvando..." : status === "ativa" ? "Inativar líder" : "Reativar líder"}
      </Button>
      {erro && <p className="text-sm text-danger">{erro}</p>}
    </div>
  );
}
