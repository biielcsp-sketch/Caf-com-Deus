import type { getParticipantAttendanceHistory } from "@/lib/services/attendance.service";

const STATUS_LABELS: Record<string, string> = {
  presente: "Presente",
  ausente: "Ausente",
  justificou: "Justificou",
  nao_informado: "Não informado",
};

type AttendanceRecord = Awaited<ReturnType<typeof getParticipantAttendanceHistory>>[number];

function formatMonthLabel(month: string) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

/** Agrupa o histórico de presença por mês (AAAA-MM). Presente = compareceu a pelo menos um encontro no mês. */
export function agruparPresencaPorMes(history: AttendanceRecord[]) {
  const porMes = new Map<string, boolean>();
  for (const registro of history) {
    if (!registro.meeting) continue;
    const mes = registro.meeting.date.slice(0, 7);
    const presente = registro.status === "presente";
    porMes.set(mes, (porMes.get(mes) ?? false) || presente);
  }
  return Array.from(porMes.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, presente]) => ({ month, presente }));
}

function MonthlyAttendanceChecklist({ history }: { history: AttendanceRecord[] }) {
  const meses = agruparPresencaPorMes(history);

  if (meses.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap gap-1.5">
      {meses.map((m) => (
        <span
          key={m.month}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs capitalize text-foreground"
          title={m.presente ? "Presente neste mês" : "Não presente neste mês"}
        >
          {formatMonthLabel(m.month)} {m.presente ? "✅" : "❌"}
        </span>
      ))}
    </div>
  );
}

export function AttendanceHistory({ history }: { history: AttendanceRecord[] }) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum registro de presença ainda.</p>;
  }

  return (
    <div>
      <MonthlyAttendanceChecklist history={history} />
      <ul className="flex flex-col gap-2">
        {history.map((a) => (
          <li key={a.id} className="flex flex-col gap-0.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <span className="min-w-0 truncate text-foreground">
              {a.meeting?.title} — {new Date(`${a.meeting?.date}T00:00:00`).toLocaleDateString("pt-BR")}
            </span>
            <span className="shrink-0 text-muted-foreground">{STATUS_LABELS[a.status]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
