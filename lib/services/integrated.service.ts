import "server-only";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/errors";
import { getOcupacaoAtual } from "@/lib/services/occupancy.service";
import { sortByName } from "@/lib/sort-by-name";
import type { Enums } from "@/types/database.types";

// Ficha completa de quem JÁ está num café — base das telas "Participantes
// Integradas" e "Redistribuição" da Gestão de Membros. A ideia é quem vai
// redistribuir reconhecer a pessoa e a líder sem precisar abrir outra tela:
// contato, endereço, o que ela pediu na inscrição, há quanto tempo está no
// café e quantas vezes veio.

export type CafeInfo = {
  id: string;
  name: string;
  available_days: string[];
  meeting_time: string | null;
  address: string | null;
  region: string | null;
  capacity: number | null;
};

export type IntegratedParticipant = {
  id: string;
  full_name: string;
  preferred_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  birth_date: string | null;
  city: string | null;
  neighborhood: string | null;
  address: string | null;
  availability_days: string[];
  availability_period: string[];
  location_preference: string | null;
  status: Enums<"participant_status">;
  enrollment_date: string | null;
  is_lagoinha_member: boolean | null;
  church_status: string | null;
  church_name: string | null;
  cep: string | null;
  current_leader_id: string;
  leader: { id: string; name: string; phone: string | null; whatsapp: string | null };
  cafe: CafeInfo | null;
  since: string | null;
  presencas: number;
  encontrosVinculados: number;
};

export type IntegratedFilters = { search?: string; leaderId?: string; groupId?: string };

export async function listIntegratedParticipants(filters: IntegratedFilters = {}) {
  const supabase = await createClient();

  let query = supabase
    .from("participants")
    .select(
      `id, full_name, preferred_name, phone, whatsapp, email, birth_date, city, neighborhood, address,
       availability_days, availability_period, location_preference, status, enrollment_date,
       is_lagoinha_member, church_status, church_name, cep, current_leader_id, anonymized_at,
       leader:leaders!participants_current_leader_id_fkey(id, profile:profiles(full_name, phone, whatsapp)),
       group:groups!participants_current_group_id_fkey(id, name, available_days, meeting_time, address, region, capacity)`,
    )
    .is("deleted_at", null)
    .is("anonymized_at", null)
    .not("current_leader_id", "is", null);

  if (filters.search) query = query.ilike("full_name", `%${filters.search}%`);
  if (filters.leaderId) query = query.eq("current_leader_id", filters.leaderId);
  if (filters.groupId) query = query.eq("current_group_id", filters.groupId);

  const { data, error } = await query;
  if (error) dbError(error, "integrated.list");
  const rows = data ?? [];
  const ids = rows.map((r) => r.id);

  // Início do vínculo atual e presença: uma consulta cada para a lista toda,
  // nunca uma por participante.
  const since = new Map<string, string>();
  const presencas = new Map<string, number>();
  const vinculados = new Map<string, number>();
  if (ids.length > 0) {
    const [hist, att, mp] = await Promise.all([
      supabase
        .from("participant_leader_history")
        .select("participant_id, start_date")
        .in("participant_id", ids)
        .is("end_date", null),
      supabase.from("attendance").select("participant_id, status").in("participant_id", ids),
      supabase.from("meeting_participants").select("participant_id").in("participant_id", ids),
    ]);
    if (hist.error) dbError(hist.error, "integrated.history");
    if (att.error) dbError(att.error, "integrated.attendance");
    if (mp.error) dbError(mp.error, "integrated.meetingParticipants");
    for (const h of hist.data ?? []) {
      const atual = since.get(h.participant_id);
      if (!atual || h.start_date > atual) since.set(h.participant_id, h.start_date);
    }
    for (const a of att.data ?? []) {
      if (a.status === "presente") presencas.set(a.participant_id, (presencas.get(a.participant_id) ?? 0) + 1);
    }
    for (const m of mp.data ?? []) {
      vinculados.set(m.participant_id, (vinculados.get(m.participant_id) ?? 0) + 1);
    }
  }

  const list: IntegratedParticipant[] = rows.map((r) => ({
    id: r.id,
    full_name: r.full_name,
    preferred_name: r.preferred_name,
    phone: r.phone,
    whatsapp: r.whatsapp,
    email: r.email,
    birth_date: r.birth_date,
    city: r.city,
    neighborhood: r.neighborhood,
    address: r.address,
    availability_days: r.availability_days ?? [],
    availability_period: r.availability_period ?? [],
    location_preference: r.location_preference,
    status: r.status,
    enrollment_date: r.enrollment_date,
    is_lagoinha_member: r.is_lagoinha_member,
    church_status: r.church_status,
    church_name: r.church_name,
    cep: r.cep,
    current_leader_id: r.current_leader_id as string,
    leader: {
      id: r.leader?.id ?? (r.current_leader_id as string),
      name: r.leader?.profile?.full_name ?? "—",
      phone: r.leader?.profile?.phone ?? null,
      whatsapp: r.leader?.profile?.whatsapp ?? null,
    },
    cafe: r.group
      ? {
          id: r.group.id,
          name: r.group.name,
          available_days: r.group.available_days ?? [],
          meeting_time: r.group.meeting_time,
          address: r.group.address,
          region: r.group.region,
          capacity: r.group.capacity,
        }
      : null,
    since: since.get(r.id) ?? null,
    presencas: presencas.get(r.id) ?? 0,
    encontrosVinculados: vinculados.get(r.id) ?? 0,
  }));

  return sortByName(list, (p) => p.full_name);
}

