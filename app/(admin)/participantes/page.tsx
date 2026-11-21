import Link from "next/link";
import { Plus } from "lucide-react";
import {
  listParticipantsPage,
  listActiveLeadersForSelect,
  listGroupsForSelect,
} from "@/lib/services/participants.service";
import { ParticipantsFilters } from "@/components/participantes/participants-filters";
import { ParticipantsTable } from "@/components/participantes/participants-table";
import { computeAttentionAlerts } from "@/lib/services/followup.service";
import { Pagination } from "@/components/ui/Pagination";
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
  page?: string;
};

export default async function ParticipantesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [result, leaders, groups] = await Promise.all([
    listParticipantsPage(
      {
      search: params.search,
      leaderId: params.leaderId,
      region: params.region,
      status: params.status as Enums<"participant_status"> | undefined,
      groupId: params.groupId,
      enrolledFrom: params.enrolledFrom,
      enrolledTo: params.enrolledTo,
      },
      Number(params.page) || 1,
    ),
    listActiveLeadersForSelect(),
    listGroupsForSelect(),
  ]);
  const participants = result.items;
  const alertsMap = await computeAttentionAlerts(
    participants.map((p) => ({ id: p.id, status: p.status })),
  );

  return (
    <div>
      <BackLink href="/dashboard" label="Dashboard" />
      <PageHeader title="Participantes" description={`${result.total} ${result.total === 1 ? "encontrada" : "encontradas"}`}>
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
        <Pagination
          basePath="/participantes"
          params={params}
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          pageSize={result.pageSize}
        />
      </div>
    </div>
  );
}
