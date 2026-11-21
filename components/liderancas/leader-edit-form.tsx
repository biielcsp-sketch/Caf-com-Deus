"use client";

import { useActionState } from "react";
import { updateLeaderAction } from "@/app/actions/leaders";
import { Button } from "@/components/ui/Button";
import type { FormActionState } from "@/app/actions/participants";
import type { LeaderRow } from "@/lib/services/leaders.service";

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary";
const labelClass = "text-sm font-medium text-foreground";

// getLeader() devolve a linha de `leaders` com o profile embutido — os
// dados da conta (nome, e-mail de login, telefone) moram lá, não aqui.
type LeaderWithProfile = LeaderRow & {
  profile?: {
    full_name: string;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
  } | null;
};

export function LeaderEditForm({ leader }: { leader: LeaderWithProfile }) {
  const boundAction = updateLeaderAction.bind(null, leader.id);
  const [state, action, pending] = useActionState<FormActionState, FormData>(boundAction, undefined);

  return (
    <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">
        Dados da conta
      </p>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label className={labelClass} htmlFor="full_name">Nome completo</label>
        <input
          id="full_name"
          name="full_name"
          required
          defaultValue={leader.profile?.full_name ?? ""}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label className={labelClass} htmlFor="email">E-mail de acesso</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={leader.profile?.email ?? ""}
          className={inputClass}
        />
        <p className="text-xs text-muted-foreground">
          É com este e-mail que ela entra no aplicativo. Ao alterar, avise a líder — o endereço
          antigo deixa de funcionar na hora. A senha dela continua a mesma.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="phone">Telefone</label>
        <input id="phone" name="phone" defaultValue={leader.profile?.phone ?? ""} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="whatsapp">WhatsApp</label>
        <input
          id="whatsapp"
          name="whatsapp"
          defaultValue={leader.profile?.whatsapp ?? ""}
          className={inputClass}
        />
      </div>

      <p className="mt-2 border-t border-border pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">
        Dados do café
      </p>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="city">Cidade</label>
        <input id="city" name="city" defaultValue={leader.city ?? ""} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="neighborhood">Bairro</label>
        <input id="neighborhood" name="neighborhood" defaultValue={leader.neighborhood ?? ""} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label className={labelClass} htmlFor="meeting_address">Endereço do encontro</label>
        <input
          id="meeting_address"
          name="meeting_address"
          defaultValue={leader.meeting_address ?? ""}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="region">Região de atuação</label>
        <input id="region" name="region" defaultValue={leader.region ?? ""} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="max_capacity">Capacidade máxima</label>
        <input
          id="max_capacity"
          name="max_capacity"
          type="number"
          min={1}
          defaultValue={leader.max_capacity}
          required
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label className={labelClass} htmlFor="admin_notes">Observações administrativas</label>
        <textarea
          id="admin_notes"
          name="admin_notes"
          rows={3}
          defaultValue={leader.admin_notes ?? ""}
          className={inputClass}
        />
      </div>
      {state?.error && <p className="text-sm text-danger sm:col-span-2">{state.error}</p>}
      {state?.success && <p className="text-sm text-primary sm:col-span-2">Salvo.</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Salvando..." : "Salvar alterações"}
      </Button>
    </form>
  );
}
