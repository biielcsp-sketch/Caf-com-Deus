"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { startImpersonation, stopImpersonation } from "@/lib/services/impersonation.service";
import { toUserMessage } from "@/lib/errors";

// Devolve o erro em vez de lançar: exceção de Server Action não atravessa a
// fronteira servidor→cliente em produção.
export async function startImpersonationAction(profileId: string): Promise<{ error: string } | undefined> {
  if (!z.uuid().safeParse(profileId).success) return { error: "Conta inválida." };

  try {
    await startImpersonation(profileId);
  } catch (e) {
    return { error: toUserMessage(e, "actions.impersonation.start", "Não foi possível ver como essa conta.") };
  }
  // O "/" manda cada papel para a própria tela inicial.
  redirect("/");
}

export async function stopImpersonationAction() {
  let restored = false;
  try {
    restored = await stopImpersonation();
  } catch (e) {
    toUserMessage(e, "actions.impersonation.stop");
  }
  redirect(restored ? "/dashboard" : "/login");
}
