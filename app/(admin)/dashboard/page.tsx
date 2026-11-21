import { StatCard } from "@/components/dashboard/stat-card";
import { DashboardIndicadores } from "@/components/dashboard/dashboard-indicadores";
import { BackButton } from "@/components/ui/BackButton";
import { getMyDashboardIndicadores } from "@/lib/services/dashboard-preferences.service";
import { getAdminDashboard } from "@/lib/services/dashboard.service";
import { listPendingContacts } from "@/lib/services/contact-alerts.service";
import { PendingContactsCard } from "@/components/acompanhamento/pending-contacts-card";
import { getVapidPublicKey } from "@/lib/services/push.service";
import { PushOptIn } from "@/components/push-opt-in";

const ATTENDANCE_LABELS: Record<string, string> = {
  presente: "Presentes",
  ausente: "Ausentes",
  justificou: "Justificaram",
};

// % de presentes sobre todos os registros de frequência (só os 3 status conhecidos).
function pctPresentes(lista: { label: string; count: number }[]): string {
  const validos = lista.filter((a) => ATTENDANCE_LABELS[a.label]);
  const total = validos.reduce((soma, a) => soma + a.count, 0);
  const presentes = validos.find((a) => a.label === "presente")?.count ?? 0;
  return total > 0 ? `${Math.round((presentes / total) * 100)}%` : "—";
}

export default async function DashboardPage() {
  const [data, semContato, escolhidos] = await Promise.all([
    getAdminDashboard(),
    listPendingContacts({ somenteAtrasados: true }).catch(() => []),
    getMyDashboardIndicadores().catch(() => []),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <BackButton />
      <div>
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão geral da comunidade Café com Deus Shine
        </p>
      </div>

      <PushOptIn publicKey={getVapidPublicKey()} somenteConvite />
      <PendingContactsCard contacts={semContato} mode="gestao" />

      {/* Destaque: total de participantes */}
      <section
        aria-label="Participantes"
        className="glass-green relative overflow-hidden rounded-[1.625rem] p-5 md:max-w-xl"
      >
        <span aria-hidden className="pointer-events-none absolute -right-11 -top-14 h-[190px] w-[190px] rounded-full border border-accent/55" />
        <span aria-hidden className="pointer-events-none absolute -bottom-14 -left-10 h-[150px] w-[150px] rounded-full bg-white/[0.06]" />
        <p className="relative text-xs font-semibold uppercase tracking-[0.09em] text-[#ecd39d]">Participantes</p>
        <p className="font-display relative mt-1 text-[56px] font-semibold leading-none text-primary-foreground">
          {data.totalParticipants}
        </p>
        <p className="relative mt-2 text-sm text-primary-foreground/90">
          {data.activeParticipants} ativas · {data.activeLeaders} líderes ativas
        </p>
      </section>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Aguardando distribuição" value={data.awaitingDistribution} />
        <StatCard
          label="Presença média"
          value={data.averageAttendance !== null ? `${data.averageAttendance}%` : "—"}
        />
        <StatCard label="Precisam de contato" value={data.needingAttention} />
      </div>

      <DashboardIndicadores
        escolhidosIniciais={escolhidos}
        paineis={[
          { id: "regiao", titulo: "Por região", contador: data.byRegion.length, items: data.byRegion },
          { id: "lider", titulo: "Por líder", contador: data.byLeader.length, items: data.byLeader },
          {
            id: "grupo",
            titulo: "Ocupação por grupo",
            contador: data.byGroup.length,
            items: data.byGroup.map((g) => ({ label: `${g.name} (${g.occupied}/${g.capacity})`, count: g.occupied })),
          },
          {
            id: "frequencia",
            titulo: "Frequência",
            contador: pctPresentes(data.attendanceBreakdown),
            items: data.attendanceBreakdown
              .filter((a) => ATTENDANCE_LABELS[a.label])
              .map((a) => ({ label: ATTENDANCE_LABELS[a.label], count: a.count })),
          },
          {
            id: "inscricoes",
            titulo: "Inscrições por mês",
            contador: data.monthlyEvolution.reduce((soma, m) => soma + m.count, 0),
            items: data.monthlyEvolution.map((m) => ({ label: m.label, count: m.count })),
          },
        ]}
        indicadores={[
          { id: "encontros-mes", titulo: "Encontros no mês", valor: data.meetingsThisMonth },
          { id: "ativas", titulo: "Participantes ativas", valor: data.activeParticipants },
          { id: "lideres", titulo: "Líderes ativas", valor: data.activeLeaders },
          { id: "total", titulo: "Total de participantes", valor: data.totalParticipants },
        ]}
      />
    </div>
  );
}
