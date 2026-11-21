"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAccountActiveAction, deleteAccountAction } from "@/app/actions/accounts";
import { Button } from "@/components/ui/Button";

export function AccountDangerZone({
  profileId,
  active,
  isOwnAccount,
}: {
  profileId: string;
  active: boolean;
  isOwnAccount: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // As duas ações DEVOLVEM o erro; exceção de Server Action não atravessa a
  // fronteira servidor→cliente em produção (vira "Minified React error
  // #441"). O catch fica só como rede para falha de rede.
  function handleToggleActive() {
    setError(null);
    startTransition(async () => {
      try {
        const resultado = await setAccountActiveAction(profileId, !active);
        if (resultado?.error) {
          setError(resultado.error);
          return;
        }
        router.refresh();
      } catch {
        setError("Não foi possível salvar. Verifique a conexão e tente de novo.");
      }
    });
  }

  function handleDelete() {
    if (!window.confirm("Excluir esta conta? Essa ação não pode ser desfeita.")) return;
    setError(null);
    startTransition(async () => {
      try {
        const resultado = await deleteAccountAction(profileId);
        if (resultado?.error) setError(resultado.error);
      } catch {
        setError("Não foi possível excluir. Verifique a conexão e tente de novo.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {!isOwnAccount && (
          <Button variant="secondary" disabled={isPending} onClick={handleToggleActive}>
            {isPending ? "Salvando..." : active ? "Desativar conta" : "Reativar conta"}
          </Button>
        )}
        {!isOwnAccount && (
          <Button variant="danger" disabled={isPending} onClick={handleDelete}>
            {isPending ? "Excluindo..." : "Excluir conta"}
          </Button>
        )}
      </div>
      {isOwnAccount && (
        <p className="text-sm text-muted-foreground">
          Não é possível desativar ou excluir a própria conta por aqui.
        </p>
      )}
    </div>
  );
}
