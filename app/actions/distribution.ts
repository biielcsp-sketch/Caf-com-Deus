"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { confirmDistribution } from "@/lib/services/distribution.service";
import { transferParticipant, returnParticipantToQueue } from "@/lib/services/transfer.service";
import { getCurrentProfile, isAdminRole } from "@/lib/services/profiles.service";
import { isPeopleManagerRole, isLeaderRole } from "@/lib/role-labels";
import { logAuthEvent, isRlsDenied } from "@/lib/services/auth-audit.service";
import { toUserMessage } from "@/lib/errors";
import type { FormActionState } from "@/app/actions/participants";

const GESTAO_PATH = "/gestao-membros";
const FILA_PATH = "/gestao-membros/novas-inscricoes";
const REDISTRIBUICAO_PATH = "/gestao-membros/redistribuicao";

// As duas actions deste arquivo DEVOLVEM o erro em vez de lançar. Exceção
// dentro de Server Action não chega ao navegador em produção: o React troca a
// mensagem por "Minified React error #441" e a tela inteira (a ficha da
// participante, a tela de distribuição) vira erro sem explicação.

export async function confirmDistributionAction(
  participantId: string,
  _state: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const profile = await getCurrentProfile();
  if (!isPeopleManagerRole(profile?.role)) {
    return { error: "Apenas a pastora ou a gestora de pessoas podem distribuir participantes." };
  }

  const leaderId = formData.get("leader_id") as string | null;
  const groupId = (formData.get("group_id") as string | null) || null;
  if (!leaderId) return { error: "Selecione uma líder." };

  try {
    await confirmDistribution(participantId, leaderId, groupId);
  } catch (e) {
    // Só dispara com bypass do isPeopleManagerRole acima — INSERT em
    // participant_leader_history só tem policy de admin e da gestora.
    if (isRlsDenied(e)) {
      await logAuthEvent("access_denied", profile!.id, { action: "confirmDistribution" });
    }
    return { error: toUserMessage(e, "actions.distribution.confirm", "Erro ao distribuir a participante.") };
  }

  revalidatePath(FILA_PATH);
  revalidatePath(REDISTRIBUICAO_PATH);
  revalidatePath(GESTAO_PATH);
  revalidatePath("/participantes");
  revalidatePath(`/participantes/${participantId}`);
  revalidatePath("/minhas-participantes");
  revalidatePath("/inicio");
  // Fora do try de propósito: `redirect()` funciona lançando NEXT_REDIRECT, e
  // um catch por cima engoliria a navegação. Volta para a fila (não para a
  // ficha da participante): a gestora não tem acesso à ficha e quem distribui
  // várias seguidas quer o próximo da lista.
  redirect(FILA_PATH);
}

export async function transferParticipantAction(
  participantId: string,
  _state: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const profile = await getCurrentProfile();
  if (!isPeopleManagerRole(profile?.role)) {
    return { error: "Apenas a pastora ou a gestora de pessoas podem transferir participantes." };
  }

  const leaderId = formData.get("leader_id") as string | null;
  const groupId = (formData.get("group_id") as string | null) || null;
  const reason = (formData.get("reason") as string | null) || null;
  if (!leaderId) return { error: "Selecione a nova líder." };

  try {
    await transferParticipant(participantId, leaderId, groupId, reason);
  } catch (e) {
    if (isRlsDenied(e)) {
      await logAuthEvent("access_denied", profile!.id, { action: "transferParticipant" });
    }
    return { error: toUserMessage(e, "actions.distribution.transfer", "Erro ao transferir a participante.") };
  }

  // A transferência muda o que a líder antiga e a nova enxergam: sem
  // revalidar as listas delas, a participante continuava aparecendo para a
  // líder de origem — caminho certo para duas ligações para a mesma pessoa.
  revalidatePath(REDISTRIBUICAO_PATH);
  revalidatePath(GESTAO_PATH);
  revalidatePath(`/participantes/${participantId}`);
  revalidatePath("/participantes");
  revalidatePath("/minhas-participantes");
  revalidatePath("/inicio");
  return { success: true };
}

// A líder (ou a administração) devolve a participante para a fila: o café não
// serve mais (mudou de dia/horário, por exemplo). Devolve o erro em vez de
// lançar, pelo mesmo motivo das outras actions deste arquivo.
export async function returnParticipantToQueueAction(
  participantId: string,
  reason: string,
): Promise<{ error?: string; success?: boolean }> {
  const profile = await getCurrentProfile();
  if (!profile || (!isLeaderRole(profile.role) && !isAdminRole(profile.role))) {
    return { error: "Você não tem permissão para devolver esta participante." };
  }

  const motivo = reason.trim().slice(0, 300);
  if (!motivo) return { error: "Informe o motivo para a pastora saber como redirecionar." };

  try {
    await returnParticipantToQueue(participantId, motivo);
  } catch (e) {
    if (isRlsDenied(e)) {
      await logAuthEvent("access_denied", profile.id, { action: "returnParticipantToQueue" });
      return { error: "Esta participante não está vinculada ao seu café." };
    }
    return { error: toUserMessage(e, "actions.distribution.returnToQueue", "Erro ao devolver a participante.") };
  }

  revalidatePath(`/participantes/${participantId}`);
  revalidatePath("/participantes");
  revalidatePath(FILA_PATH);
  revalidatePath(GESTAO_PATH);
  revalidatePath("/minhas-participantes");
  revalidatePath("/inicio");
  return { success: true };
}
