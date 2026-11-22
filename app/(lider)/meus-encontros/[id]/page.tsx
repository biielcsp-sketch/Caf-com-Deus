import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { getMeeting, getMeetingParticipants, getGroupParticipantsNotInMeeting } from "@/lib/services/meetings.service";
import { listGroups } from "@/lib/services/groups.service";
import { getMyLeaderContext } from "@/lib/services/leaders.service";
import { MeetingForm } from "@/components/encontros/meeting-form";
import { MeetingParticipantsPanel } from "@/components/encontros/meeting-participants-panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { SecaoRetratil } from "@/components/ui/SecaoRetratil";
import { BackLink } from "@/components/ui/BackLink";

export default async function EncontroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meeting = await getMeeting(id);
  if (!meeting) notFound();

  // Só o café da própria líder no select — ver o comentário em
  // meus-encontros/novo: a liderança enxerga todos os cafés desde a policy
  // groups_lideranca_select, mas só pode agendar no seu.
  const contexto = await getMyLeaderContext();
  const [groups, linked, available] = await Promise.all([
    contexto ? listGroups({ leaderId: contexto.leaderId }) : Promise.resolve([]),
    getMeetingParticipants(id),
    getGroupParticipantsNotInMeeting(meeting.group_id, id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/meus-encontros" label="Encontros" />
      <PageHeader title={meeting.title}>
        <Link
          href={`/meus-encontros/${id}/presenca`}
          className="btn btn-primary"
        >
          <ClipboardCheck size={16} />
          Chamada
        </Link>
      </PageHeader>

      <SecaoRetratil titulo="Dados do encontro">
        <MeetingForm meeting={meeting} groups={groups} basePath="/meus-encontros" />
      </SecaoRetratil>

      <SecaoRetratil titulo="Participantes vinculadas" contador={linked.length}>
        <MeetingParticipantsPanel meetingId={id} basePath="/meus-encontros" linked={linked} available={available} />
      </SecaoRetratil>
    </div>
  );
}
