import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/services/profiles.service";
import { ImpersonateButton } from "@/components/accounts/impersonate-button";
import { SecaoRetratil } from "@/components/ui/SecaoRetratil";
import { BackLink } from "@/components/ui/BackLink";
import { getLeader } from "@/lib/services/leaders.service";
import { listGroupsHostedByProfile } from "@/lib/services/groups.service";
import { listParticipants } from "@/lib/services/participants.service";
import { getMonthlyAttendanceForParticipants } from "@/lib/services/attendance.service";
import { LeaderEditForm } from "@/components/liderancas/leader-edit-form";
import { ToggleStatusButton } from "@/components/liderancas/toggle-status-button";
import { LeaderDeleteButton } from "@/components/liderancas/leader-delete-button";
import { ParticipantsTable } from "@/components/participantes/participants-table";
import { ParticipantsAttendanceAccordion } from "@/components/liderancas/participants-attendance-accordion";

export default async function LiderancaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const leader = await getLeader(id);
  if (!leader) notFound();
  const me = await getCurrentProfile();
  // "Ver como esta pessoa": só Desenvolvedor, nunca na própria conta.
  const canImpersonate = me?.role === "desenvolvedor" && leader.profile_id !== me.id;

  const [participants, hostedGroups] = await Promise.all([
    listParticipants({ leaderId: id }),
    listGroupsHostedByProfile(leader.profile_id),
  ]);
  const presencaPorMes = await getMonthlyAttendanceForParticipants(participants.map((p) => p.id));
  const participantsComPresenca = participants.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    anonymized_at: p.anonymized_at,
    months: presencaPorMes.get(p.id) ?? [],
  }));

  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/liderancas" label="Líderes" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-foreground">{leader.profile?.full_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {leader.profile?.email} · {leader.profile?.phone ?? "sem telefone"}
          </p>
          {hostedGroups.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              Também é anfitriã {hostedGroups.length === 1 ? "do café" : "dos cafés"}{" "}
              <span className="font-medium text-foreground">
                {hostedGroups.map((g) => g.name).join(", ")}
              </span>
              .
            </p>
          )}
        </div>
        <div className="btn-row shrink-0 items-start">
          {canImpersonate && (
            <ImpersonateButton profileId={leader.profile_id} name={leader.profile?.full_name ?? "esta líder"} compact />
          )}
          <ToggleStatusButton id={leader.id} status={leader.status} />
          <LeaderDeleteButton
            id={leader.id}
            nome={leader.profile?.full_name ?? "esta líder"}
            cafes={(leader.groups ?? []).map((g) => g.name)}
            redirectTo="/liderancas"
          />
        </div>
      </div>

      <SecaoRetratil titulo="Dados da liderança">
        <p className="mb-4 text-xs text-muted-foreground">
          Altere o que precisar e salve — dados da conta e do café são gravados juntos.
        </p>
        <LeaderEditForm leader={leader} />
      </SecaoRetratil>

      <SecaoRetratil titulo="Participantes sob responsabilidade" contador={participants.length}>
        <ParticipantsTable participants={participants} basePath="/participantes" />
      </SecaoRetratil>

      <ParticipantsAttendanceAccordion participants={participantsComPresenca} basePath="/participantes" />
    </div>
  );
}
