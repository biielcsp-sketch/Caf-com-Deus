"use client";

import { deleteGroupAction } from "@/app/actions/groups";
import { DeleteButton } from "@/components/admin/delete-button";

export function GroupDeleteButton({
  id,
  nome,
  redirectTo,
  compact,
}: {
  id: string;
  nome: string;
  redirectTo?: string;
  compact?: boolean;
}) {
  return (
    <DeleteButton
      compact={compact}
      redirectTo={redirectTo}
      confirmacao={
        `Excluir o grupo ${nome}?\n\n` +
        "Só funciona se ele não tiver participantes, encontros, fotos no mural ou " +
        'histórico de vínculo — se tiver, o caminho é marcar o grupo como "Inativo".' +
        "\n\nEssa ação não pode ser desfeita."
      }
      onDelete={() => deleteGroupAction(id)}
    />
  );
}
