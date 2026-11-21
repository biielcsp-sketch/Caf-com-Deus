import Link from "next/link";
import { ChevronRight, Pencil } from "lucide-react";
import { PARTICIPANT_STATUS_BADGE, PARTICIPANT_STATUS_LABELS } from "@/lib/participant-status-labels";
import { AttentionBadge } from "@/components/acompanhamento/attention-badge";
import { VisitorBadge } from "@/components/participantes/visitor-badge";
import { ParticipantDeleteButton } from "@/components/participantes/participant-delete-button";
import type { ParticipantListItem } from "@/lib/services/participants.service";
import type { ParticipantAlerts } from "@/lib/services/followup.service";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function ParticipantsTable({
  participants,
  basePath,
  alertsMap,
  // Liga os botões Editar/Excluir na própria lista, para a pastora não
  // precisar abrir a ficha só para corrigir um telefone. Fica desligado
  // por padrão: a mesma tabela aparece nas telas da líder.
  canManage = false,
}: {
  participants: ParticipantListItem[];
  basePath: string;
  alertsMap?: Map<string, ParticipantAlerts>;
  canManage?: boolean;
}) {
  if (participants.length === 0) {
    return (
      <p className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Nenhuma participante encontrada com esses filtros.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {participants.map((p) => (
        // Com os botões na linha, o cartão inteiro não pode ser um link: um
        // <button> dentro de um <a> não é HTML válido e o clique vira loteria
        // entre navegar e excluir. Só a parte de cima é link.
        <div key={p.id} className="glass-panel rounded-[1.25rem] p-3">
          <Link href={`${basePath}/${p.id}`} className="flex min-h-[3.25rem] items-center gap-3">
            <span
              aria-hidden
              className="font-display flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[17px] font-semibold text-primary"
            >
              {initials(p.full_name)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[15px] font-semibold text-foreground">{p.full_name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {p.leader?.full_name ?? "Sem líder"} · {p.city ?? "Cidade não informada"}
              </span>
              {(p.is_visitor || alertsMap?.get(p.id)) && (
                <span className="mt-0.5 flex flex-wrap items-center gap-1">
                  {p.is_visitor && <VisitorBadge />}
                  <AttentionBadge alerts={alertsMap?.get(p.id)} />
                </span>
              )}
            </span>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${PARTICIPANT_STATUS_BADGE[p.status]}`}
            >
              {PARTICIPANT_STATUS_LABELS[p.status]}
            </span>
            <ChevronRight size={18} aria-hidden className="shrink-0 text-muted-foreground" />
          </Link>

          {canManage && (
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
              <Link
                href={`${basePath}/${p.id}/editar`}
                className="glass-inner flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-foreground"
              >
                <Pencil size={13} />
                Editar
              </Link>
              <ParticipantDeleteButton id={p.id} nome={p.full_name} compact />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
