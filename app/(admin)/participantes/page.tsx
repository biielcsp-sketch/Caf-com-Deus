import Link from "next/link";
import { Plus } from "lucide-react";
import {
  listParticipants,
  listActiveLeadersForSelect,
  listGroupsForSelect,
} from "@/lib/services/participants.service";
import { ParticipantsFilters } from "@/components/participantes/participants-filters";
import { ParticipantsTable } from "@/components/participantes/participants-table";
import { computeAttentionAlerts } from "@/lib/services/followup.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { BackLink } from "@/components/ui/BackLink";
import type { Enums } from "@/types/database.types";

type SearchParams = {
  search?: string;
  leaderId?: string;
  region?: string;
  status?: string;
  groupId?: string;
  enrolledFrom?: string;
  enrolledTo?: string;
};

export default async function ParticipantesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [participants, leaders, groups] = await Promise.all([
    listParticipants({
      search: params.search,
      leaderId: params.leaderId,
      region: params.region,
      status: params.status as Enums<"participant_status"> | undefined,
      groupId: params.groupId,
      enrolledFrom: params.enrolledFrom,
      enrolledTo: params.enrolledTo,
    }),
    listActiveLeadersForSelect(),
    listGroupsForSelect(),
  ]);
  const alertsMap = await computeAttentionAlerts(
    participants.map((p) => ({ id: p.id, status: p.status })),
  );

  return (
    <div>
      <BackLink href="/dashboard" label="Dashboard" />
      <PageHeader title="Participantes" description={`${participants.length} ${participants.length === 1 ? "encontrada" : "encontradas"}`}>
        <Link
          href="/participantes/novo"
          aria-label="Nova participante"
          className="glass-green flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
        >
          <Plus size={22} strokeWidth={2.2} />
        </Link>
      </PageHeader>

      <div className="mt-4">
        <ParticipantsFilters variant="admin" leaders={leaders} groups={groups} defaults={params} />
      </div>

      <div className="mt-4">
        <ParticipantsTable
          participants={participants}
          basePath="/participantes"
          alertsMap={alertsMap}
          canManage
        />
      </div>
    </div>
  );
}
