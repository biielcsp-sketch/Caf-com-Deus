import "server-only";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/services/audit.service";
import { getOcupacaoAtual } from "@/lib/services/occupancy.service";
import { getDefaultGroupIdForLeader } from "@/lib/services/groups.service";
import { AppError, dbError } from "@/lib/errors";

export type DistributionWeights = {
  disponibilidade: number;
  proximidade: number;
  capacidade: number;
  equilibrio: number;
  preferencias: number;
};

const DEFAULT_WEIGHTS: DistributionWeights = {
  disponibilidade: 40,
  proximidade: 25,
  capacidade: 15,
  equilibrio: 10,
  preferencias: 10,
};

export async function getDistributionWeights(): Promise<DistributionWeights> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "distribution_weights")
    .maybeSingle();

  if (data?.value) return data.value as unknown as DistributionWeights;

  await supabase
    .from("app_config")
    .insert({ key: "distribution_weights", value: DEFAULT_WEIGHTS })
    .select()
    .maybeSingle();

  return DEFAULT_WEIGHTS;
}

// Função pura de distância — sem dependência externa (Prompt 4).
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function timeToPeriod(time: string | null): "manha" | "tarde" | "noite" | null {
  if (!time) return null;
  const hour = Number(time.split(":")[0]);
  if (Number.isNaN(hour)) return null;
  if (hour < 12) return "manha";
  if (hour < 18) return "tarde";
  return "noite";
}

export async function listAwaitingDistribution() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("participants")
    .select(
      "id, full_name, phone, city, neighborhood, availability_days, availability_period, location_preference, enrollment_date, return_reason, returned_at, returned_by_leader_id, preferred_name, whatsapp, email, birth_date, address, home_meeting_ok, is_lagoinha_member, church_status, church_name, cep, other_notes, enrollment_source",
    )
    .eq("status", "aguardando_distribuicao")
    // A exclusão não muda o status, só marca `deleted_at` — sem este filtro
    // a excluída voltava para a fila e podia ser distribuída a uma líder.
    .is("deleted_at", null)
    .order("enrollment_date", { ascending: true })
    // Desempate estável: sem isto, duas inscrições do mesmo dia trocavam de
    // lugar a cada carregamento da tela.
    .order("id", { ascending: true });

  if (error) dbError(error, "distribution.listAwaiting");
  const rows = data ?? [];

  // Nome da líder que devolveu a participante (sem FK no banco de propósito,
  // então a busca é separada).
  const leaderIds = [...new Set(rows.map((r) => r.returned_by_leader_id).filter((v): v is string => !!v))];
  const names = new Map<string, string>();
  if (leaderIds.length > 0) {
    const { data: leaders } = await supabase
      .from("leaders")
      .select("id, profile:profiles(full_name)")
      .in("id", leaderIds);
    for (const l of leaders ?? []) names.set(l.id, l.profile?.full_name ?? "líder");
  }

  // As sugestões vêm junto para a gestora escolher a líder na própria fila.
  // Antes cada linha era um link para uma tela individual, que foi removida
  // (09/10/2026) — aprovar e distribuir acontecem na mesma tela agora.
  // É uma chamada de suggestLeaders por participante; a fila é curta por
  // natureza (quem está nela sai assim que recebe um café), mas se um dia
  // crescer muito, é aqui que dói.
  return Promise.all(
    rows.map(async (r) => ({
      ...r,
      returned_by_name: r.returned_by_leader_id ? (names.get(r.returned_by_leader_id) ?? null) : null,
      suggestions: (await suggestLeaders(r.id)).suggestions,
    })),
  );
}

export type AwaitingDistributionItem = Awaited<ReturnType<typeof listAwaitingDistribution>>[number];

export type LeaderSuggestion = {
  leaderId: string;
  leaderName: string;
  groupId: string | null;
  groupName: string | null;
  score: number;
  breakdown: {
    criterio: string;
    peso: number;
    valor: number; // 0-1 antes do peso
    pontos: number;
  }[];
};

