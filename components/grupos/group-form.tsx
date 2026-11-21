"use client";

import { useActionState, useState } from "react";
import { createGroupAction, updateGroupAction } from "@/app/actions/groups";
import { AVAILABILITY_DAYS, AVAILABILITY_DAY_LABELS } from "@/lib/validators/participant.schema";
import { ROLE_LABELS } from "@/lib/role-labels";
import { Button } from "@/components/ui/Button";
import type { FormActionState } from "@/app/actions/participants";
import type { GroupRow } from "@/lib/services/groups.service";
import type { HostCandidate } from "@/lib/services/leaders.service";

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary";
const labelClass = "text-sm font-medium text-foreground";

type LeaderOption = {
  id: string;
  full_name: string;
  address: string | null;
  region: string | null;
};

type FonteDeEndereco = {
  rotulo: string;
  address: string | null;
  region: string | null;
};

export function GroupForm({
  group,
  leaders,
  hosts = [],
}: {
  group?: GroupRow;
  leaders: LeaderOption[];
  // Candidatas a anfitriã: contas com papel Anfitriã e também líderes e
  // co-líderes, já que a mesma pessoa pode acumular os dois papéis (ela
  // lidera o próprio café e recebe outro em casa). A anfitriã enxerga o
  // café que hospeda como a líder enxerga, mas sem poder alterar nada.
  hosts?: HostCandidate[];
}) {
  const action = group ? updateGroupAction.bind(null, group.id) : createGroupAction;
  const [state, formAction, pending] = useActionState<FormActionState, FormData>(action, undefined);

  // Endereço e região são controlados porque se preenchem sozinhos a
  // partir de quem foi escolhida — o café acontece na casa da anfitriã
  // quando existe uma, senão no endereço de encontro da líder. Antes a
  // pastora redigitava à mão o que já estava no cadastro das duas.
  const [leaderId, setLeaderId] = useState(group?.leader_id ?? "");
  const [hostId, setHostId] = useState(group?.host_profile_id ?? "");
  const [address, setAddress] = useState(group?.address ?? "");
  const [region, setRegion] = useState(group?.region ?? "");
  const [fonteAtual, setFonteAtual] = useState<string | null>(null);

  function fonteDeEndereco(proximoLeaderId: string, proximoHostId: string): FonteDeEndereco | null {
    const anfitria = hosts.find((h) => h.id === proximoHostId);
    if (anfitria && (anfitria.address || anfitria.region)) {
      return { rotulo: `anfitriã ${anfitria.full_name}`, address: anfitria.address, region: anfitria.region };
    }
    const lider = leaders.find((l) => l.id === proximoLeaderId);
    if (lider && (lider.address || lider.region)) {
      return { rotulo: `líder ${lider.full_name}`, address: lider.address, region: lider.region };
    }
    return null;
  }

  // Escolheu a líder ou a anfitriã, o endereço vem junto — sempre. É o que
  // evita digitar duas vezes a mesma informação. Os campos continuam
  // editáveis: se o café acontece em outro lugar, é só corrigir depois de
  // escolher.
  function aoTrocarVinculo(proximoLeaderId: string, proximoHostId: string) {
    const fonte = fonteDeEndereco(proximoLeaderId, proximoHostId);
    if (!fonte) {
      setFonteAtual(null);
      return;
    }
    setAddress(fonte.address ?? "");
    setRegion(fonte.region ?? "");
    setFonteAtual(fonte.rotulo);
  }

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label className={labelClass} htmlFor="name">Nome do grupo</label>
        <input id="name" name="name" required defaultValue={group?.name ?? ""} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label className={labelClass} htmlFor="host_profile_id">Anfitriã (opcional)</label>
        <select
          id="host_profile_id"
          name="host_profile_id"
          value={hostId}
          onChange={(e) => {
            setHostId(e.target.value);
            aoTrocarVinculo(leaderId, e.target.value);
          }}
          className={inputClass}
        >
          <option value="">Sem anfitriã</option>
          {hosts.map((h) => (
            <option key={h.id} value={h.id}>
              {h.full_name} — {ROLE_LABELS[h.role]}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Líderes e co-líderes também aparecem aqui: a mesma pessoa pode liderar um café e receber
          outro em casa.
        </p>
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label className={labelClass} htmlFor="leader_id">Líder responsável</label>
        <select
          id="leader_id"
          name="leader_id"
          value={leaderId}
          onChange={(e) => {
            setLeaderId(e.target.value);
            aoTrocarVinculo(e.target.value, hostId);
          }}
          className={inputClass}
        >
          {/* Não é obrigatório: um café pode ficar sem responsável quando a
              líder dele é excluída. Deixar o campo travado impediria a
              pastora de salvar qualquer outra coisa do café enquanto não
              tivesse uma substituta. */}
          <option value="">Sem líder responsável (por enquanto)</option>
          {leaders.map((l) => (
            <option key={l.id} value={l.id}>{l.full_name}</option>
          ))}
        </select>
        {leaderId === "" && (
          <p className="text-xs text-danger">
            Sem líder, este café não recebe participantes na distribuição e não aceita novos
            encontros.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label className={labelClass} htmlFor="address">Endereço</label>
        <input
          id="address"
          name="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={inputClass}
        />
        {fonteAtual && (
          <p className="text-xs text-muted-foreground">
            Preenchido a partir do cadastro da {fonteAtual}. Pode alterar se o café acontece em
            outro lugar.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="region">Região</label>
        <input
          id="region"
          name="region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="capacity">Capacidade</label>
        <input
          id="capacity"
          name="capacity"
          type="number"
          min={1}
          required
          defaultValue={group?.capacity ?? 12}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="meeting_time">Horário</label>
        <input
          id="meeting_time"
          name="meeting_time"
          type="time"
          defaultValue={group?.meeting_time ?? ""}
          className={inputClass}
        />
      </div>
      {group && (
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={group.status} className={inputClass}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
            <option value="lotado">Lotado</option>
          </select>
        </div>
      )}
      <div className="flex flex-col gap-2 sm:col-span-2">
        <span className={labelClass}>Dias disponíveis</span>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {AVAILABILITY_DAYS.map((day) => (
            <label key={day} className="flex items-center gap-1.5 text-sm text-foreground">
              <input
                type="checkbox"
                name="available_days"
                value={day}
                defaultChecked={group?.available_days?.includes(day)}
              />
              {AVAILABILITY_DAY_LABELS[day]}
            </label>
          ))}
        </div>
      </div>

      {state?.error && <p className="text-sm text-danger sm:col-span-2">{state.error}</p>}
      {state?.success && <p className="text-sm text-primary sm:col-span-2">Salvo.</p>}
      {state?.warning && <p className="text-sm font-medium text-danger sm:col-span-2">{state.warning}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Salvando..." : group ? "Salvar alterações" : "Criar grupo"}
      </Button>
    </form>
  );
}
