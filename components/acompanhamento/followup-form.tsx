"use client";

import { useActionState } from "react";
import { createFollowUpAction, updateFollowUpAction } from "@/app/actions/followups";
import type { FollowUpRow } from "@/lib/services/followup.service";
import type { FormActionState } from "@/app/actions/participants";
import { FOLLOW_UP_TYPES, FOLLOW_UP_TYPE_LABELS } from "@/lib/validators/followup.schema";
import { Button } from "@/components/ui/Button";

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary";
const labelClass = "text-sm font-medium text-foreground";

// Sem `followUp`: registra um novo. Com `followUp`: edita aquele registro
// (só pastora, Gestora de Pessoas e desenvolvedor chegam a este modo).
export function FollowUpForm({
  participantId,
  basePath,
  followUp,
}: {
  participantId: string;
  basePath: string;
  followUp?: FollowUpRow;
}) {
  const action = followUp
    ? updateFollowUpAction.bind(null, followUp.id, basePath, participantId)
    : createFollowUpAction.bind(null, participantId, basePath);
  const [state, formAction, pending] = useActionState<FormActionState, FormData>(action, undefined);
  const p = followUp ? `${followUp.id}-` : "";

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor={`${p}date`}>Data</label>
        <input id={`${p}date`} name="date" type="date" required defaultValue={followUp?.date ?? new Date().toISOString().slice(0, 10)} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor={`${p}type`}>Tipo</label>
        <select id={`${p}type`} name="type" required defaultValue={followUp?.type} className={inputClass}>
          {FOLLOW_UP_TYPES.map((t) => (
            <option key={t} value={t}>{FOLLOW_UP_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor={`${p}status`}>Status</label>
        <select id={`${p}status`} name="status" defaultValue={followUp?.status ?? "normal"} className={inputClass}>
          <option value="normal">Normal</option>
          <option value="atencao">Atenção</option>
          <option value="acompanhamento_necessario">Acompanhamento necessário</option>
        </select>
        <p className="text-xs text-muted-foreground">
          <b>Normal</b> para o contato do dia a dia. <b>Atenção</b> quando algo te preocupou.{" "}
          <b>Acompanhamento necessário</b> só em caso grave ou urgente, que precisa de cuidado
          próximo da liderança ou da pastoral.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor={`${p}next_follow_up_date`}>Próximo acompanhamento</label>
        <input id={`${p}next_follow_up_date`} name="next_follow_up_date" type="date" defaultValue={followUp?.next_follow_up_date ?? ""} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label className={labelClass} htmlFor={`${p}observation`}>Observação</label>
        <textarea id={`${p}observation`} name="observation" rows={3} defaultValue={followUp?.observation ?? ""} className={inputClass} />
      </div>
      <div className="flex items-center pb-1">
        <label className="flex items-center gap-1.5 text-sm text-foreground">
          <input type="checkbox" name="needs_return" defaultChecked={followUp?.needs_return ?? false} />
          Precisa de retorno
        </label>
      </div>
      {state?.error && <p className="text-sm text-danger sm:col-span-2">{state.error}</p>}
      {state?.success && (
        <p className="text-sm text-primary sm:col-span-2">{followUp ? "Alterações salvas." : "Registrado."}</p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Salvando..." : followUp ? "Salvar alterações" : "Registrar acompanhamento"}
      </Button>
    </form>
  );
}