export type LeaderWithCafe = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  region: string | null;
  maxCapacity: number | null;
  ocupadas: number;
  cafes: CafeInfo[];
};

// Líderes ativas com o(s) café(s) de cada uma e a ocupação de hoje — para
// quem redistribui comparar o destino com o café atual antes de transferir.
export async function listLeadersWithCafe(): Promise<LeaderWithCafe[]> {
  const supabase = await createClient();
  const [{ data: leaders, error }, { data: groups, error: groupsError }, ocupacao] = await Promise.all([
    supabase
      .from("leaders")
      .select("id, region, city, neighborhood, max_capacity, profile:profiles(full_name, phone, whatsapp)")
      .eq("status", "ativa"),
    supabase
      .from("groups")
      .select("id, name, leader_id, available_days, meeting_time, address, region, capacity, status")
      .neq("status", "inativo"),
    getOcupacaoAtual(),
  ]);
  if (error) dbError(error, "integrated.leaders");
  if (groupsError) dbError(groupsError, "integrated.groups");

  const cafesPorLider = new Map<string, CafeInfo[]>();
  for (const g of groups ?? []) {
    if (!g.leader_id) continue;
    const lista = cafesPorLider.get(g.leader_id) ?? [];
    lista.push({
      id: g.id,
      name: g.name,
      available_days: g.available_days ?? [],
      meeting_time: g.meeting_time,
      address: g.address,
      region: g.region,
      capacity: g.capacity,
    });
    cafesPorLider.set(g.leader_id, lista);
  }

  return sortByName(
    (leaders ?? []).map((l) => ({
      id: l.id,
      name: l.profile?.full_name ?? "",
      phone: l.profile?.phone ?? null,
      whatsapp: l.profile?.whatsapp ?? null,
      region: l.region ?? l.city ?? l.neighborhood ?? null,
      maxCapacity: l.max_capacity,
      ocupadas: ocupacao.porLider.get(l.id) ?? 0,
      cafes: cafesPorLider.get(l.id) ?? [],
    })),
    (l) => l.name,
  );
}

export async function countIntegrated() {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("participants")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null)
    .is("anonymized_at", null)
    .not("current_leader_id", "is", null);
  if (error) dbError(error, "integrated.count");
  return count ?? 0;
}
