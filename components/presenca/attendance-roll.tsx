"use client";

import { useActionState, useState } from "react";
import { VisitorBadge } from "@/components/participantes/visitor-badge";
import { markAttendanceAction } from "@/app/actions/attendance";
import type { FormActionState } from "@/app/actions/participants";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "nao_informado", label: "Não informado" },
  { value: "presente", label: "Presente" },
  { value: "ausente", label: "Ausente" },
  { value: "justificou", label: "Justificou" },
];

const STATUS_BADGE: Record<string, string> = {
  presente: "bg-primary/15 text-primary",
  ausente: "bg-danger/15 text-danger",
  justificou: "bg-accent/30 text-foreground",
  nao_informado: "bg-muted text-muted-foreground",
};

type Row = {
  meetingParticipantId: string;
  participantId: string;
  fullName: string;
  isVisitor?: boolean;
  status: string;
  notes: string;
};

// Uma linha por participante, cada uma com seu próprio estado. Antes era um
// `<form action={...}>` puro: se o registro falhasse (RLS, encontro de outra
// líder), a exceção subia e a lista de presença INTEIRA virava tela de erro.
// Agora a falha fica na linha de quem falhou e a chamada continua.
function AttendanceRow({
  row,
  meetingId,
  basePath,
}: {
  row: Row;
  meetingId: string;
  basePath: string;
}) {
  const action = markAttendanceAction.bind(null, meetingId, row.participantId, basePath);
  const [state, formAction, pending] = useActionState<FormActionState, FormData>(action, undefined);
  // Campos CONTROLADOS de propósito. Com `defaultValue`, o React 19 reseta o
  // formulário ao fim da action e o seletor voltava para o valor inicial
  // ("Não informado"), enquanto o selo ao lado do nome já mostrava o status
  // gravado — parecia que não tinha salvo. Controlado, o campo mantém o que a
  // líder escolheu.
  const [status, setStatus] = useState(row.status);
  const [notes, setNotes] = useState(row.notes);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium text-foreground">{row.fullName}</span>
        {row.isVisitor && <VisitorBadge className="shrink-0" />}
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[row.status]}`}>
          {STATUS_OPTIONS.find((o) => o.value === row.status)?.label}
        </span>
        {state?.error && <span className="text-xs text-danger">{state.error}</span>}
      </div>
      <div className="flex gap-2">
        <select
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          name="notes"
          placeholder="Nota (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-40 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary"
        >
          {pending ? "..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}

export function AttendanceRoll({
  meetingId,
  basePath,
  rows,
}: {
  meetingId: string;
  basePath: string;
  rows: Row[];
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Nenhuma participante vinculada a este encontro.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <AttendanceRow key={row.meetingParticipantId} row={row} meetingId={meetingId} basePath={basePath} />
      ))}
    </div>
  );
}
