"use server";

import { savePushSubscription, removePushSubscription, type PushSubscriptionInput } from "@/lib/services/push.service";
import { toUserMessage } from "@/lib/errors";

export async function savePushSubscriptionAction(input: PushSubscriptionInput): Promise<{ error?: string }> {
  try {
    await savePushSubscription(input);
    return {};
  } catch (e) {
    return { error: toUserMessage(e, "actions.push.save", "Não foi possível ativar as notificações neste aparelho.") };
  }
}

export async function removePushSubscriptionAction(endpoint: string): Promise<{ error?: string }> {
  try {
    await removePushSubscription(endpoint);
    return {};
  } catch (e) {
    return { error: toUserMessage(e, "actions.push.remove", "Não foi possível desativar.") };
  }
}
