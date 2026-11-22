"use client";

import { useEffect, useState, type ReactNode } from "react";
import { IdCard, UserRound, X } from "lucide-react";
import { CafeFields, ContactLinks, Field, formatDate } from "@/components/gestao-membros/participant-detail-card";
import {
  AVAILABILITY_DAY_LABELS,
  AVAILABILITY_PERIOD_LABELS,
} from "@/lib/validators/participant.schema";
import type { LeaderWithCafe } from "@/lib/services/integrated.service";
import { churchSummary } from "@/lib/field-rules";

// Acesso rápido aos dados na hora de distribuir e redistribuir: a ficha da
// participante e a da líder abrem num painel por cima da fila, sem sair da
// tela. Quem decide para onde a pessoa vai precisa ver as duas lado a lado.

export type ParticipantQuick = {
  full_name: string;
  preferred_name?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  birth_date?: string | null;
  city: string | null;
  neighborhood: string | null;
  address?: string | null;
  availability_days: string[] | null;
  availability_period: string[] | null;
  location_preference: string | null;
  home_meeting_ok?: boolean | null;
  is_lagoinha_member?: boolean | null;
  church_status?: string | null;
  church_name?: string | null;
  other_notes?: string | null;
  enrollment_date: string | null;
  enrollment_source?: string | null;
};

function lista<T extends string>(valores: string[] | null | undefined, mapa: Record<T, string>) {
  if (!valores || valores.length === 0) return "não informou";
  return valores.map((v) => mapa[v as T] ?? v).join(", ");
}

function idade(birth: string | null | undefined) {
  if (!birth) return null;
  const n = new Date(`${birth}T00:00:00`);
  const h = new Date();
  let a = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) a--;
  return a;
}

export function QuickSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Fechar" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="relative flex max-h-[88vh] w-full flex-col overflow-y-auto rounded-t-2xl bg-background p-5 shadow-xl sm:max-h-none sm:max-w-md sm:rounded-none">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button type="button" aria-label="Fechar" onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X size={20} />
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

export function ParticipantQuickData({ p }: { p: ParticipantQuick }) {
  const anos = idade(p.birth_date);
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {p.preferred_name && <Field label="Como gosta de ser chamada">{p.preferred_name}</Field>}
      <Field label="Contato">
        <ContactLinks phone={p.phone ?? null} whatsapp={p.whatsapp ?? null} />
      </Field>
      <Field label="E-mail">{p.email || "—"}</Field>
      <Field label="Nascimento">
        {formatDate(p.birth_date ?? null)}
        {anos !== null ? ` (${anos} anos)` : ""}
      </Field>
      <Field label="Mora em">{[p.address, p.neighborhood, p.city].filter(Boolean).join(" · ") || "não informou"}</Field>
      <Field label="Dias">{lista(p.availability_days, AVAILABILITY_DAY_LABELS)}</Field>
      <Field label="Períodos">{lista(p.availability_period, AVAILABILITY_PERIOD_LABELS)}</Field>
      <Field label="Prefere">{p.location_preference?.trim() || "não informou"}</Field>
      {p.home_meeting_ok !== undefined && p.home_meeting_ok !== null && (
        <Field label="Aceita café em casa">{p.home_meeting_ok ? "Sim" : "Não"}</Field>
      )}
      {(p.church_status != null || (p.is_lagoinha_member !== undefined && p.is_lagoinha_member !== null)) && (
        <Field label="Igreja">
          {churchSummary({
            church_status: p.church_status ?? null,
            church_name: p.church_name ?? null,
            is_lagoinha_member: p.is_lagoinha_member ?? null,
          })}
        </Field>
      )}
      <Field label="Inscrição">
        {formatDate(p.enrollment_date)}
        {p.enrollment_source ? ` · ${p.enrollment_source}` : ""}
      </Field>
      {p.other_notes && (
        <div className="sm:col-span-2">
          <Field label="Observações">{p.other_notes}</Field>
        </div>
      )}
    </dl>
  );
}

