"use client";

import { deleteLeaderAction } from "@/app/actions/leaders";
import { DeleteButton } from "@/components/admin/delete-button";

export function LeaderDeleteButton({
  id,
  nome,
  cafes = [],
  redirectTo,
  compact,
}: {
  id: string;
  nome: string;
  // Cafés que ela lidera hoje. Eles não impedem a exclusão — ficam sem
  // responsável — mas a pastora precisa saber disso ANTES de confirmar, não
  // descobrir depois olhando a lista de cafés.
  cafes?: string[];
  redirectTo?: string;
  compact?: boolean;
}) {
  const avisoCafes =
    cafes.length > 0
      ? `ATENÇÃO: ela é a líder ${cafes.length === 1 ? "do café" : "dos cafés"} ` +
        `${cafes.join(", ")}. ${cafes.length === 1 ? "Esse café fica" : "Esses cafés ficam"} ` +
        "sem líder responsável até você atribuir outra. As participantes, os encontros " +
        `e as fotos ${cafes.length === 1 ? "dele" : "deles"} continuam lá.\n\n`
      : "";

  return (
    <DeleteButton
      compact={compact}
      redirectTo={redirectTo}
      confirmacao={
        `Excluir a líder ${nome}?\n\n` +
        avisoCafes +
        "O cadastro e o acesso dela ao sistema são apagados. Só não funciona se ela " +
        "tiver participantes, encontros ou acompanhamentos no histórico — nesse caso o " +
        'caminho é "Inativar líder".\n\nEssa ação não pode ser desfeita.'
      }
      onDelete={() => deleteLeaderAction(id)}
    />
  );
}
