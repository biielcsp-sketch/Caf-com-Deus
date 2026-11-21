import { listIntegratedParticipants, listLeadersWithCafe } from "@/lib/services/integrated.service";
import { ParticipantDetailCard } from "@/components/gestao-membros/participant-detail-card";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { compareNames } from "@/lib/sort-by-name";

type SearchParams = { search?: string; leaderId?: string };

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";

// Quem já está num café, agrupado por café. Só leitura: trocar alguém de
// café é na Redistribuição.
export default async function IntegradasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [participants, leaders] = await Promise.all([
    listIntegratedParticipants({ search: params.search?.trim(), leaderId: params.leaderId }),
    listLeadersWithCafe(),
  ]);

  const grupos = new Map<string, { titulo: string; lider: string; itens: typeof participants }>();
  for (const p of participants) {
    const chave = p.cafe?.id ?? `sem-cafe-${p.leader.id}`;
    const g = grupos.get(chave) ?? {
      titulo: p.cafe?.name ?? "Sem café vinculado",
      lider: p.leader.name,
      itens: [],
    };
    g.itens.push(p);
    grupos.set(chave, g);
  }
  const ordenados = [...grupos.values()].sort((a, b) => compareNames(a.titulo, b.titulo));

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/gestao-membros" label="Gestão de Membros" />
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Participantes Integradas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {participants.length} participante(s) em {ordenados.length} café(s). Toque no cartão para ver todos os
          dados.
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
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Filtrar
        </button>
      </form>

      {ordenados.length === 0 && (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Nenhuma participante encontrada com esses filtros.</p>
        </Card>
      )}

      {ordenados.map((g) => (
        <section key={`${g.titulo}-${g.lider}`} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2 border-b border-border pb-1">
            <h2 className="text-sm font-semibold text-foreground">
              {g.titulo} <span className="font-normal text-muted-foreground">· {g.lider}</span>
            </h2>
            <span className="text-xs text-muted-foreground">{g.itens.length}</span>
          </div>
          {g.itens.map((p) => (
            <ParticipantDetailCard key={p.id} participant={p} />
          ))}
        </section>
      ))}
    </div>
  );
}
