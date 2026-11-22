import Link from "next/link";
import { Plus } from "lucide-react";
import { listParticipantsPage } from "@/lib/services/participants.service";
import { getMyLeaderContext } from "@/lib/services/leaders.service";
import { ParticipantsFilters } from "@/components/participantes/participants-filters";
import { ParticipantsTable } from "@/components/participantes/participants-table";
import { computeAttentionAlerts } from "@/lib/services/followup.service";
import { SecaoRetratil } from "@/components/ui/SecaoRetratil";
import { Pagination } from "@/components/ui/Pagination";
import { BackLink } from "@/components/ui/BackLink";
import type { Enums } from "@/types/database.types";

type SearchParams = { search?: string; status?: string; page?: string };

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
  const result = leader
    ? await listParticipantsPage(
        {
          search: params.search,
          status: params.status as Enums<"participant_status"> | undefined,
          leaderId: leader.leaderId,
        },
        Number(params.page) || 1,
      )
    : null;
  const participants = result?.items ?? [];
  const alertsMap = await computeAttentionAlerts(
    participants.map((p) => ({ id: p.id, status: p.status })),
  );

  return (
    <div>
      <BackLink href="/inicio" label="Início" />
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-foreground">Minhas participantes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {leader
              ? "Mulheres sob a sua responsabilidade"
              : "Sua conta ainda não está vinculada a um café."}
          </p>
        </div>
        <Link
          href="/minhas-participantes/nova"
          aria-label="Nova participante"
          className="btn btn-primary btn-icon shrink-0"
        >
          <Plus size={18} strokeWidth={2.2} />
        </Link>
      </div>

      <div className="mt-4">
        <SecaoRetratil
          titulo="Participantes"
          contador={result?.total ?? 0}
          abertoPorPadrao={Object.values(params).some(Boolean)}
        >
          <div className="flex flex-col gap-4">
            <ParticipantsFilters variant="lider" defaults={params} />
            <ParticipantsTable participants={participants} basePath="/minhas-participantes" alertsMap={alertsMap} />
            {result && (
              <Pagination
                basePath="/minhas-participantes"
                params={params}
                page={result.page}
                totalPages={result.totalPages}
                total={result.total}
                pageSize={result.pageSize}
              />
            )}
          </div>
        </SecaoRetratil>
      </div>
    </div>
  );
}
