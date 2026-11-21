import "server-only";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/errors";

// Contadores do painel "Gestão de Membros". Só contagem (head: true) — a
// lista de cada fila é carregada na própria tela.
export async function getMemberManagementCounts() {
  const supabase = await createClient();

  const [novas, fila, integradas] = await Promise.all([
    supabase
      .from("participants")
      .select("*", { count: "exact", head: true })
      .eq("status", "nova_inscricao")
      .is("deleted_at", null),
    supabase
      .from("participants")
      .select("*", { count: "exact", head: true })
      .eq("status", "aguardando_distribuicao")
      .is("deleted_at", null),
    supabase
      .from("participants")
      .select("*", { count: "exact", head: true })
      .not("current_leader_id", "is", null)
      .is("deleted_at", null)
      .is("anonymized_at", null),
  ]);

  for (const r of [novas, fila, integradas]) {
    if (r.error) dbError(r.error, "memberManagement.counts");
  }

  return {
    novasInscricoes: novas.count ?? 0,
    aguardandoDistribuicao: fila.count ?? 0,
    integradas: integradas.count ?? 0,
  };
}
