import { listIntegratedParticipants, listLeadersWithCafe } from "@/lib/services/integrated.service";
import { RedistributionRow } from "@/components/gestao-membros/redistribution-row";
import { SecaoRetratil } from "@/components/ui/SecaoRetratil";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";

type SearchParams = { search?: string; leaderId?: string };

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";

export default async function RedistribuicaoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  // A lista só aparece depois de uma busca: a tela é para quando surge a
  // necessidade de trocar alguém de café. Ver todas as participantes que já
  // estão nos cafés é papel do painel "Participantes Integradas".
  const temFiltro = Boolean(params.search?.trim() || params.leaderId);
  const [participants, leaders] = await Promise.all([
    temFiltro
      ? listIntegratedParticipants({ search: params.search?.trim(), leaderId: params.leaderId })
      : Promise.resolve([]),
    listLeadersWithCafe(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/gestao-membros" label="Gestão de Membros" />
      <div>
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-foreground">Redistribuição</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Busque quem precisa trocar de café
        </p>
      </div>

      <form className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3">
        <input name="search" placeholder="Buscar por nome" defaultValue={params.search} className={inputClass} />
        <select name="leaderId" defaultValue={params.leaderId ?? ""} className={inputClass}>
          <option value="">Todas as líderes</option>
          {leaders.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="btn btn-primary"
        >
          Filtrar
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {!temFiltro && (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">
              Digite o nome da participante ou escolha a líder atual para começar.
            </p>
          </Card>
        )}
        {temFiltro && participants.length === 0 && (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Nenhuma participante encontrada com esses filtros.</p>
          </Card>
        )}
        {participants.length > 0 && (
          <SecaoRetratil titulo="Resultados" contador={participants.length} abertoPorPadrao>
            <div className="flex flex-col gap-2">
              {participants.map((p) => (
                <RedistributionRow key={p.id} participant={p} leaders={leaders} />
              ))}
            </div>
          </SecaoRetratil>
        )}
      </div>
    </div>
  );
}
