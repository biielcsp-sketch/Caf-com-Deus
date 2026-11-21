"use server";

import { revalidatePath } from "next/cache";
import {
  countMyUnreadNotifications,
  listMyNotifications,
  markMyNotificationsRead,
} from "@/lib/services/notifications.service";
import { confirmParticipantContact } from "@/lib/services/contact-alerts.service";
import { toUserMessage } from "@/lib/errors";
import type { FormActionState } from "@/app/actions/participants";

// Lido pelo sino do menu ao abrir cada tela. Falha aqui nunca derruba a
// tela: o sino só some o número.
export async function getUnreadNotificationsCountAction(): Promise<number> {
  try {
    return await countMyUnreadNotifications();
  } catch {
    return 0;
  }
}

export async function markAllNotificationsReadAction(): Promise<void> {
  try {
    await markMyNotificationsRead();
  } catch {
    // sem efeito colateral: a lista continua como estava
  }
  revalidatePath("/notificacoes");
}

export async function markNotificationReadAction(id: string): Promise<void> {
  try {
    await markMyNotificationsRead([id]);
  } catch {
    // idem
  }
}

// "Já fiz contato" — a líder confirma que falou com a participante nova. A
// RPC só aceita a líder atual dela, pastora, desenvolvedor ou gestora.
export async function confirmContactAction(
  participantId: string,
  _state: FormActionState,
  _formData: FormData,
): Promise<FormActionState> {
  try {
    await confirmParticipantContact(participantId);
  } catch (e) {
    return { error: toUserMessage(e, "actions.confirmContact", "Não foi possível confirmar o contato.") };
  }
  revalidatePath("/inicio");
  revalidatePath("/dashboard");
  revalidatePath("/gestao-membros");
  revalidatePath("/notificacoes");
  return { success: true };
}

// Últimas notificações para o painel do sino. Marca como lidas as que o
// painel mostrou — a pessoa acabou de vê-las.
export async function openNotificationsPanelAction(): Promise<{
  itens: { id: string; title: string; body: string | null; link: string | null; read: boolean; created_at: string }[];
}> {
  try {
    const itens = await listMyNotifications(6);
    const naoLidas = itens.filter((n) => !n.read).map((n) => n.id);
    if (naoLidas.length > 0) await markMyNotificationsRead(naoLidas);
    return { itens };
  } catch {
    return { itens: [] };
  }
}
