"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { returnParticipantToQueueAction } from "@/app/actions/distribution";

const MOTIVOS = [
  "O dia do café não serve para ela",
  "O horário do café não serve para ela",
  "O local ficou longe ou difícil",
];

export function ReturnToQueueCard({ participantId }: { participantId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [detalhe, setDetalhe] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    const texto = detalhe.trim() ? `${motivo} — ${detalhe.trim()}` : motivo;
    startTransition(async () => {
      const result = await returnParticipantToQueueAction(participantId, texto);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/minhas-participantes");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          Ela quer continuar, mas este café não serve mais para ela?
        </p>
        <Button type="button" variant="secondary" className="mt-3" onClick={() => setOpen(true)}>
          Precisa de outro café
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Devolver para a pastora redirecionar
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Ela sai da sua lista e volta para a fila de distribuição, com o motivo abaixo. A pastora
        escolhe o novo café.
      </p>
      <select
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        className="mt-3 w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
      >
        {MOTIVOS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <textarea
        value={detalhe}
        onChange={(e) => setDetalhe(e.target.value)}
        rows={3}
        maxLength={200}
        placeholder="Detalhe, se quiser (ex.: só pode aos sábados)"
        className="mt-3 w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
      />
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button type="button" onClick={handleConfirm} disabled={pending}>
          {pending ? "Devolvendo..." : "Confirmar devolução"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </Card>
  );
}
