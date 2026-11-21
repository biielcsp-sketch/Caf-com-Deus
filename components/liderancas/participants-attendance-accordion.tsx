"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import type { MonthlyAttendance } from "@/lib/services/attendance.service";

type ParticipantAttendance = {
  id: string;
  full_name: string;
  anonymized_at: string | null;
  months: MonthlyAttendance[];
};

function formatMonthLabel(month: string) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function nomeExibicao(p: Pick<ParticipantAttendance, "full_name" | "anonymized_at">) {
  return p.anonymized_at ? "Participante removida" : p.full_name;
}

export function ParticipantsAttendanceAccordion({
  participants,
  basePath = "/participantes",
}: {
  participants: ParticipantAttendance[];
  basePath?: string;
}) {
  const [busca, setBusca] = useState("");

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return participants;
    return participants.filter((p) => nomeExibicao(p).toLowerCase().includes(termo));
  }, [participants, busca]);

  return (
    <CollapsibleSection
      title="Frequência por mês"
      count={participants.length}
      search={{ value: busca, onChange: setBusca, placeholder: "Buscar participante pelo nome..." }}
    >
      <ul className="divide-y divide-border">
        {filtradas.length === 0 && (
          <li className="px-4 py-3 text-sm text-muted-foreground">Nenhuma participante encontrada.</li>
        )}
        {filtradas.map((p) => (
          <li key={p.id} className="flex flex-col gap-1.5 px-4 py-3">
            <Link href={`${basePath}/${p.id}`} className="text-sm font-medium text-foreground hover:underline">
              {nomeExibicao(p)}
            </Link>
            {p.months.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem encontros registrados ainda.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {p.months.map((m) => (
                  <span
                    key={m.month}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs capitalize text-foreground"
                    title={m.presente ? "Presente neste mês" : "Não presente neste mês"}
                  >
                    {formatMonthLabel(m.month)} {m.presente ? "✅" : "❌"}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </CollapsibleSection>
  );
}
