import Link from "next/link";
import { Plus } from "lucide-react";
import { listParticipants } from "@/lib/services/participants.service";
import { getMyLeaderContext } from "@/lib/services/leaders.service";
import { ParticipantsFilters } from "@/components/participantes/participants-filters";
import { ParticipantsTable } from "@/components/participantes/participants-table";
import { computeAttentionAlerts } from "@/lib/services/followup.service";
import { BackLink } from "@/components/ui/BackLink";
import type { Enums } from "@/types/database.types";

type SearchParams = { search?: string; status?: string };

export default async function MinhasParticipantesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  // Filtro explícito pela líder logada. Antes a tela confiava só no RLS, e para
  // quem acumula o papel de líder com gestora de pessoas / administração o RLS
  // libera a base inteira — "Minhas participantes" mostrava todas as 277.
  const leader = await getMyLeaderContext();
  const participants = leader
    ? await listParticipants({
        search: params.search,
        status: params.status as Enums<"participant_status"> | undefined,
        leaderId: leader.leaderId,
      })
    : [];
  const alertsMap = await computeAttentionAlerts(
    participants.map((p) => ({ id: p.id, status: p.status })),
  );

  return (
    <div>
      <BackLink href="/inicio" label="Início" />
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Minhas participantes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {leader
              ? `${participants.length} participantes sob sua responsabilidade`
              : "Sua conta ainda não está vinculada a um café."}
          </p>
        </div>
        <Link
          href="/minhas-participantes/nova"
          className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          <Plus size={16} />
          Nova participante
        </Link>
      </div>

      <div className="mt-4">
        <ParticipantsFilters variant="lider" defaults={params} />
      </div>

      <div className="mt-4">
        <ParticipantsTable participants={participants} basePath="/minhas-participantes" alertsMap={alertsMap} />
      </div>
    </div>
  );
}
