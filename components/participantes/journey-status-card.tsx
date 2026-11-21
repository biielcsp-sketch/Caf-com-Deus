"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { PARTICIPANT_STATUS_LABELS } from "@/lib/participant-status-labels";
import {
  ACOMPANHAMENTO_NAO_USE_PARA,
  ACOMPANHAMENTO_O_QUE_ACONTECE,
  ACOMPANHAMENTO_O_QUE_E,
} from "@/lib/acompanhamento-copy";
import { changeMyParticipantStatusAction } from "@/app/actions/participants";
import { Button } from "@/components/ui/Button";
import type { Enums } from "@/types/database.types";
import { INACTIVE_REASONS, INACTIVE_REASON_LABELS, type InactiveReason } from "@/lib/inactive-reasons";

type Status = Enums<"participant_status">;

// O que a líder escolhe aqui (ver LEADER_SETTABLE_STATUSES na action).
const OPTIONS: Status[] = ["ativa", "acompanhamento", "inativa"];

export function JourneyStatusCard({
  participantId,
  currentStatus,
  currentInactiveReason,
}: {
  participantId: string;
  currentStatus: Status;
  currentInactiveReason?: string | null;
}) {
  // Inativa pede o motivo (o "regularidade" do PPT): um campo só, junto da
  // situação, para as duas coisas nunca se contradizerem.
  const [escolhendoMotivo, setEscolhendoMotivo] = useState(false);
  const [motivo, setMotivo] = useState<InactiveReason | "">("");
  const [note, setNote] = useState("");
  // Data real da mudança, para lançar depois do fato. Vazio = hoje.
  const [effectiveDate, setEffectiveDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<Status | null>(null);
  const [pending, startTransition] = useTransition();
  // Colocar alguém em acompanhamento passa a pedir confirmação: é o que puxa a
  // participante para a lista da pastora, e as líderes vinham marcando sem
  // saber disso.
  const [confirmando, setConfirmando] = useState(false);

  function salvar(status: Status) {
    setError(null);
    setSaved(false);
    setPendingStatus(status);
    startTransition(async () => {
      const result = await changeMyParticipantStatusAction(
        participantId,
        status,
        note,
        effectiveDate || null,
        status === "inativa" ? motivo || null : null,
      );
      setPendingStatus(null);
      setConfirmando(false);
      if (!result.error) {
        setEscolhendoMotivo(false);
        setMotivo("");
      }
      if (result.error) setError(result.error);
      else {
        setNote("");
        setEffectiveDate("");
        setSaved(true);
      }
    });
  }

  function handlePick(status: Status) {
    if (status === currentStatus) return;
    if (status === "inativa") {
      setError(null);
      setSaved(false);
      setConfirmando(false);
      setEscolhendoMotivo(true);
      return;
    }
    if (status === "acompanhamento") {
      setError(null);
      setSaved(false);
      setConfirmando(true);
      return;
    }
    salvar(status);
  }

  return (
    <Card className="p-6">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Situação na jornada
      </p>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => handlePick(status)}
            disabled={pending}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              status === currentStatus
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {pendingStatus === status ? "Salvando..." : PARTICIPANT_STATUS_LABELS[status]}
          </button>
        ))}
      </div>
      {!OPTIONS.includes(currentStatus) && (
        <p className="mt-2 text-xs text-muted-foreground">
          Situação atual: {PARTICIPANT_STATUS_LABELS[currentStatus]}.
        </p>
      )}

      {currentStatus === "inativa" && currentInactiveReason && !escolhendoMotivo && (
        <p className="mt-2 text-xs text-muted-foreground">
          Motivo: {INACTIVE_REASON_LABELS[currentInactiveReason as InactiveReason] ?? currentInactiveReason}
        </p>
      )}

      {escolhendoMotivo && (
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
          <p className="text-sm font-semibold text-foreground">Por que ela não vem mais?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            O histórico dela continua guardado. Se ela voltar, é só marcar Ativa de novo.
          </p>
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value as InactiveReason | "")}
            className="mt-3 w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Escolha o motivo...</option>
            {INACTIVE_REASONS.map((r) => (
              <option key={r} value={r}>
                {INACTIVE_REASON_LABELS[r]}
              </option>
            ))}
          </select>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={() => salvar("inativa")} disabled={pending || !motivo}>
              {pending ? "Salvando..." : "Marcar como Inativa"}
            </Button>
            <button
              type="button"
              onClick={() => setEscolhendoMotivo(false)}
              disabled={pending}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {currentStatus === "acompanhamento" && !confirmando && (
        <p className="mt-3 rounded-lg bg-danger/10 p-3 text-xs text-foreground">
          Esta participante está em acompanhamento e aparece na lista da pastoral. Quando o cuidado
          próximo não for mais necessário, marque como Ativa.
        </p>
      )}

      {confirmando && (
        <div className="mt-4 rounded-xl border border-danger/40 bg-danger/5 p-4">
          <p className="text-sm font-semibold text-foreground">
            Colocar em acompanhamento?
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{ACOMPANHAMENTO_O_QUE_E}</p>
          <p className="mt-3 text-xs font-medium text-foreground">O que acontece ao confirmar:</p>
          <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
            {ACOMPANHAMENTO_O_QUE_ACONTECE.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">{ACOMPANHAMENTO_NAO_USE_PARA}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => salvar("acompanhamento")}
              disabled={pending}
              className="self-start"
            >
              {pending ? "Salvando..." : "Sim, precisa de acompanhamento"}
            </Button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              disabled={pending}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={300}
        placeholder="Observação (opcional) — ex.: mudou de cidade"
        className="mt-3 w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
      />
      <label className="mt-2 block text-xs text-muted-foreground">
        Quando aconteceu (deixe vazio se foi hoje) — preencha antes de tocar na nova situação
        <input
          type="date"
          value={effectiveDate}
          onChange={(e) => setEffectiveDate(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
      </label>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {saved && <p className="mt-2 text-sm text-primary">Situação atualizada.</p>}
    </Card>
  );
}
