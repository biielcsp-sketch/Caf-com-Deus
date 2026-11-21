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
        <h1 className="mt-3 text-2xl font-semibold text-foreground">
          Olá, {profile?.full_name.split(" ")[0]} 🌷
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

  return (
    <div className="flex flex-col gap-6">
      <BackButton />
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Olá, {profile?.full_name.split(" ")[0]} 🌷
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.participantCount} mulher(es) sob seu acompanhamento
        </p>
      </div>

      <PushOptIn publicKey={getVapidPublicKey()} somenteConvite />
      <PendingContactsCard contacts={pendentes} mode="lider" />

      {data.lastMeeting && data.lastMeetingSummary && (
        <Card className="p-5">
          <p className="text-sm font-semibold text-foreground">Último encontro</p>
          <p className="mb-3 text-xs text-muted-foreground">
            {data.lastMeeting.title} ·{" "}
            {new Date(`${data.lastMeeting.date}T00:00:00`).toLocaleDateString("pt-BR")}
          </p>
          {data.lastMeetingSummary.registradas === 0 ? (
            <p className="text-sm text-muted-foreground">
              A chamada deste encontro ainda não foi feita — por isso não há presentes nem ausentes.
            </p>
          ) : (
            <div className="flex gap-6">
              <div>
                <p className="text-xl font-semibold text-primary">{data.lastMeetingSummary.presentes}</p>
                <p className="text-xs text-muted-foreground">presentes</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-danger">{data.lastMeetingSummary.ausentes}</p>
                <p className="text-xs text-muted-foreground">ausentes</p>
              </div>
              {data.lastMeetingSummary.justificaram > 0 && (
                <div>
                  <p className="text-xl font-semibold text-foreground">{data.lastMeetingSummary.justificaram}</p>
                  <p className="text-xs text-muted-foreground">justificaram</p>
                </div>
              )}
            </div>
          )}
          {data.lastMeetingSummary.registradas < data.lastMeetingSummary.vinculadas && (
            <Link
              href={`/meus-encontros/${data.lastMeeting.id}/presenca`}
              className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Fazer chamada ({data.lastMeetingSummary.registradas}/{data.lastMeetingSummary.vinculadas})
            </Link>
          )}
        </Card>
      )}

      <Card className="p-5">
        <p className="mb-2 text-sm font-semibold text-foreground">Próximo encontro</p>
        {data.nextMeeting ? (
          <>
            <p className="text-sm text-foreground">
              {new Date(`${data.nextMeeting.date}T00:00:00`).toLocaleDateString("pt-BR")}
              {data.nextMeeting.time ? ` — ${data.nextMeeting.time.slice(0, 5)}` : ""}
              {data.nextMeeting.location ? ` — ${data.nextMeeting.location}` : ""}
            </p>
            <Link
              href={`/meus-encontros/${data.nextMeeting.id}`}
              className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Ver participantes
            </Link>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum encontro agendado.</p>
        )}
      </Card>

      {invite && <LeaderInviteCard code={invite.code} groupName={invite.groupName} />}

      <Card className="p-5">
        <p className="text-sm font-semibold text-foreground">Acompanhamentos</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.needingAttention === 0
            ? "Nenhuma participante precisa de atenção agora."
            : `${data.needingAttention} participante(s) faltaram ao último encontro.`}
        </p>
        <Link
          href="/meus-acompanhamentos"
          className="mt-3 inline-block rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Ver acompanhamentos
        </Link>
      </Card>
    </div>
  );
}
