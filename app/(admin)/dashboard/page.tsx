import { SecaoRetratil } from "@/components/ui/SecaoRetratil";
import { StatCard } from "@/components/dashboard/stat-card";
import { BarList } from "@/components/dashboard/bar-list";
import { BackButton } from "@/components/ui/BackButton";
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

export default async function DashboardPage() {
  const [data, semContato] = await Promise.all([
    getAdminDashboard(),
    listPendingContacts({ somenteAtrasados: true }).catch(() => []),
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

      <SecaoRetratil titulo="Participantes por região" contador={data.byRegion.length}>
        <BarList items={data.byRegion} />
      </SecaoRetratil>
      <SecaoRetratil titulo="Participantes por líder" contador={data.byLeader.length}>
        <BarList items={data.byLeader} />
      </SecaoRetratil>
      <SecaoRetratil titulo="Ocupação por grupo" contador={data.byGroup.length}>
        <BarList
          items={data.byGroup.map((g) => ({ label: `${g.name} (${g.occupied}/${g.capacity})`, count: g.occupied }))}
        />
      </SecaoRetratil>
      <SecaoRetratil titulo="Frequência (geral)">
        <BarList
          items={data.attendanceBreakdown
            .filter((a) => ATTENDANCE_LABELS[a.label])
            .map((a) => ({ label: ATTENDANCE_LABELS[a.label], count: a.count }))}
        />
      </SecaoRetratil>
      <SecaoRetratil titulo="Evolução mensal de inscrições">
        <BarList items={data.monthlyEvolution.map((m) => ({ label: m.label, count: m.count }))} />
      </SecaoRetratil>
    </div>
  );
}
