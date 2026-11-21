"use client";

import { useActionState, useState } from "react";
import { confirmDistributionAction } from "@/app/actions/distribution";
import type { FormActionState } from "@/app/actions/participants";
import { Button } from "@/components/ui/Button";
import { DistributionDetails } from "@/components/novas-inscricoes/distribution-details";
import type { AwaitingDistributionItem } from "@/lib/services/distribution.service";
import type { LeaderWithCafe } from "@/lib/services/integrated.service";
import { Picker } from "@/components/ui/Picker";
import { DistributionQuickBar, leaderPickerOptions } from "@/components/gestao-membros/quick-view";

// Mesma forma do cartão de "Prontas para aprovar": escolhe a líder e
// distribui na própria linha. Antes isto era um link para uma tela de
// distribuição individual, removida em 09/10/2026 — a gestora decidia num
// lugar e via o porquê em outro.
//
// A diferença para o cartão de novas inscrições é só o status de partida:
// aqui a participante já foi aprovada (ou devolvida por uma líder), então a
// ação é confirmDistribution, sem passar de novo pela aprovação.
export function AwaitingDistributionCard({
  item,
  allLeaders,
}: {
  item: AwaitingDistributionItem;
  allLeaders: LeaderWithCafe[];
}) {
  const [leaderId, setLeaderId] = useState(item.suggestions[0]?.leaderId ?? "");
  const [state, formAction, pending] = useActionState<FormActionState, FormData>(
    confirmDistributionAction.bind(null, item.id),
    undefined,
  );

  const selectedGroupId = item.suggestions.find((s) => s.leaderId === leaderId)?.groupId ?? "";

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium text-foreground">{item.full_name}</p>
        <span className="text-xs text-muted-foreground">
          Inscrita em {new Date(item.enrollment_date).toLocaleDateString("pt-BR")}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {[item.city, item.neighborhood].filter(Boolean).join(" / ") || "Localização não informada"}
      </p>

      {item.returned_at && (
        <p className="mt-1 text-xs text-foreground">
          <span className="mr-1.5 rounded-full bg-accent/30 px-2 py-0.5 font-medium">
            Devolvida{item.returned_by_name ? ` pela líder ${item.returned_by_name}` : " pela líder"}
          </span>
          {item.return_reason}
        </p>
      )}

      <form action={formAction} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1 sm:max-w-sm">
          <Picker
            name="leader_id"
            value={leaderId}
            onChange={setLeaderId}
            options={leaderPickerOptions(allLeaders, item.suggestions)}
            title={`Líder para ${item.full_name}`}
            placeholder="Escolha a líder"
          />
        </div>
        <input type="hidden" name="group_id" value={selectedGroupId ?? ""} />
        <Button type="submit" disabled={pending || !leaderId} className="sm:ml-auto">
          {pending ? "Distribuindo..." : "Distribuir"}
        </Button>
        {state?.error && <p className="w-full text-sm text-danger">{state.error}</p>}
      </form>

      <DistributionQuickBar participant={item} leader={allLeaders.find((l) => l.id === leaderId) ?? null} />
      <DistributionDetails pedido={item} suggestions={item.suggestions} leaderId={leaderId} />
    </div>
  );
}
