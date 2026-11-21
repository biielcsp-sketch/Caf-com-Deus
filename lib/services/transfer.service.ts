import "server-only";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/services/audit.service";
import { dbError } from "@/lib/errors";
import { getDefaultGroupIdForLeader } from "@/lib/services/groups.service";

// Transferência de participante já distribuída: fecha o vínculo aberto
// (end_date = hoje) e abre um novo — nunca sobrescreve o registro antigo.
// Não toca em meetings/follow_ups anteriores (item 14 da especificação).
//
// As três escritas (fechar vínculo, abrir vínculo, apontar a participante)
// eram feitas soltas, uma chamada por vez, sem transação. Se a do meio
// falhasse, a participante ficava sem NENHUM vínculo aberto — estado inválido
// que a constraint `one_open_assignment` não pega (ela impede dois abertos,
// não zero). É exatamente o bug que a v41 corrigiu na distribuição com uma
// função do Postgres; a transferência tinha ficado de fora. Agora usa a mesma
// solução: `app_transfer_participant`, atômica por natureza, SECURITY INVOKER
// (a RLS continua sendo a barreira real).
export async function transferParticipant(
  participantId: string,
  newLeaderId: string,
  newGroupId: string | null,
  reason: string | null,
) {
  const supabase = await createClient();

  // A tela de transferência manda `group_id` vazio: sem resolver o café da
  // nova líder aqui, a participante trocava de líder e perdia o café.
  const grupoFinal = newGroupId ?? (await getDefaultGroupIdForLeader(newLeaderId));

  const { error } = await supabase.rpc("app_transfer_participant", {
    p_participant_id: participantId,
    p_leader_id: newLeaderId,
    p_group_id: grupoFinal,
    p_reason: reason,
  } as unknown as Parameters<typeof supabase.rpc<"app_transfer_participant">>[1]);
  if (error) dbError(error, "transfer.participant");

  await logAuditEvent({
    action: "participant.transfer",
    entity: "participants",
    entityId: participantId,
    after: { new_leader_id: newLeaderId, new_group_id: grupoFinal, reason },
  });
}

// A líder (ou a administração) devolve a participante para a fila de
// distribuição — ex.: o café mudou de dia e ela não consegue mais. Tudo numa
// função do Postgres (fecha o vínculo, limpa líder/café, volta o status e
// grava o motivo); a autorização é conferida lá dentro.
export async function returnParticipantToQueue(participantId: string, reason: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("app_return_participant_to_queue", {
    p_participant_id: participantId,
    p_reason: reason,
  } as unknown as Parameters<typeof supabase.rpc<"app_return_participant_to_queue">>[1]);
  if (error) dbError(error, "transfer.returnToQueue");

  await logAuditEvent({
    action: "participant.return_to_queue",
    entity: "participants",
    entityId: participantId,
    after: { reason },
  });
}
