import "server-only";
import { createClient } from "@/lib/supabase/server";
import { AppError, dbError } from "@/lib/errors";
import { logAuditEvent } from "@/lib/services/audit.service";
import type { Enums } from "@/types/database.types";

export type ContactStatusHistoryEntry = {
  id: string;
  status: Enums<"contact_status">;
  note: string | null;
  created_at: string;
  changed_by_name: string | null;
};

export async function listContactStatusHistory(
  participantId: string,
): Promise<ContactStatusHistoryEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("participant_contact_status_history")
    .select("id, status, note, created_at, changed_by_profile:profiles(full_name)")
    .eq("participant_id", participantId)
    .order("created_at", { ascending: false });
  if (error) dbError(error, "contactStatus.list");

  return (data ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    note: row.note,
    created_at: row.created_at,
    changed_by_name: row.changed_by_profile?.full_name ?? null,
  }));
}

// Sempre registra uma entrada no histórico (mudando o estágio ou só
// anexando uma nota nova ao estágio atual) e mantém `participants.contact_status`
// sincronizado com a entrada mais recente.
export async function logContactStatus(
  participantId: string,
  status: Enums<"contact_status">,
  note: string | null,
  changedBy: string,
) {
  const supabase = await createClient();

  const { error: historyError } = await supabase
    .from("participant_contact_status_history")
    .insert({ participant_id: participantId, status, note, changed_by: changedBy });
  if (historyError) dbError(historyError, "contactStatus.logHistory");

  // `.select("id")` + checagem de linhas: quando a RLS nega um UPDATE, o
  // Postgres NÃO devolve erro — devolve zero linhas. Sem isto, o histórico
  // registrava o estágio novo e o badge da ficha continuava no antigo, com a
  // tela dizendo que salvou.
  const { data: atualizadas, error: updateError } = await supabase
    .from("participants")
    .update({ contact_status: status })
    .eq("id", participantId)
    .select("id");
  if (updateError) dbError(updateError, "contactStatus.updateParticipant");
  if (!atualizadas || atualizadas.length === 0) {
    throw new AppError("Você não tem permissão para alterar o estágio de contato desta participante.");
  }

  await logAuditEvent({
    action: "participant.contact_status",
    entity: "participants",
    entityId: participantId,
    after: { status, note },
  });
}
