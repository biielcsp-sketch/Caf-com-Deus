"use client";

import { useActionState, useState } from "react";
import { transferParticipantAction } from "@/app/actions/distribution";
import { Button } from "@/components/ui/Button";
import { Picker } from "@/components/ui/Picker";
import { leaderPickerOptions } from "@/components/gestao-membros/quick-view";
import {
  CafeFields,
  ContactLinks,
  Field,
  ParticipantDetailCard,
} from "@/components/gestao-membros/participant-detail-card";
import type { FormActionState } from "@/app/actions/participants";
import type { IntegratedParticipant, LeaderWithCafe } from "@/lib/services/integrated.service";

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary";

// Cartão clicável da redistribuição: aberto mostra a ficha completa da
// participante, a líder e o café atuais e, ao escolher a nova líder, o café
// de destino com a ocupação — para quem redistribui comparar antes de
// confirmar. O café da nova líder continua sendo resolvido no servidor
// (transfer.service.ts), por isso não há campo de café aqui.
export function RedistributionRow({
  participant,
  leaders,
}: {
  participant: IntegratedParticipant;
  leaders: LeaderWithCafe[];
}) {
  const [state, formAction, pending] = useActionState<FormActionState, FormData>(
    transferParticipantAction.bind(null, participant.id),
    undefined,
  );
  const [destinoId, setDestinoId] = useState("");
  const destino = leaders.find((l) => l.id === destinoId) ?? null;

  return (
    <ParticipantDetailCard participant={participant}>
      <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border p-3">
        <p className="text-xs font-semibold text-foreground">Transferir para outra líder</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="flex-1 sm:max-w-xs">
            <Picker
              name="leader_id"
              value={destinoId}
              onChange={setDestinoId}
              options={leaderPickerOptions(leaders, [], participant.current_leader_id)}
              title={`Nova líder para ${participant.full_name}`}
              placeholder="Escolha a nova líder"
            />
          </div>
          <input name="reason" placeholder="Motivo (opcional)" className={inputClass} />
          <Button type="submit" disabled={pending || !destinoId} variant="secondary" className="shrink-0">
            {pending ? "Transferindo..." : "Transferir"}
          </Button>
        </div>

        {destino && (
          <dl className="grid grid-cols-1 gap-2 rounded-lg bg-accent/15 p-3 sm:grid-cols-2">
            <Field label="Nova líder">{destino.name}</Field>
            <Field label="Contato">
              <ContactLinks phone={destino.phone} whatsapp={destino.whatsapp} />
            </Field>
            <Field label="Ocupação">
              {destino.ocupadas}
              {destino.maxCapacity ? ` de ${destino.maxCapacity}` : ""} participante(s)
              {destino.maxCapacity && destino.ocupadas >= destino.maxCapacity ? " — sem vaga" : ""}
            </Field>
            {destino.cafes.length === 0 ? (
              <Field label="Café">Esta líder ainda não tem café cadastrado</Field>
            ) : (
              destino.cafes.map((c) => <CafeFields key={c.id} cafe={c} />)
            )}
          </dl>
        )}
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        {state?.success && <p className="text-sm text-primary">Transferência registrada.</p>}
      </form>
    </ParticipantDetailCard>
  );
}
