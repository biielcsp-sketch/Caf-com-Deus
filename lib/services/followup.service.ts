import "server-only";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/services/audit.service";
import { AppError, dbError } from "@/lib/errors";
import type { FollowUpInput } from "@/lib/validators/followup.schema";
import type { Tables, Enums } from "@/types/database.types";

export type FollowUpRow = Tables<"follow_ups">;

export async function listFollowUps(participantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .select("*")
    .eq("participant_id", participantId)
    .is("deleted_at", null)
    .order("date", { ascending: false });
  if (error) dbError(error, "followup.list");
  return data ?? [];
}

export async function createFollowUp(participantId: string, leaderId: string, input: FollowUpInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .insert({
      participant_id: participantId,
      leader_id: leaderId,
      date: input.date,
      type: input.type,
      status: input.status ?? "normal",
      observation: input.observation || null,
      needs_return: input.needs_return ?? false,
      next_follow_up_date: input.next_follow_up_date || null,
    })
    .select()
    .single();
  if (error) dbError(error, "followup.create");

  await logAuditEvent({
    action: "followup.create",
    entity: "follow_ups",
    entityId: data.id,
    after: { participant_id: participantId, type: input.type, status: input.status },
  });
  return data;
}

// Edição pela pastora / gestora / desenvolvedor. A RLS de UPDATE é a barreira
// (app_is_admin() ou líder responsável); conferir as linhas afetadas pega o
// caso em que ela recusa em silêncio.
export async function updateFollowUp(id: string, input: FollowUpInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .update({
      date: input.date,
      type: input.type,
      status: input.status ?? "normal",
      observation: input.observation || null,
      needs_return: input.needs_return ?? false,
      next_follow_up_date: input.next_follow_up_date || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) dbError(error, "followup.update");
  if (!data || data.length === 0) throw new AppError("Acompanhamento não encontrado ou sem permissão para editar.");
  await logAuditEvent({ action: "followup.update", entity: "follow_ups", entityId: id, after: { ...input } });
}

// "Excluir" = esconder (deleted_at). Nunca DELETE em follow_ups (CLAUDE.md).
export async function softDeleteFollowUp(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("follow_ups")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) dbError(error, "followup.delete");
  if (!data || data.length === 0) throw new AppError("Acompanhamento não encontrado ou sem permissão para excluir.");
  await logAuditEvent({ action: "followup.delete", entity: "follow_ups", entityId: id, after: {} });
}

export type ParticipantAlerts = {
  precisaContato: boolean;
  acompanhamentoNecessario: boolean;
};

// Existe só para as telas não repetirem a condição. Os dois alertas vêm de
// FATO acontecido (faltou ao último encontro / faltou a dois seguidos).
export function precisaAtencaoPastoral(alerts?: ParticipantAlerts) {
  return !!alerts && (alerts.precisaContato || alerts.acompanhamentoNecessario);
}

// Alertas calculados a partir da presença real (nunca hardcoded).
//
// O terceiro alerta do item 12 da especificação, "sem acompanhamento recente",
// foi REMOVIDO em 09/10/2026 por decisão de produto: contato não é expectativa
// de rotina neste ministério. As participantes recebem os avisos dos cafés, e a
// líder não precisa manter contato periódico — o acompanhamento existe para
// situação especial. Um aviso que cobrava registro de contato só produzia
// ruído. Não reintroduza a partir da especificação sem falar com o usuário.
export async function computeAttentionAlerts(
  participants: { id: string; status: Enums<"participant_status"> }[],
): Promise<Map<string, ParticipantAlerts>> {
  const supabase = await createClient();
  const ids = participants.map((p) => p.id);
  const result = new Map<string, ParticipantAlerts>();
  if (ids.length === 0) return result;

  const { data: attendanceRows } = await supabase
    .from("attendance")
    .select("participant_id, status, meeting:meetings(date)")
    .in("participant_id", ids)
    .neq("status", "nao_informado");

  const attendanceByParticipant = new Map<string, { status: string; date: string }[]>();
  for (const row of attendanceRows ?? []) {
    if (!row.meeting) continue;
    const list = attendanceByParticipant.get(row.participant_id) ?? [];
    list.push({ status: row.status, date: row.meeting.date });
    attendanceByParticipant.set(row.participant_id, list);
  }
  for (const list of attendanceByParticipant.values()) {
    list.sort((a, b) => b.date.localeCompare(a.date));
  }

  for (const participant of participants) {
    // Inativa não é cobrada: faltar é esperado e o aviso só atrapalharia a
    // líder. Se ela voltar a ficar ativa, o aviso volta a ser calculado.
    if (participant.status === "inativa") {
      result.set(participant.id, { precisaContato: false, acompanhamentoNecessario: false });
      continue;
    }
    const history = attendanceByParticipant.get(participant.id) ?? [];
    const precisaContato = history.length > 0 && history[0].status === "ausente";

    let consecutiveAusente = 0;
    for (const entry of history) {
      if (entry.status === "ausente") consecutiveAusente++;
      else break;
    }
    const acompanhamentoNecessario = consecutiveAusente >= 2;

    result.set(participant.id, { precisaContato, acompanhamentoNecessario });
  }

  return result;
}
