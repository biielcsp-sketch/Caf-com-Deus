"use client";

import { INACTIVE_REASONS, INACTIVE_REASON_LABELS } from "@/lib/inactive-reasons";
import Link from "next/link";
import { useActionState } from "react";
import {
  updateParticipantAdminAction,
  changeParticipantStatusAction,
  type FormActionState,
} from "@/app/actions/participants";
import { Button } from "@/components/ui/Button";
import type { ParticipantRow } from "@/lib/services/participants.service";
import type { Enums } from "@/types/database.types";

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary";
const labelClass = "text-sm font-medium text-foreground";

const STATUS_OPTIONS: { value: Enums<"participant_status">; label: string }[] = [
  { value: "nova_inscricao", label: "Nova inscrição" },
  { value: "aguardando_distribuicao", label: "Aguardando distribuição" },
  { value: "distribuida", label: "Distribuída" },
  { value: "ativa", label: "Ativa" },
  { value: "acompanhamento", label: "Acompanhamento" },
  { value: "inativa", label: "Inativa" },
];

export function AdminPanel({ participant }: { participant: ParticipantRow }) {
  const adminAction = updateParticipantAdminAction.bind(null, participant.id);
  const [adminState, adminFormAction, adminPending] = useActionState<FormActionState, FormData>(
    adminAction,
    undefined,
  );

  // Estes dois formulários eram `<form action={...}>` puros, com actions que
  // LANÇAVAM: qualquer recusa (RLS, regra de negócio) derrubava a ficha
  // inteira da participante e virava a tela de erro do Next.
  const [statusState, statusFormAction, statusPending] = useActionState<FormActionState, FormData>(
    changeParticipantStatusAction.bind(null, participant.id),
    undefined,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-3 text-sm font-semibold text-foreground">Status da jornada</p>
        <form action={statusFormAction} className="flex flex-col gap-3">
          <select name="status" defaultValue={participant.status} className={inputClass}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select name="inactive_reason" defaultValue={participant.inactive_reason ?? ""} className={inputClass}>
            <option value="">Motivo (obrigatório se Inativa)</option>
            {INACTIVE_REASONS.map((r) => (
              <option key={r} value={r}>
                {INACTIVE_REASON_LABELS[r]}
              </option>
            ))}
          </select>
          <input name="note" placeholder="Observação (opcional)" className={inputClass} />
          <label className="text-xs text-muted-foreground">
            Quando aconteceu (deixe vazio se foi hoje)
            <input name="effective_date" type="date" className={`${inputClass} mt-1`} />
          </label>
          {statusState?.error && <p className="text-sm text-danger">{statusState.error}</p>}
          {statusState?.success && <p className="text-sm text-primary">Status atualizado.</p>}
          <Button type="submit" disabled={statusPending} variant="secondary" className="self-start">
            {statusPending ? "Salvando..." : "Atualizar status"}
          </Button>
        </form>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-3 text-sm font-semibold text-foreground">Líder responsável</p>
        <p className="text-sm text-muted-foreground">
          {participant.current_leader_id
            ? "Para trocar de líder, use a Redistribuição."
            : "Esta participante ainda não tem líder atribuída."}
        </p>
        <Link
          href={
            participant.current_leader_id
              ? `/gestao-membros/redistribuicao?search=${encodeURIComponent(participant.full_name)}`
              : "/gestao-membros/novas-inscricoes"
          }
          className="btn btn-primary mt-3"
        >
          {participant.current_leader_id ? "Ir para Redistribuição" : "Distribuir agora"}
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-3 text-sm font-semibold text-foreground">Campos administrativos</p>
        <form action={adminFormAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="enrollment_source">
              Origem da inscrição
            </label>
            <input
              id="enrollment_source"
              name="enrollment_source"
              defaultValue={participant.enrollment_source ?? ""}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="admin_notes">
              Observações administrativas
            </label>
            <textarea
              id="admin_notes"
              name="admin_notes"
              rows={3}
              defaultValue={participant.admin_notes ?? ""}
              className={inputClass}
            />
          </div>
          {adminState?.error && <p className="text-sm text-danger">{adminState.error}</p>}
          {adminState?.success && <p className="text-sm text-primary">Salvo.</p>}
          <Button type="submit" disabled={adminPending} variant="secondary" className="self-start">
            Salvar
          </Button>
        </form>
      </div>
    </div>
  );
}
