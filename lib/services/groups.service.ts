import "server-only";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/services/audit.service";
import { AppError, dbError } from "@/lib/errors";
import { geocodeAddress } from "@/lib/geocoding";
import { getOcupacaoAtual } from "@/lib/services/occupancy.service";
import type { Tables, TablesInsert, TablesUpdate, Enums } from "@/types/database.types";

export type GroupRow = Tables<"groups">;

export type GroupFilters = {
  search?: string;
  status?: Enums<"group_status">;
  leaderId?: string;
  region?: string;
  createdFrom?: string;
  createdTo?: string;
};

// Café da líder, para quando a tela manda `group_id` vazio. Três formulários
// enviavam um campo oculto sempre em branco (transferência, distribuição
// manual e aprovação de inscrição com líder fora das sugeridas), e a
// participante acabava vinculada à líder e SEM café: sumia da lista do café e
// não aparecia para vincular a encontro. Resolver aqui, no servidor, conserta
// os três de uma vez e não depende de a tela lembrar de mandar o campo.
export async function getDefaultGroupIdForLeader(leaderId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("id, status")
    .eq("leader_id", leaderId)
    .order("name");
  if (error) dbError(error, "groups.defaultForLeader");
  const grupos = data ?? [];
  // Prefere um café ativo; se ela só tiver café inativo/lotado, usa o primeiro
  // mesmo assim — melhor vinculada a um café cheio do que a nenhum.
  return grupos.find((g) => g.status === "ativo")?.id ?? grupos[0]?.id ?? null;
}

export async function listGroups(filters: GroupFilters = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("groups")
    .select("*, leader:leaders(id, profile:profiles(full_name))")
    .order("name");

  if (filters.search) {
    query = query.ilike("name", `%${filters.search}%`);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.leaderId) {
    query = query.eq("leader_id", filters.leaderId);
  }
  if (filters.region) {
    query = query.ilike("region", `%${filters.region}%`);
  }
  // `created_at` é timestamptz e a string sem fuso era lida como UTC: filtrar
  // "até 30/09" excluía os cafés criados das 21h à meia-noite do dia 30 em
  // Brasília, e o começo do intervalo errava do mesmo jeito.
  if (filters.createdFrom) {
    query = query.gte("created_at", `${filters.createdFrom}T00:00:00-03:00`);
  }
  if (filters.createdTo) {
    query = query.lte("created_at", `${filters.createdTo}T23:59:59-03:00`);
  }

  const { data, error } = await query;

  if (error) dbError(error, "groups.list");

  const { porGrupo, visitantesPorGrupo } = await getOcupacaoAtual();

  return (data ?? []).map((g) => ({
    ...g,
    leader_name: g.leader?.profile?.full_name ?? null,
    // Café que ficou sem responsável (a líder foi excluída). Estado válido e
    // temporário, mas que precisa aparecer na tela até alguém assumir.
    semLider: g.leader_id === null,
    occupied: porGrupo.get(g.id) ?? 0,
    visitors: visitantesPorGrupo.get(g.id) ?? 0,
  }));
}

