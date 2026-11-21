"use client";

import { useActionState } from "react";
import { createParticipantAsLeaderAction, type FormActionState } from "@/app/actions/participants";
import { PersonalFields } from "@/components/participantes/participant-fields";
import { Button } from "@/components/ui/Button";

// Cadastro da participante pela própria líder. Usa os mesmos campos
// pessoais do cadastro da pastora, sem os campos administrativos (origem
// da inscrição, observações da administração, escolha da líder): quem
// cadastra já é a líder responsável, e o vínculo é resolvido no servidor
// pela sessão.
export function LeaderParticipantCreateForm({ groupName }: { groupName: string | null }) {
  const [state, action, pending] = useActionState<FormActionState, FormData>(
    createParticipantAsLeaderAction,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
        Ela entra direto na sua lista
        {groupName ? (
          <>
            {" "}e no café <span className="font-medium text-foreground">{groupName}</span>
          </>
        ) : null}
        , sem passar pela distribuição. Só o nome é obrigatório — o resto você completa depois,
        conforme for conhecendo.
      </p>

      <PersonalFields />

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Salvando..." : "Cadastrar participante"}
      </Button>
    </form>
  );
}
