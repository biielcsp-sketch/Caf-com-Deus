"use client";

import { useState, useTransition } from "react";
import { addMeetingParticipantAction, removeMeetingParticipantAction } from "@/app/actions/meetings";
import { Button } from "@/components/ui/Button";
import { X } from "lucide-react";

export function MeetingParticipantsPanel({
  meetingId,
  basePath,
  linked,
  available,
}: {
  meetingId: string;
  basePath: string;
  linked: { id: string; participant: { id: string; full_name: string } | null }[];
  available: { id: string; full_name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  // As duas actions devolvem `{ error }`; antes lançavam, e uma participante
  // duplicada derrubava a tela do encontro inteira.
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {linked.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma participante vinculada.</p>
      )}
      {linked.map((mp) => (
        <div key={mp.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
          <span className="text-sm text-foreground">{mp.participant?.full_name}</span>
          <button
            aria-label="Remover"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                setErro(null);
                const resultado = await removeMeetingParticipantAction(mp.id, meetingId, basePath);
                if (resultado?.error) setErro(resultado.error);
              })
            }
            className="text-muted-foreground hover:text-danger"
          >
            <X size={16} />
          </button>
        </div>
      ))}

      {erro && <p className="text-sm text-danger">{erro}</p>}

      {available.length > 0 && (
        <form
          action={async (formData) => {
            setErro(null);
            const resultado = await addMeetingParticipantAction(meetingId, basePath, formData);
            if (resultado?.error) setErro(resultado.error);
          }}
          className="flex gap-2"
        >
          <select
            name="participant_id"
            required
            className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Adicionar participante do grupo...</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
          <Button type="submit" variant="secondary">Adicionar</Button>
        </form>
      )}
    </div>
  );
}
