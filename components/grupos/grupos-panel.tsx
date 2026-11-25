"use client";

import { SecaoRetratil } from "@/components/ui/SecaoRetratil";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { GroupsList } from "@/components/grupos/groups-list";
import type { listGroups } from "@/lib/services/groups.service";
import { AVAILABILITY_DAYS, AVAILABILITY_DAY_LABELS } from "@/lib/validators/participant.schema";
import type { Enums } from "@/types/database.types";

type GroupItem = Awaited<ReturnType<typeof listGroups>>[number];

const STATUS_LABELS: Record<Enums<"group_status">, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  lotado: "Lotado",
};

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";

export function GruposPanel({
  groups,
  leaders,
}: {
  groups: GroupItem[];
  leaders: { id: string; full_name: string }[];
}) {
  const [day, setDay] = useState("");
  const [status, setStatus] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [region, setRegion] = useState("");

  const filtered = useMemo(() => {
    const termoRegion = region.trim().toLowerCase();
    return groups.filter((g) => {
      if (day && !(g.available_days ?? []).includes(day)) return false;
      if (status && g.status !== status) return false;
      if (leaderId && g.leader_id !== leaderId) return false;
      if (termoRegion && !(g.region ?? "").toLowerCase().includes(termoRegion)) return false;
      return true;
    });
  }, [groups, day, status, leaderId, region]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{filtered.length} encontrados</p>
        <Link
          href="/grupos/novo"
          className="btn btn-primary"
        >
          <Plus size={16} />
          Novo grupo
        </Link>
      </div>

      <SecaoRetratil titulo="Filtros" nivel="h2">
      <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2 md:grid-cols-4">
        <select value={day} onChange={(e) => setDay(e.target.value)} className={inputClass}>
          <option value="">Todos os dias</option>
          {AVAILABILITY_DAYS.map((d) => (
            <option key={d} value={d}>
              {AVAILABILITY_DAY_LABELS[d]}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
          <option value="">Todos os status</option>
          {(Object.entries(STATUS_LABELS) as [Enums<"group_status">, string][]).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select value={leaderId} onChange={(e) => setLeaderId(e.target.value)} className={inputClass}>
          <option value="">Todas as líderes</option>
          {leaders.map((l) => (
            <option key={l.id} value={l.id}>
              {l.full_name}
            </option>
          ))}
        </select>
        <input
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          placeholder="Cidade ou bairro"
          className={inputClass}
        />
      </div>
      </SecaoRetratil>

      <GroupsList groups={filtered} />
    </div>
  );
}
