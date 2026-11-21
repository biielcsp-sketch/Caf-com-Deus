"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, MessageCircle, Phone } from "lucide-react";
import { PARTICIPANT_STATUS_BADGE, PARTICIPANT_STATUS_LABELS } from "@/lib/participant-status-labels";
import {
  AVAILABILITY_DAY_LABELS,
  AVAILABILITY_PERIOD_LABELS,
} from "@/lib/validators/participant.schema";
import type { CafeInfo, IntegratedParticipant } from "@/lib/services/integrated.service";
import { churchSummary, formatCep } from "@/lib/field-rules";

// Cartão clicável com a ficha inteira: fechado mostra só o essencial para
// achar a pessoa na lista; aberto mostra participante, líder e café lado a
// lado. Usado em "Participantes Integradas" (só leitura) e na
// "Redistribuição" (com o formulário de transferência como `children`).

export function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR");
}

function idade(birth: string | null) {
  if (!birth) return null;
  const nasc = new Date(`${birth}T00:00:00`);
  const hoje = new Date();
  let anos = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) anos--;
  return anos;
}

function dias(lista: string[]) {
  if (lista.length === 0) return "—";
  return lista.map((d) => AVAILABILITY_DAY_LABELS[d as keyof typeof AVAILABILITY_DAY_LABELS] ?? d).join(", ");
}

function periodos(lista: string[]) {
  if (lista.length === 0) return "—";
  return lista
    .map((p) => AVAILABILITY_PERIOD_LABELS[p as keyof typeof AVAILABILITY_PERIOD_LABELS] ?? p)
    .join(", ");
}

function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

export function ContactLinks({ phone, whatsapp }: { phone: string | null; whatsapp: string | null }) {
  const wa = whatsapp || phone;
  if (!phone && !wa) return <span className="text-muted-foreground">Sem telefone</span>;
  return (
    <span className="flex flex-wrap items-center gap-3">
      {phone && (
        <a href={`tel:${onlyDigits(phone)}`} className="inline-flex items-center gap-1 text-primary underline">
          <Phone size={13} /> {phone}
        </a>
      )}
      {wa && (
        <a
          href={`https://wa.me/55${onlyDigits(wa).replace(/^55/, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary underline"
        >
          <MessageCircle size={13} /> WhatsApp
        </a>
      )}
    </span>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function CafeFields({ cafe }: { cafe: CafeInfo }) {
  return (
    <>
      <Field label="Café">{cafe.name}</Field>
      <Field label="Dia e horário">
        {dias(cafe.available_days)}
        {cafe.meeting_time ? ` · ${cafe.meeting_time.slice(0, 5)}` : ""}
      </Field>
      <Field label="Local">{[cafe.address, cafe.region].filter(Boolean).join(" · ") || "—"}</Field>
    </>
  );
}

export function ParticipantDetailCard({
  participant: p,
  children,
}: {
  participant: IntegratedParticipant;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const anos = idade(p.birth_date);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-muted/60"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{p.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[p.city, p.neighborhood].filter(Boolean).join(" / ") || "Localização não informada"}
          </p>
          <p className="mt-1 text-xs text-foreground">
            Líder: {p.leader.name}
            {p.cafe ? ` · Café: ${p.cafe.name}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PARTICIPANT_STATUS_BADGE[p.status]}`}>
            {PARTICIPANT_STATUS_LABELS[p.status]}
          </span>
          <ChevronDown
            size={18}
            className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className="flex flex-col gap-4 border-t border-border p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <section className="rounded-lg bg-muted/50 p-3">
              <p className="mb-2 text-xs font-semibold text-foreground">Participante</p>
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {p.preferred_name && <Field label="Como gosta de ser chamada">{p.preferred_name}</Field>}
                <Field label="Contato">
                  <ContactLinks phone={p.phone} whatsapp={p.whatsapp} />
                </Field>
                <Field label="E-mail">{p.email || "—"}</Field>
                <Field label="Nascimento">
                  {formatDate(p.birth_date)}
                  {anos !== null ? ` (${anos} anos)` : ""}
                </Field>
                <Field label="Endereço">
                  {[p.address, p.neighborhood, p.city].filter(Boolean).join(" · ") || "—"}
                </Field>
                <Field label="Disponibilidade">
                  {dias(p.availability_days)} · {periodos(p.availability_period)}
                </Field>
                <Field label="Preferência de local">{p.location_preference || "—"}</Field>
                <Field label="Igreja">{churchSummary(p)}</Field>
                <Field label="CEP">{p.cep ? formatCep(p.cep) : "—"}</Field>
                <Field label="Inscrição">{formatDate(p.enrollment_date)}</Field>
                <Field label="Neste café desde">{formatDate(p.since)}</Field>
                <Field label="Presença">
                  {p.presencas} de {p.encontrosVinculados} encontro(s)
                </Field>
              </dl>
            </section>
            <section className="rounded-lg bg-muted/50 p-3">
              <p className="mb-2 text-xs font-semibold text-foreground">Líder e café atual</p>
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field label="Líder">{p.leader.name}</Field>
                <Field label="Contato da líder">
                  <ContactLinks phone={p.leader.phone} whatsapp={p.leader.whatsapp} />
                </Field>
                {p.cafe ? <CafeFields cafe={p.cafe} /> : <Field label="Café">Sem café vinculado</Field>}
              </dl>
            </section>
          </div>
          {children}
        </div>
      )}
    </div>
  );
}
