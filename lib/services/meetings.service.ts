import "server-only";
import { sortByName } from "@/lib/sort-by-name";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/services/audit.service";
import { AppError, dbError } from "@/lib/errors";
import type { MeetingInput } from "@/lib/validators/meeting.schema";
import type { Tables, TablesUpdate, Enums } from "@/types/database.types";

export type MeetingRow = Tables<"meetings">;

export type MeetingFilters = {
  search?: string;
  status?: Enums<"meeting_status">;
  leaderId?: string;
  groupId?: string;
  location?: string;
  dateFrom?: string;
  dateTo?: string;
};

export async function listMeetings(filters: MeetingFilters = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("meetings")
    .select("*, group:groups(id, name), leader:leaders(id, profile:profiles(full_name))")
    .order("date", { ascending: false })
    // Desempate: dois encontros no mesmo dia saíam em ordem arbitrária.
    .order("time", { ascending: false, nullsFirst: false });

  if (filters.search) {
    query = query.ilike("title", `%${filters.search}%`);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.leaderId) {
    query = query.eq("leader_id", filters.leaderId);
  }
  if (filters.groupId) {
    query = query.eq("group_id", filters.groupId);
  }
  if (filters.location) {
    query = query.ilike("location", `%${filters.location}%`);
  }
  if (filters.dateFrom) {
    query = query.gte("date", filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte("date", filters.dateTo);
  }

  const { data, error } = await query;

  if (error) dbError(error, "meetings.list");
  const meetings = data ?? [];

  // Totais para o aviso "Chamada pendente": encontro realizado em que ainda
  // não se marcou a presença de todas as vinculadas. Só vale presença já
  // informada (nao_informado não conta como chamada feita). Duas consultas
  // simples em vez de embutir contagem na principal.
  const ids = meetings.map((m) => m.id);
  const vinculadas = new Map<string, number>();
  const registradas = new Map<string, number>();
  const presentes = new Map<string, number>();
  if (ids.length > 0) {
    const [{ data: vinculos }, { data: presencas }] = await Promise.all([
      supabase.from("meeting_participants").select("meeting_id").in("meeting_id", ids),
      supabase
        .from("attendance")
        .select("meeting_id, status")
        .in("meeting_id", ids)
        .neq("status", "nao_informado"),
    ]);
    for (const v of vinculos ?? []) vinculadas.set(v.meeting_id, (vinculadas.get(v.meeting_id) ?? 0) + 1);
    for (const a of presencas ?? []) {
      registradas.set(a.meeting_id, (registradas.get(a.meeting_id) ?? 0) + 1);
      if (a.status === "presente") presentes.set(a.meeting_id, (presentes.get(a.meeting_id) ?? 0) + 1);
    }
  }

  return meetings.map((m) => ({
    ...m,
    participants_total: vinculadas.get(m.id) ?? 0,
    attendance_registered: registradas.get(m.id) ?? 0,
    attendance_present: presentes.get(m.id) ?? 0,
  }));
}

export async function listGroupMeetings(groupId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("group_id", groupId)
    .order("date", { ascending: true });

  if (error) dbError(error, "meetings.listGroupMeetings");
  return data ?? [];
}

export async function getMeeting(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select("*, group:groups(id, name), leader:leaders(id, profile:profiles(full_name))")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

export async function getMeetingParticipants(meetingId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meeting_participants")
    .select("id, participant:participants(id, full_name)")
    .eq("meeting_id", meetingId);
  if (error) dbError(error, "meetings.getParticipants");
  return sortByName(data ?? [], (mp) => mp.participant?.full_name);
}

// Participantes do grupo que ainda não estão vinculadas ao encontro.
export async function getGroupParticipantsNotInMeeting(groupId: string, meetingId: string) {
  const supabase = await createClient();
  const { data: linked, error: linkedError } = await supabase
    .from("meeting_participants")
    .select("participant_id")
    .eq("meeting_id", meetingId);
  if (linkedError) dbError(linkedError, "meetings.linkedParticipants");
  const linkedIds = (linked ?? []).map((l) => l.participant_id);

  let query = supabase
    .from("participants")
    .select("id, full_name")
    .eq("current_group_id", groupId)
    .is("deleted_at", null);
  if (linkedIds.length > 0) {
    query = query.not("id", "in", `(${linkedIds.join(",")})`);
  }
  const { data, error } = await query;
  if (error) dbError(error, "meetings.groupParticipantsNotInMeeting");
  return sortByName(data ?? [], (p) => p.full_name);
}

export async function createMeeting(input: MeetingInput) {
  const supabase = await createClient();

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id, name, leader_id")
    .eq("id", input.group_id)
    .single();
  if (groupError || !group) throw new AppError("Grupo não encontrado.");

  // `meetings.leader_id` é obrigatório — todo encontro tem uma responsável
  // pela chamada e pelo acompanhamento do que aconteceu ali. Um café sem
  // líder (a anterior foi excluída) não tem quem colocar nesse campo, então
  // recusamos com uma mensagem que diz o que fazer, em vez de deixar o
  // Postgres devolver violação de not-null.
  if (!group.leader_id) {
    throw new AppError(
      `O café ${group.name} está sem líder responsável. Atribua uma líder a ele antes de agendar encontros.`,
    );
  }

  const { data: meeting, error } = await supabase
    .from("meetings")
    .insert({
      title: input.title,
      date: input.date,
      time: input.time || null,
      location: input.location || null,
      ministered_by: input.ministered_by || null,
      status: input.status ?? "planejado",
      group_id: group.id,
      leader_id: group.leader_id,
    })
    .select()
    .single();
  if (error) dbError(error, "meetings.create");

  // Vincula automaticamente todas as participantes atuais do grupo.
  const { data: groupParticipants, error: participantsError } = await supabase
    .from("participants")
    .select("id")
    .eq("current_group_id", group.id)
    .is("deleted_at", null);
  if (participantsError) dbError(participantsError, "meetings.create.participants");

  if (groupParticipants && groupParticipants.length > 0) {
    // O erro deste insert era descartado: o encontro era criado com sucesso e
    // a chamada abria vazia, sem ninguém saber por quê.
    const { error: vinculoError } = await supabase.from("meeting_participants").insert(
      groupParticipants.map((p) => ({ meeting_id: meeting.id, participant_id: p.id })),
    );
    if (vinculoError) dbError(vinculoError, "meetings.create.linkParticipants");
  }

  await logAuditEvent({
    action: "meeting.create",
    entity: "meetings",
    entityId: meeting.id,
    after: { title: input.title, date: input.date, group_id: group.id },
  });

  return meeting;
}

export async function updateMeeting(id: string, input: TablesUpdate<"meetings">) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("meetings").update(input).eq("id", id).select().single();
  if (error) dbError(error, "meetings.update");

  await logAuditEvent({ action: "meeting.update", entity: "meetings", entityId: id, after: input });
  return data;
}

export async function addMeetingParticipant(meetingId: string, participantId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("meeting_participants")
    .insert({ meeting_id: meetingId, participant_id: participantId });
  if (error) dbError(error, "meetings.addParticipant");
}

export async function removeMeetingParticipant(meetingParticipantId: string) {
  const supabase = await createClient();
  // `count: "exact"`: DELETE negado pela RLS não devolve erro, devolve zero
  // linhas. Desde que a liderança passou a enxergar todos os cafés, outra
  // líder chega à tela de um encontro que não é dela — a participante sumia
  // da tela e voltava ao recarregar.
  const { error, count } = await supabase
    .from("meeting_participants")
    .delete({ count: "exact" })
    .eq("id", meetingParticipantId);
  if (error) dbError(error, "meetings.removeParticipant");
  if (!count) {
    throw new AppError("Você só pode alterar as participantes de um encontro do seu café.");
  }
}
