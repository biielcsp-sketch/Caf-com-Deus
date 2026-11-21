import Link from "next/link";
import { SecaoRetratil } from "@/components/ui/SecaoRetratil";
import type { listMeetings } from "@/lib/services/meetings.service";

type Meeting = Awaited<ReturnType<typeof listMeetings>>[number];

const STATUS_LABELS: Record<string, string> = {
  planejado: "Planejado",
  confirmado: "Confirmado",
  realizado: "Realizado",
  cancelado: "Cancelado",
};

// Encontro realizado com participantes vinculadas e presença ainda não
// registrada por inteiro. Marcar "Realizado" não cria presença — ela só
// existe depois da Chamada.
function chamadaPendente(m: Meeting) {
  if (m.status !== "realizado") return null;
  const total = m.participants_total;
  const registradas = m.attendance_registered;
  if (total === 0 || registradas >= total) return null;
  return { total, registradas };
}

export function MeetingsList({ meetings, basePath }: { meetings: Meeting[]; basePath: string }) {
  if (meetings.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Nenhum encontro cadastrado ainda.
      </p>
    );
  }

  // Totalizadores da lista que está na tela (respeitam os filtros).
  const porStatus = (s: string) => meetings.filter((m) => m.status === s).length;
  const realizados = meetings.filter((m) => m.status === "realizado");
  const totalPresencas = realizados.reduce((acc, m) => acc + m.attendance_present, 0);

  return (
    <div className="flex flex-col gap-2">
      <SecaoRetratil titulo="Totais">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Realizados", value: realizados.length },
          { label: "Cancelados", value: porStatus("cancelado") },
          { label: "Planejados / confirmados", value: porStatus("planejado") + porStatus("confirmado") },
          { label: "Presenças nos realizados", value: totalPresencas },
        ].map((t) => (
          <div key={t.label} className="rounded-xl border border-border bg-card p-3">
            <p className="text-xl font-semibold text-foreground">{t.value}</p>
            <p className="text-xs text-muted-foreground">{t.label}</p>
          </div>
        ))}
      </div>
      </SecaoRetratil>
      {meetings.map((m) => {
        const pendente = chamadaPendente(m);
        return (
        <Link
          key={m.id}
          href={`${basePath}/${m.id}`}
          className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 hover:bg-muted sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{m.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {m.group?.name} · {m.leader?.profile?.full_name}
            </p>
            {m.ministered_by && (
              <p className="truncate text-xs text-muted-foreground">
                Palavra: {m.ministered_by}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:shrink-0">
            <span className="text-xs text-muted-foreground">
              {new Date(`${m.date}T00:00:00`).toLocaleDateString("pt-BR")}
              {m.time ? ` · ${m.time.slice(0, 5)}` : ""}
            </span>
            <span className="text-xs text-foreground">
              <strong className="font-semibold">{m.participants_total}</strong> inscrita(s)
              {m.status === "realizado" && (
                <>
                  {" · "}
                  <strong className="font-semibold text-primary">{m.attendance_present}</strong> presente(s)
                </>
              )}
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
              {STATUS_LABELS[m.status]}
            </span>
            {pendente && (
              <span className="rounded-full bg-accent/30 px-2.5 py-1 text-xs font-medium text-foreground">
                Chamada pendente ({pendente.registradas}/{pendente.total})
              </span>
            )}
          </div>
        </Link>
        );
      })}
    </div>
  );
}
