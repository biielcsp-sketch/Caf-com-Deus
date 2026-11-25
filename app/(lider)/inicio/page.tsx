import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { BackButton } from "@/components/ui/BackButton";
import { getCurrentProfile } from "@/lib/services/profiles.service";
import { getLeaderDashboard } from "@/lib/services/dashboard.service";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateMyLeaderEnrollmentSource } from "@/lib/services/enrollment-sources.service";
import { LeaderInviteCard } from "@/components/liderancas/leader-invite-card";
import { listPendingContacts } from "@/lib/services/contact-alerts.service";
import { PendingContactsCard } from "@/components/acompanhamento/pending-contacts-card";
import { getVapidPublicKey } from "@/lib/services/push.service";
import { PushOptIn } from "@/components/push-opt-in";
import { KpisDoCafe } from "@/components/inicio/kpis-do-cafe";

export default async function InicioPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data: leader } = await supabase
    .from("leaders")
    .select("id")
    .eq("profile_id", profile?.id ?? "")
    .maybeSingle();

  if (!leader) {
    return (
      <div>
        <BackButton />
        <h1 className="font-display mt-3 text-3xl font-semibold text-foreground">
          Olá, {profile?.full_name.split(" ")[0]}
        </h1>
        <Card className="mt-6 p-6">
          <p className="text-sm text-muted-foreground">
            Sua conta ainda não está vinculada a um registro de líder. Fale com a administradora.
          </p>
        </Card>
      </div>
    );
  }

  const [data, pendentes] = await Promise.all([
    getLeaderDashboard(leader.id),
    listPendingContacts({ leaderId: leader.id }).catch(() => []),
  ]);
  // O link nunca pode derrubar o painel: sem ele (líder inativa, falha no
  // banco) o card só não aparece.
  const invite = await getOrCreateMyLeaderEnrollmentSource().catch(() => null);

  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Sao_Paulo",
  });
  const hojeTexto = hoje.charAt(0).toUpperCase() + hoje.slice(1);
  const proximo = data.nextMeeting
    ? (() => {
        const d = new Date(`${data.nextMeeting.date}T00:00:00`).toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        });
        return d.charAt(0).toUpperCase() + d.slice(1);
      })()
    : null;

  return (
    <div className="flex flex-col gap-5">
      <BackButton />
      <div className="px-0.5">
        <p className="text-[13px] text-muted-foreground">{hojeTexto}</p>
        <h1 className="font-display mt-0.5 text-[32px] font-semibold leading-[1.1] tracking-tight text-foreground">
          Olá, {profile?.full_name.split(" ")[0]}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {data.participantCount} membro(s) no seu café
          {data.visitorCount > 0 && ` · ${data.visitorCount} visitante(s)`}
          {data.inactiveCount > 0 && ` · ${data.inactiveCount} inativa(s)`}
        </p>
      </div>

      <PushOptIn publicKey={getVapidPublicKey()} somenteConvite />
      <PendingContactsCard contacts={pendentes} mode="lider" />

      <KpisDoCafe
        membros={data.participantCount}
        vagas={data.maxCapacity}
        presencaUltimoEncontro={data.presencaUltimoEncontro}
        presencaNoMes={data.presencaNoMes}
        precisamAtencao={data.needingAttention}
        visitantes={data.visitorCount}
        inativas={data.inactiveCount}
      />

      {/* Destaque: próximo encontro */}
      <section
        aria-label="Próximo encontro"
        className="glass-green relative flex flex-col gap-3 overflow-hidden rounded-[1.625rem] p-5 md:max-w-xl"
      >
        <span aria-hidden className="pointer-events-none absolute -right-11 -top-14 h-[190px] w-[190px] rounded-full border border-accent/55" />
        <span aria-hidden className="pointer-events-none absolute -right-2 -top-5 h-[110px] w-[110px] rounded-full border border-accent/35" />
        <span aria-hidden className="pointer-events-none absolute -bottom-14 -left-10 h-[150px] w-[150px] rounded-full bg-white/[0.06]" />
        <p className="relative text-xs font-semibold uppercase tracking-[0.09em] text-[#ecd39d]">Próximo encontro</p>
        {data.nextMeeting && proximo ? (
          <>
            <p className="font-display relative text-[27px] font-semibold leading-[1.15] text-primary-foreground">
              {proximo}
            </p>
            <p className="relative text-sm text-primary-foreground/90">
              {data.nextMeeting.time ? data.nextMeeting.time.slice(0, 5) : "Horário a combinar"}
              {data.nextMeeting.location ? ` · ${data.nextMeeting.location}` : ""}
            </p>
            <Link
              href={`/meus-encontros/${data.nextMeeting.id}`}
              className="glass-gold relative mt-1 flex h-[46px] items-center justify-center rounded-full text-[15px] font-semibold text-[#2c2019]"
            >
              Ver participantes
            </Link>
          </>
        ) : (
          <p className="relative text-sm text-primary-foreground/90">Nenhum encontro agendado.</p>
        )}
      </section>

      {data.lastMeeting && data.lastMeetingSummary && (
        <Card className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-foreground">Último encontro</h2>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {data.lastMeetingSummary.registradas === 0
                ? "Chamada ainda não feita"
                : `${data.lastMeetingSummary.presentes} presentes · ${data.lastMeetingSummary.ausentes} ausentes`}
            </p>
          </div>
          {data.lastMeetingSummary.registradas < data.lastMeetingSummary.vinculadas && (
            <Link
              href={`/meus-encontros/${data.lastMeeting.id}/presenca`}
              className="btn btn-primary shrink-0"
            >
              Fazer chamada
            </Link>
          )}
        </Card>
      )}

      {invite && <LeaderInviteCard code={invite.code} groupName={invite.groupName} />}

      {data.needingAttention > 0 && (
        <Card className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-foreground">Acompanhamentos</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {data.needingAttention} faltaram ao último encontro
            </p>
          </div>
          <Link
            href="/meus-acompanhamentos"
            className="inline-flex h-11 shrink-0 items-center rounded-full border border-border bg-card px-5 text-sm font-semibold text-foreground"
          >
            Ver
          </Link>
        </Card>
      )}
    </div>
  );
}