export async function suggestLeaders(participantId: string): Promise<{
  participant: { id: string; full_name: string };
  suggestions: LeaderSuggestion[];
  eligibleCount: number;
}> {
  const supabase = await createClient();
  const weights = await getDistributionWeights();

  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("id, full_name, city, neighborhood, availability_days, availability_period, location_preference")
    .eq("id", participantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (participantError || !participant) throw new AppError("Participante não encontrada.");

  // Filtros obrigatórios: líder ativa com vagas restantes.
  const { data: leaders, error: leadersError } = await supabase
    .from("leaders")
    .select(
      "id, city, neighborhood, region, max_capacity, profile:profiles(full_name), groups(id, name, status, capacity, available_days, meeting_time, region)",
    )
    .eq("status", "ativa");
  if (leadersError) dbError(leadersError, "distribution.suggestLeaders");

  // Ocupação sem as excluídas. A contagem embutida contava participante já
  // excluída (ela mantém `current_leader_id`), e como este filtro descarta
  // quem está com `occupied >= max_capacity`, uma líder com vaga real ficava
  // fora das sugestões — chegando a "nenhuma líder elegível" com vaga
  // sobrando.
  const { porLider, porGrupo } = await getOcupacaoAtual();

  const eligible = (leaders ?? [])
    .map((l) => ({ ...l, occupied: porLider.get(l.id) ?? 0 }))
    .filter((l) => l.occupied < l.max_capacity);

  // Média de participantes por grupo ativo — para o critério de equilíbrio.
  //
  // Revisão v41 (item 2.7): antes a média era tirada só dos grupos das
  // líderes ELEGÍVEIS (ativas e com vaga). Grupo lotado ficava de fora
  // justamente por estar cheio, o que puxava a média para baixo e fazia o
  // critério 4 pontuar menos para todo mundo. A arquitetura diz "média de
  // participantes por grupo ativo" — são todos os grupos ativos, não os que
  // sobraram do filtro.
  const { data: allActiveGroups, error: activeGroupsError } = await supabase
    .from("groups")
    .select("id")
    .eq("status", "ativo");
  if (activeGroupsError) dbError(activeGroupsError, "distribution.activeGroups");

  const activeGroups = allActiveGroups ?? [];
  const avgPerGroup =
    activeGroups.length > 0
      ? activeGroups.reduce((sum, g) => sum + (porGrupo.get(g.id) ?? 0), 0) / activeGroups.length
      : 0;

  const participantDays = participant.availability_days ?? [];
  const participantPeriods = participant.availability_period ?? [];

  const suggestions: LeaderSuggestion[] = eligible.map((leader) => {
    const primaryGroup = (leader.groups ?? []).find((g) => g.status === "ativo") ?? null;

    // 1. Disponibilidade (dias + período do grupo, se houver)
    let disponibilidade = 0.5; // neutro quando não há grupo pra comparar
    if (primaryGroup) {
      const groupDays = primaryGroup.available_days ?? [];
      const overlap = participantDays.filter((d) => groupDays.includes(d)).length;
      const dayScore = participantDays.length > 0 ? overlap / participantDays.length : 0.5;
      const groupPeriod = timeToPeriod(primaryGroup.meeting_time);
      const periodScore =
        participantPeriods.length > 0 && groupPeriod
          ? participantPeriods.includes(groupPeriod)
            ? 1
            : 0
          : 0.5;
      disponibilidade = (dayScore + periodScore) / 2;
    }

    // 2. Proximidade — sem geo_lat/lng em leaders/groups neste schema,
    // usa sempre a comparação textual (fallback já previsto na arquitetura).
    let proximidade = 0;
    if (participant.neighborhood && leader.neighborhood && participant.neighborhood.toLowerCase() === leader.neighborhood.toLowerCase()) {
      proximidade = 1;
    } else if (participant.city && leader.city && participant.city.toLowerCase() === leader.city.toLowerCase()) {
      proximidade = 0.5;
    }

    // 3. Capacidade da líder
    const capacidade = (leader.max_capacity - leader.occupied) / leader.max_capacity;

    // 4. Equilíbrio entre grupos
    let equilibrio = 0.5;
    if (primaryGroup && avgPerGroup > 0) {
      const occupied = porGrupo.get(primaryGroup.id) ?? 0;
      equilibrio = Math.max(0, Math.min(1, 1 - occupied / avgPerGroup));
    }

    // 5. Preferências cadastradas
    let preferencias = 0;
    const pref = participant.location_preference?.toLowerCase().trim();
    const region = leader.region?.toLowerCase().trim();
    if (pref && region) {
      if (pref === region) preferencias = 1;
      else if (region.includes(pref) || pref.includes(region)) preferencias = 0.5;
    }

    const breakdown = [
      { criterio: "Disponibilidade", peso: weights.disponibilidade, valor: disponibilidade, pontos: disponibilidade * weights.disponibilidade },
      { criterio: "Proximidade geográfica", peso: weights.proximidade, valor: proximidade, pontos: proximidade * weights.proximidade },
      { criterio: "Capacidade da líder", peso: weights.capacidade, valor: capacidade, pontos: capacidade * weights.capacidade },
      { criterio: "Equilíbrio entre grupos", peso: weights.equilibrio, valor: equilibrio, pontos: equilibrio * weights.equilibrio },
      { criterio: "Preferências cadastradas", peso: weights.preferencias, valor: preferencias, pontos: preferencias * weights.preferencias },
    ];

    return {
      leaderId: leader.id,
      leaderName: leader.profile?.full_name ?? "—",
      groupId: primaryGroup?.id ?? null,
      groupName: primaryGroup?.name ?? null,
      score: breakdown.reduce((sum, b) => sum + b.pontos, 0),
      breakdown,
    };
  });

  suggestions.sort((a, b) => b.score - a.score);

  return {
    participant: { id: participant.id, full_name: participant.full_name },
    suggestions: suggestions.slice(0, 3),
    eligibleCount: eligible.length,
  };
}

export async function confirmDistribution(
  participantId: string,
  leaderId: string,
  groupId: string | null,
) {
  const supabase = await createClient();

  // Sem café informado, resolve o café da líder aqui. A distribuição manual e
  // a aprovação de inscrição com líder fora das sugeridas mandavam o campo
  // vazio, e a participante ficava sem café nenhum.
  const grupoFinal = groupId ?? (await getDefaultGroupIdForLeader(leaderId));

  // Revisão v41 (item 2.6): as quatro escritas eram feitas em sequência,
  // uma chamada por vez, sem transação — e o fechamento do vínculo anterior
  // nem checava erro. Se a inserção do vínculo novo falhasse depois de o
  // antigo ter sido fechado, a participante ficava sem NENHUM vínculo
  // aberto: estado inválido que a constraint `one_open_assignment` não
  // detecta (ela impede dois abertos, não zero). Agora é uma função do
  // Postgres, que é atômica por natureza — ou tudo acontece, ou nada.
  // SECURITY INVOKER: a RLS continua sendo a barreira real, exatamente como
  // antes (só admin escreve em participant_leader_history).
  const { error } = await supabase.rpc("app_confirm_distribution", {
    p_participant_id: participantId,
    p_leader_id: leaderId,
    p_group_id: grupoFinal,
  } as unknown as Parameters<typeof supabase.rpc<"app_confirm_distribution">>[1]);
  if (error) dbError(error, "distribution.confirm");

  await logAuditEvent({
    action: "participant.distribute",
    entity: "participants",
    entityId: participantId,
    after: { leader_id: leaderId, group_id: grupoFinal },
  });
}
