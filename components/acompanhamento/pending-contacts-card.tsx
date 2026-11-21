"use client";

import { useActionState } from "react";
import { AlertTriangle, UserPlus } from "lucide-react";
import { confirmContactAction } from "@/app/actions/notifications";
import { ContactLinks } from "@/components/gestao-membros/participant-detail-card";
import type { FormActionState } from "@/app/actions/participants";
import type { PendingContact } from "@/lib/services/contact-alerts.service";

function prazo(c: PendingContact) {
  if (c.diasDesde === 0) return "chegou hoje";
  if (c.diasDesde === 1) return "há 1 dia";
  return `há ${c.diasDesde} dias`;
}

function ConfirmButton({ participantId }: { participantId: string }) {
  const [state, action, pending] = useActionState<FormActionState, FormData>(
    confirmContactAction.bind(null, participantId),
    undefined,
  );
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Salvando..." : "Já fiz contato"}
      </button>
      {state?.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}

// Card do topo do dashboard.
// - Líder: quem acabou de chegar ao café dela, com o botão "Já fiz contato".
// - Pastora / Gestora: só quem passou do prazo de 3 dias, com o contato da
//   líder para cobrar.
export function PendingContactsCard({
  contacts,
  mode,
}: {
  contacts: PendingContact[];
  mode: "lider" | "gestao";
}) {
  if (contacts.length === 0) return null;
  const atrasados = contacts.filter((c) => c.atrasado).length;

  const titulo =
    mode === "lider"
      ? `Novas participantes no seu café (${contacts.length})`
      : `Participantes sem contato da líder há mais de 3 dias (${contacts.length})`;
  const descricao =
    mode === "lider"
      ? "Entre em contato em até 3 dias e toque em “Já fiz contato”. Depois do prazo, a pastora e a gestora de pessoas são avisadas."
      : "Foram distribuídas ou redistribuídas e a líder ainda não confirmou o contato no app.";

  const alerta = mode === "gestao" || atrasados > 0;

  return (
    <section
      className={`rounded-2xl border p-4 ${alerta ? "border-danger/40 bg-danger/5" : "border-primary/30 bg-primary/5"}`}
    >
      <div className="flex items-start gap-3">
        {alerta ? (
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-danger" />
        ) : (
          <UserPlus size={20} className="mt-0.5 shrink-0 text-primary" />
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {contacts.map((c) => (
          <li
            key={c.participantId}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 text-sm">
              <p className="font-medium text-foreground">{c.participantName}</p>
              <p className={`text-xs ${c.atrasado ? "font-medium text-danger" : "text-muted-foreground"}`}>
                Chegou {prazo(c)}
                {c.atrasado ? " — prazo vencido" : ""}
                {mode === "gestao" ? ` · Líder: ${c.leaderName}` : ""}
                {c.cafeName ? ` · ${c.cafeName}` : ""}
              </p>
              <div className="mt-1 text-xs">
                {mode === "lider" ? (
                  <ContactLinks phone={c.phone} whatsapp={c.whatsapp} />
                ) : (
                  <ContactLinks phone={c.leaderPhone} whatsapp={c.leaderWhatsapp} />
                )}
              </div>
            </div>
            {mode === "lider" && <ConfirmButton participantId={c.participantId} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