export async function getGroup(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("*, leader:leaders(id, profile:profiles(full_name))")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

// Geocodifica o endereço recém-digitado e devolve as coordenadas para
// gravar junto com o grupo, ou `null` se não achou/deu erro — nesse caso o
// salvamento segue normalmente sem pino, e a tela de Localização tenta de
// novo sozinha quando a pessoa abrir. Nunca bloqueia o cadastro/edição do
// café por causa de uma falha na busca de endereço.
async function geocodeParaSalvar(endereco: string): Promise<{ latitude: number; longitude: number } | null> {
  if (!endereco) return null;
  const resultado = await geocodeAddress(endereco);
  if ("error" in resultado) return null;
  return { latitude: resultado.latitude, longitude: resultado.longitude };
}

export async function createGroup(input: TablesInsert<"groups">) {
  const supabase = await createClient();
  if (input.capacity <= 0) throw new AppError("A capacidade precisa ser maior que zero.");

  // Marca o pino no mapa automaticamente a partir do endereço já digitado na
  // ficha do café — sem precisar visitar a tela de Localização.
  const endereco = [input.address, input.region].filter(Boolean).join(", ");
  const coordenadas = await geocodeParaSalvar(endereco);
  const payload = coordenadas ? { ...input, ...coordenadas } : input;

  const { data, error } = await supabase.from("groups").insert(payload).select().single();
  if (error) dbError(error, "groups.create");

  await logAuditEvent({ action: "group.create", entity: "groups", entityId: data.id, after: payload });
  return data;
}

export async function updateGroup(id: string, input: TablesUpdate<"groups">) {
  const supabase = await createClient();
  if (input.capacity !== undefined && input.capacity !== null && input.capacity <= 0) {
    throw new AppError("A capacidade precisa ser maior que zero.");
  }

  // Só busca coordenadas de novo se o endereço/região realmente mudaram
  // nesta edição — o formulário reenvia todos os campos a cada salvamento,
  // então comparar com o que já está gravado evita apagar um pino que a
  // pessoa tenha ajustado manualmente arrastando, só porque reenviou o
  // mesmo endereço de antes.
  let coordenadas: { latitude: number; longitude: number } | null = null;
  if (input.address !== undefined || input.region !== undefined) {
    const { data: atual } = await supabase
      .from("groups")
      .select("address, region, latitude, longitude")
      .eq("id", id)
      .single();
    const enderecoNovo = [
      input.address !== undefined ? input.address : atual?.address,
      input.region !== undefined ? input.region : atual?.region,
    ]
      .filter(Boolean)
      .join(", ");
    const enderecoAnterior = [atual?.address, atual?.region].filter(Boolean).join(", ");
    // Também tenta de novo quando o café ainda não tem pino: sem isso, salvar
    // o mesmo endereço outra vez nunca fazia nada (caso real: três salvamentos
    // seguidos sem efeito).
    const semPino = atual?.latitude == null || atual?.longitude == null;
    if (enderecoNovo && (enderecoNovo !== enderecoAnterior || semPino)) {
      coordenadas = await geocodeParaSalvar(enderecoNovo);
    }
  }
  const payload = coordenadas ? { ...input, ...coordenadas } : input;

  const { data, error } = await supabase.from("groups").update(payload).eq("id", id).select().single();
  if (error) dbError(error, "groups.update");

  await logAuditEvent({ action: "group.update", entity: "groups", entityId: id, after: payload });
  // Avisa quando o café tem endereço mas continua sem pino: a busca não achou o
  // texto. Só o endereço do café (`address` + `region`) move o pino.
  const enderecoNaoLocalizado = !!(data.address || data.region) && (data.latitude == null || data.longitude == null);
  return { ...data, enderecoNaoLocalizado };
}

// RLS (groups_admin_delete) já restringe o DELETE a admin — esta checagem é
// só para dar um erro claro em português em vez do erro cru de FK. As FKs de
// participants/participant_leader_history/meetings são "no action" (o
// Postgres recusaria mesmo sem esta checagem); a de cafe_photos é CASCADE,
// então sem checar aqui excluir um grupo apagaria em silêncio as fotos do
// mural postadas nele — não é uma escolha de produto, é sempre bloqueado.
export async function deleteGroup(id: string) {
  const supabase = await createClient();

  const [participantes, historico, encontros, fotos] = await Promise.all([
    // Sem `deleted_at`, uma participante já excluída travava a exclusão do
    // café com uma mensagem sobre alguém que não aparece em tela nenhuma.
    supabase
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("current_group_id", id)
      .is("deleted_at", null),
    supabase.from("participant_leader_history").select("id", { count: "exact", head: true }).eq("group_id", id),
    supabase.from("meetings").select("id", { count: "exact", head: true }).eq("group_id", id),
    supabase.from("cafe_photos").select("id", { count: "exact", head: true }).eq("group_id", id),
  ]);

  const vinculos: { rotulo: string; total: number }[] = [];
  for (const [rotulo, resultado] of [
    ["participante(s) neste grupo", participantes],
    ["registro(s) no histórico de vínculo", historico],
    ["encontro(s) registrado(s)", encontros],
    ["foto(s) publicada(s) no mural", fotos],
  ] as const) {
    if (resultado.error) dbError(resultado.error, "groups.delete.check");
    if (resultado.count && resultado.count > 0) {
      vinculos.push({ rotulo, total: resultado.count });
    }
  }

  if (vinculos.length > 0) {
    const lista = vinculos.map((v) => `${v.total} ${v.rotulo}`).join(", ");
    throw new AppError(
      `Não dá para excluir: este grupo tem ${lista}. Apagar levaria junto esse histórico. ` +
        'Transfira as participantes para outro grupo e, se ele não se reúne mais, use o status "Inativo".',
    );
  }

  const { error } = await supabase.from("groups").delete().eq("id", id);
  if (error) dbError(error, "groups.delete");

  await logAuditEvent({ action: "group.delete", entity: "groups", entityId: id, after: null });
}

// Cafés que esta conta recebe como anfitriã. Serve para a ficha da líder
// mostrar quando ela acumula os dois papéis — no banco "ser anfitriã" é
// isto: aparecer em groups.host_profile_id, e não um valor em
// profiles.role, que guarda só o papel principal.
export async function listGroupsHostedByProfile(profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, address")
    .eq("host_profile_id", profileId)
    .order("name");

  if (error) dbError(error, "groups.listHostedByProfile");
  return data ?? [];
}

// O `.select()` no fim não é enfeite: quando a RLS recusa o UPDATE, o
// Postgres não devolve erro — a linha simplesmente não entra no escopo e
// zero linhas são afetadas. Sem conferir o retorno, a tela diria
// "Localização salva" com nada salvo. Isso passou a ser alcançável quando a
// liderança começou a enxergar os cafés das outras (policy
// groups_lideranca_select): ver um café não dá direito de editar o ponto
// dele, e o certo é dizer isso em vez de fingir que deu certo.
export async function updateGroupLocation(id: string, latitude: number, longitude: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .update({ latitude, longitude })
    .eq("id", id)
    .select("id");
  if (error) dbError(error, "groups.updateLocation");
  if (!data || data.length === 0) {
    throw new AppError("Você só pode ajustar a localização do seu próprio café.");
  }

  await logAuditEvent({
    action: "group.update_location",
    entity: "groups",
    entityId: id,
    after: { latitude, longitude },
  });
}

export async function clearGroupLocation(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .update({ latitude: null, longitude: null })
    .eq("id", id)
    .select("id");
  if (error) dbError(error, "groups.clearLocation");
  if (!data || data.length === 0) {
    throw new AppError("Você só pode ajustar a localização do seu próprio café.");
  }

  await logAuditEvent({
    action: "group.clear_location",
    entity: "groups",
    entityId: id,
    after: { latitude: null, longitude: null },
  });
}
