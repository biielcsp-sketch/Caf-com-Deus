import "server-only";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/errors";

// Quantas participantes cada líder e cada café têm HOJE.
//   - Membro = quem faz parte do café. É o que ocupa vaga (`porLider`/`porGrupo`).
//   - Visitante (`is_visitor`) NÃO ocupa vaga (pedido da Gestora de Pessoas,
//     23/11/2026): vem em mapas à parte (`visitantesPorLider`/`visitantesPorGrupo`)
//     para as telas mostrarem "15 membros · 1 visitante".
//   - Inativa não conta em nenhum dos dois.
//
// Por que não usar o `occupants:participants!fk(count)` embutido no select,
// como era antes: uma participante excluída não é apagada do banco (só é
// anonimizada e ganha `deleted_at`), e continua apontando para a líder e para
// o café. A contagem embutida não filtrava `deleted_at`, então:
//   - a lista de lideranças mostrava "8/8 — sem vagas" com vaga real sobrando;
//   - e o motor de distribuição, que descarta quem está com `occupied >=
//     max_capacity`, chegava a dizer "nenhuma líder elegível" existindo vaga.
// Buscar as linhas e contar aqui deixa o filtro explícito e igual em todas as
// telas. O volume é pequeno (um ministério, não uma base de milhares).
export type Ocupacao = {
  porLider: Map<string, number>;
  porGrupo: Map<string, number>;
  visitantesPorLider: Map<string, number>;
  visitantesPorGrupo: Map<string, number>;
};

export async function getOcupacaoAtual(): Promise<Ocupacao> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("participants")
    .select("current_leader_id, current_group_id, is_visitor")
    .is("deleted_at", null)
    // Inativa libera a vaga (pedido da Gestora de Pessoas, 30/10/2026). Ela
    // continua vinculada à líder e ao café, com o histórico guardado; só deixa
    // de contar na lotação.
    .neq("status", "inativa");
  if (error) dbError(error, "occupancy.current");

  const porLider = new Map<string, number>();
  const porGrupo = new Map<string, number>();
  const visitantesPorLider = new Map<string, number>();
  const visitantesPorGrupo = new Map<string, number>();
  const somar = (mapa: Map<string, number>, chave: string | null) => {
    if (chave) mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
  };
  for (const p of data ?? []) {
    const leiaute = p.is_visitor
      ? { lider: visitantesPorLider, grupo: visitantesPorGrupo }
      : { lider: porLider, grupo: porGrupo };
    somar(leiaute.lider, p.current_leader_id);
    somar(leiaute.grupo, p.current_group_id);
  }
  return { porLider, porGrupo, visitantesPorLider, visitantesPorGrupo };
}
