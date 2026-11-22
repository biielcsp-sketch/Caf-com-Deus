"use client";

import { useMemo, useState, useActionState } from "react";
import {
  approveAndDistributeAction,
  approveEnrollmentManuallyAction,
  markEnrollmentAsDuplicateAction,
  approveAndDistributeBatchAction,
  type BatchApproveActionState,
} from "@/app/actions/enrollment-review";
import { Button } from "@/components/ui/Button";
import { DistributionDetails } from "@/components/novas-inscricoes/distribution-details";
import { Card } from "@/components/ui/Card";
import type { EnrollmentReviewItem } from "@/lib/services/enrollment-review.service";
import type { FormActionState } from "@/app/actions/participants";
import type { LeaderWithCafe } from "@/lib/services/integrated.service";
import { Picker } from "@/components/ui/Picker";
import { DistributionQuickBar, leaderPickerOptions } from "@/components/gestao-membros/quick-view";

type Leader = LeaderWithCafe;
type BatchItem = { participantId: string; fullName: string; leaderId: string; groupId: string | null };

function locationLabel(item: { city: string | null; neighborhood: string | null }) {
  return [item.city, item.neighborhood].filter(Boolean).join(" / ") || "Localização não informada";
}

export function EnrollmentReviewBoard({
  ready,
  needsAttention,
  allLeaders,
}: {
  ready: EnrollmentReviewItem[];
  needsAttention: EnrollmentReviewItem[];
  allLeaders: Leader[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [leaderChoice, setLeaderChoice] = useState<Record<string, string>>({});
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function leaderIdFor(item: EnrollmentReviewItem) {
    return leaderChoice[item.id] ?? item.suggestions[0]?.leaderId ?? "";
  }

  function groupIdFor(item: EnrollmentReviewItem, leaderId: string) {
    return item.suggestions.find((s) => s.leaderId === leaderId)?.groupId ?? null;
  }

  const batchItems: BatchItem[] = useMemo(
    () =>
      ready
        .filter((item) => selected.has(item.id))
        .map((item) => {
          const leaderId = leaderIdFor(item);
          return { participantId: item.id, fullName: item.full_name, leaderId, groupId: groupIdFor(item, leaderId) };
        })
        .filter((i) => i.leaderId),
    // leaderChoice é lido dentro de leaderIdFor — precisa disparar o recálculo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, selected, leaderChoice],
  );

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Prontas para aprovar</h2>
          {selected.size > 0 && (
            <Button onClick={() => setShowBatchConfirm(true)}>
              Aprovar e Distribuir selecionadas ({selected.size})
            </Button>
          )}
        </div>

        {ready.length === 0 ? (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Nenhuma inscrição pronta para aprovar agora.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {ready.map((item) => (
              <ReadyCard
                key={item.id}
                item={item}
                allLeaders={allLeaders}
                checked={selected.has(item.id)}
                onToggle={() => toggleSelected(item.id)}
                leaderId={leaderIdFor(item)}
                onLeaderChange={(leaderId) => setLeaderChoice((prev) => ({ ...prev, [item.id]: leaderId }))}
              />
            ))}
          </div>
        )}
      </section>

      {/* Inscrições que o sistema não consegue aprovar direto (telefone já
          cadastrado, faltou dia/bairro para calcular a sugestão, ou nenhuma
          líder com vaga). Sem esta seção elas ficariam invisíveis. Só aparece
          quando existe alguma — vazia, era só ruído na tela. */}
      {needsAttention.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-foreground">Inscrições com pendência ({needsAttention.length})</h2>
          <p className="mb-3 mt-1 text-sm text-muted-foreground">
            O sistema não conseguiu sugerir uma líder para estas. Confira o motivo e aprove manualmente, ou marque como
            duplicata.
          </p>
          <div className="flex flex-col gap-3">
            {needsAttention.map((item) => (
              <AttentionCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {showBatchConfirm && (
        <BatchConfirmModal
          items={batchItems}
          allLeaders={allLeaders}
          onClose={() => setShowBatchConfirm(false)}
          onDone={() => {
            setShowBatchConfirm(false);
            setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}

function ReadyCard({
  item,
  allLeaders,
  checked,
  onToggle,
  leaderId,
  onLeaderChange,
}: {
  item: EnrollmentReviewItem;
  allLeaders: Leader[];
  checked: boolean;
  onToggle: () => void;
  leaderId: string;
  onLeaderChange: (leaderId: string) => void;
}) {
  // Só as líderes SUGERIDAS trazem o café junto. Escolhendo uma de "Outras
  // líderes", isto fica vazio — e o café passou a ser resolvido no servidor
  // (confirmDistribution), senão a participante era aprovada sem café nenhum.
  const selectedGroupId = item.suggestions.find((s) => s.leaderId === leaderId)?.groupId ?? "";
  const [state, formAction, pending] = useActionState<FormActionState, FormData>(
    approveAndDistributeAction.bind(null, item.id),
    undefined,
  );

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-1.5 h-4 w-4 shrink-0"
          aria-label={`Selecionar ${item.full_name} para aprovação em lote`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium text-foreground">{item.full_name}</p>
            <span className="text-xs text-muted-foreground">
              Inscrita em {new Date(item.enrollment_date).toLocaleDateString("pt-BR")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{locationLabel(item)}</p>

          <form action={formAction} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="flex-1 sm:max-w-sm">
              <Picker
                name="leader_id"
                value={leaderId}
                onChange={onLeaderChange}
                options={leaderPickerOptions(allLeaders, item.suggestions)}
                title={`Líder para ${item.full_name}`}
                placeholder="Escolha a líder"
              />
            </div>
            <input type="hidden" name="group_id" value={selectedGroupId ?? ""} />
            <Button type="submit" disabled={pending || !leaderId} className="sm:ml-auto">
              {pending ? "Aprovando..." : "Aprovar e Distribuir"}
            </Button>
            {state?.error && <p className="w-full text-sm text-danger">{state.error}</p>}
          </form>

          <DistributionQuickBar participant={item} leader={allLeaders.find((l) => l.id === leaderId) ?? null} />
          <DistributionDetails pedido={item} suggestions={item.suggestions} leaderId={leaderId} />
        </div>
      </div>
    </Card>
  );
}

function AttentionCard({ item }: { item: EnrollmentReviewItem }) {
  const [showSpamNote, setShowSpamNote] = useState(false);
  // As duas actions devolvem `{ error }`; antes lançavam e o quadro inteiro
  // de novas inscrições sumia, levando junto a seleção em lote já marcada.
  const [approveState, approveAction, approvePending] = useActionState<FormActionState, FormData>(
    approveEnrollmentManuallyAction.bind(null, item.id),
    undefined,
  );
  const [spamState, spamAction, spamPending] = useActionState<FormActionState, FormData>(
    markEnrollmentAsDuplicateAction.bind(null, item.id),
    undefined,
  );

  const reasons: string[] = [];
  if (item.duplicate) reasons.push("Telefone já cadastrado");
  if (item.incompleteData) reasons.push("Faltam dados p/ calcular sugestão (disponibilidade ou cidade/bairro)");
  if (!item.duplicate && !item.incompleteData && item.suggestions.length === 0) {
    reasons.push("Nenhuma líder elegível no momento");
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium text-foreground">{item.full_name}</p>
        <span className="text-xs text-muted-foreground">
          Inscrita em {new Date(item.enrollment_date).toLocaleDateString("pt-BR")}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{locationLabel(item)}</p>

      <ul className="mt-2 flex flex-wrap gap-2">
        {reasons.map((r) => (
          <li key={r} className="rounded-full bg-danger/10 px-2.5 py-1 text-xs font-medium text-danger">
            {r}
          </li>
        ))}
      </ul>

      <div className="btn-row mt-3">
        <form action={approveAction}>
          <Button type="submit" disabled={approvePending} variant="secondary">
            {approvePending ? "Aprovando..." : "Aprovar manualmente"}
          </Button>
        </form>
        {!showSpamNote ? (
          <Button type="button" variant="danger" onClick={() => setShowSpamNote(true)}>
            Marcar como duplicata/spam
          </Button>
        ) : (
          <form action={spamAction} className="flex flex-1 flex-wrap items-center gap-2">
            <input
              name="note"
              placeholder="Motivo (opcional)"
              className="min-w-[10rem] flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <Button type="submit" disabled={spamPending} variant="danger">
              {spamPending ? "Marcando..." : "Confirmar"}
            </Button>
          </form>
        )}
      </div>
      {(approveState?.error || spamState?.error) && (
        <p className="mt-2 text-sm text-danger">{approveState?.error ?? spamState?.error}</p>
      )}
    </Card>
  );
}

function BatchConfirmModal({
  items,
  allLeaders,
  onClose,
  onDone,
}: {
  items: BatchItem[];
  allLeaders: Leader[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<BatchApproveActionState, FormData>(
    approveAndDistributeBatchAction,
    undefined,
  );

  const leaderName = (id: string) => allLeaders.find((l) => l.id === id)?.name ?? "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-foreground">Confirmar aprovação em lote</h3>

        {!state || state.status !== "done" ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">Confira antes de aprovar de uma vez:</p>
            <ul className="mt-4 flex max-h-64 flex-col gap-2 overflow-y-auto text-sm">
              {items.map((i) => (
                <li key={i.participantId} className="flex items-center justify-between gap-2">
                  <span className="text-foreground">{i.fullName}</span>
                  <span className="text-muted-foreground">→ {leaderName(i.leaderId)}</span>
                </li>
              ))}
            </ul>
            {state?.status === "error" && <p className="mt-3 text-sm text-danger">{state.error}</p>}
            <form action={action} className="mt-5 flex justify-end gap-2">
              <input type="hidden" name="payload" value={JSON.stringify(items)} />
              <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending || items.length === 0}>
                {pending ? "Aprovando..." : `Confirmar (${items.length})`}
              </Button>
            </form>
          </>
        ) : (
          <>
            <ul className="mt-4 flex max-h-64 flex-col gap-2 overflow-y-auto text-sm">
              {state.results.map((r) => (
                <li key={r.participantId} className="flex items-center justify-between gap-2">
                  <span className="text-foreground">{r.fullName}</span>
                  {r.ok ? (
                    <span className="text-sm font-medium text-primary">Aprovada</span>
                  ) : (
                    <span className="text-sm text-danger">{r.error ?? "Falhou"}</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex justify-end">
              <Button onClick={onDone}>Fechar</Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
