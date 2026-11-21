"use server";

import { saveMyDashboardIndicadores } from "@/lib/services/dashboard-preferences.service";
import { toUserMessage } from "@/lib/errors";

export async function saveDashboardIndicadoresAction(ids: string[]): Promise<{ error?: string }> {
  try {
    await saveMyDashboardIndicadores(ids);
    return {};
  } catch (e) {
    return { error: toUserMessage(e, "actions.dashboard.prefs", "Não foi possível salvar a personalização.") };
  }
}
