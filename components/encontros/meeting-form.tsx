"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createMeetingAction, updateMeetingAction } from "@/app/actions/meetings";
import { Button } from "@/components/ui/Button";
import type { FormActionState } from "@/app/actions/participants";
import type { MeetingRow } from "@/lib/services/meetings.service";

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary";
const labelClass = "text-sm font-medium text-foreground";

// Data de hoje no fuso de quem está usando o app, em yyyy-mm-dd — o mesmo
// formato do <input type="date">, então a comparação pode ser de string.
// Só é chamada dentro de handler de evento (nunca na primeira renderização),
// senão o servidor calcularia em UTC e o navegador em -03, e das 21h à meia-
// noite os dois discordariam do que é "hoje" — o React reclamaria de
// hidratação e, pior, a tela mostraria uma coisa diferente do servidor.
function hojeLocalISO() {
  const agora = new Date();
  const fuso = agora.getTimezoneOffset() * 60_000;
  return new Date(agora.getTime() - fuso).toISOString().slice(0, 10);
}

export function MeetingForm({
  meeting,
  groups,
  basePath,
}: {
  meeting?: MeetingRow;
  groups: { id: string; name: string }[];
  basePath: string;
}) {
  const action = meeting
    ? updateMeetingAction.bind(null, meeting.id, basePath)
    : createMeetingAction.bind(null, basePath);
  const [state, formAction, pending] = useActionState<FormActionState, FormData>(action, undefined);

  // Encontro retroativo: a líder registra depois que ele já aconteceu.
  // Nada nunca impediu uma data passada (não há `min` aqui, nem regra no
  // schema, no serviço ou na RLS) — o que faltava era o status. Sem campo de
  // status no cadastro, todo encontro nascia "planejado", inclusive um de
  // duas semanas atrás, e só dava para corrigir reabrindo a ficha depois.
  const [status, setStatus] = useState<string>(meeting?.status ?? "planejado");
  // Se ela mexeu no status na mão, a data para de sobrescrever a escolha.
  const [statusManual, setStatusManual] = useState(false);

  function aoMudarData(valor: string) {
    const passado = valor !== "" && valor < hojeLocalISO();
    // Só no cadastro. Num encontro já salvo, mexer na data não pode reescrever
    // um status que alguém escolheu de propósito (um "cancelado", por exemplo).
    if (!meeting && !statusManual) setStatus(passado ? "realizado" : "planejado");
  }

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label className={labelClass} htmlFor="title">Título</label>
        <input id="title" name="title" required defaultValue={meeting?.title ?? ""} className={inputClass} />
      </div>
      {!meeting && (
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelClass} htmlFor="group_id">Grupo</label>
          <select id="group_id" name="group_id" required className={inputClass}>
            <option value="">Selecione...</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="date">Data</label>
        <input
          id="date"
          name="date"
          type="date"
          required
          defaultValue={meeting?.date ?? ""}
          onChange={(e) => aoMudarData(e.target.value)}
          className={inputClass}
        />
        <p className="text-xs text-muted-foreground">
          Pode ser uma data que já passou, para registrar um encontro que já aconteceu.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="time">Horário</label>
        <input id="time" name="time" type="time" defaultValue={meeting?.time ?? ""} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label className={labelClass} htmlFor="location">Local</label>
        <input id="location" name="location" defaultValue={meeting?.location ?? ""} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label className={labelClass} htmlFor="ministered_by">Quem ministrou a palavra</label>
        <input
          id="ministered_by"
          name="ministered_by"
          defaultValue={meeting?.ministered_by ?? ""}
          placeholder="Nome de quem ministrou no encontro"
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="status">Status</label>
        <select
          id="status"
          name="status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setStatusManual(true);
          }}
          className={inputClass}
        >
          <option value="planejado">Planejado</option>
          <option value="confirmado">Confirmado</option>
          <option value="realizado">Realizado</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>
      {status === "realizado" && (
        <p className="self-end text-xs text-muted-foreground sm:pb-2.5">
          Marcar como <strong className="font-medium text-foreground">Realizado</strong> não registra presença.{" "}
          {meeting ? (
            <>
              Para aparecer o resumo de presentes e ausentes, faça a{" "}
              <Link
                href={`${basePath}/${meeting.id}/presenca`}
                className="font-medium text-primary underline"
              >
                Chamada
              </Link>
              .
            </>
          ) : (
            <>
              Depois de salvar, use o botão{" "}
              <strong className="font-medium text-foreground">Chamada</strong> para marcar quem esteve presente.
            </>
          )}
        </p>
      )}
      {state?.error && <p className="text-sm text-danger sm:col-span-2">{state.error}</p>}
      {state?.success && <p className="text-sm text-primary sm:col-span-2">Salvo.</p>}
      <Button type="submit" disabled={pending} className="self-start sm:col-span-2">
        {pending ? "Salvando..." : meeting ? "Salvar alterações" : "Criar encontro"}
      </Button>
    </form>
  );
}