export function LeaderQuickData({ l }: { l: LeaderWithCafe }) {
  const lotada = l.maxCapacity !== null && l.ocupadas >= l.maxCapacity;
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Contato">
        <ContactLinks phone={l.phone} whatsapp={l.whatsapp} />
      </Field>
      <Field label="Região">{l.region || "—"}</Field>
      <Field label="Ocupação">
        <span className={lotada ? "font-medium text-danger" : ""}>
          {l.ocupadas}
          {l.maxCapacity ? ` de ${l.maxCapacity}` : ""} participante(s){lotada ? " — sem vaga" : ""}
        </span>
      </Field>
      {l.cafes.length === 0 ? (
        <Field label="Café">Sem café cadastrado</Field>
      ) : (
        l.cafes.map((c) => <CafeFields key={c.id} cafe={c} />)
      )}
    </dl>
  );
}

// Linha compacta da líder escolhida, logo abaixo do seletor, com os botões de
// ficha completa da participante e da líder.
export function DistributionQuickBar({
  participant,
  leader,
}: {
  participant: ParticipantQuick;
  leader: LeaderWithCafe | null;
}) {
  const [aberto, setAberto] = useState<"participante" | "lider" | null>(null);
  const cafe = leader?.cafes[0] ?? null;
  const lotada = leader && leader.maxCapacity !== null && leader.ocupadas >= leader.maxCapacity;

  return (
    <div className="mt-3 flex flex-col gap-2">
      {leader && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{cafe?.name ?? "Sem café cadastrado"}</span>
          {cafe?.available_days.length
            ? ` · ${cafe.available_days
                .map((d) => AVAILABILITY_DAY_LABELS[d as keyof typeof AVAILABILITY_DAY_LABELS] ?? d)
                .join(", ")}`
            : ""}
          {cafe?.meeting_time ? ` ${cafe.meeting_time.slice(0, 5)}` : ""}
          {cafe?.region ? ` · ${cafe.region}` : ""}
          {" · "}
          <span className={lotada ? "font-medium text-danger" : ""}>
            {leader.ocupadas}
            {leader.maxCapacity ? `/${leader.maxCapacity}` : ""} vagas ocupadas
          </span>
        </p>
      )}
      <div className="btn-row">
        <button
          type="button"
          onClick={() => setAberto("participante")}
          className="btn btn-secondary"
        >
          <IdCard size={14} /> Ficha da participante
        </button>
        {leader && (
          <button
            type="button"
            onClick={() => setAberto("lider")}
            className="btn btn-secondary"
          >
            <UserRound size={14} /> Ficha da líder
          </button>
        )}
      </div>

      {aberto === "participante" && (
        <QuickSheet title={participant.full_name} onClose={() => setAberto(null)}>
          <ParticipantQuickData p={participant} />
        </QuickSheet>
      )}
      {aberto === "lider" && leader && (
        <QuickSheet title={leader.name} onClose={() => setAberto(null)}>
          <LeaderQuickData l={leader} />
        </QuickSheet>
      )}
    </div>
  );
}

// Opções do seletor de líder com a linha de apoio (café, pontos, ocupação).
export function leaderPickerOptions(
  leaders: LeaderWithCafe[],
  suggestions: { leaderId: string; leaderName: string; score: number }[],
  excluir?: string | null,
) {
  const porId = new Map(leaders.map((l) => [l.id, l]));
  const sugeridas = new Set(suggestions.map((s) => s.leaderId));
  const descricao = (l: LeaderWithCafe | undefined, extra?: string) =>
    [
      extra,
      l?.cafes[0]?.name,
      l?.cafes[0]?.region,
      l ? `${l.ocupadas}${l.maxCapacity ? `/${l.maxCapacity}` : ""} ocupadas` : undefined,
    ]
      .filter(Boolean)
      .join(" · ");

  return [
    ...suggestions
      .filter((s) => s.leaderId !== excluir)
      .map((s) => {
        const l = porId.get(s.leaderId);
        return {
          value: s.leaderId,
          label: l?.name ?? s.leaderName,
          description: descricao(l, `${s.score.toFixed(0)} pts`),
          group: "Sugeridas",
        };
      }),
    ...leaders
      .filter((l) => !sugeridas.has(l.id) && l.id !== excluir)
      .map((l) => ({ value: l.id, label: l.name, description: descricao(l), group: "Outras líderes" })),
  ];
}
