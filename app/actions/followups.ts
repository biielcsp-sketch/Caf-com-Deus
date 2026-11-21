"use server";

import { revalidatePath } from "next/cache";
import { FollowUpSchema } from "@/lib/validators/followup.schema";
import { createFollowUp, updateFollowUp, softDeleteFollowUp } from "@/lib/services/followup.service";
import { getCurrentProfile, isAdminRole } from "@/lib/services/profiles.service";
import { createClient } from "@/lib/supabase/server";
import { toUserMessage } from "@/lib/errors";
import type { FormActionState } from "@/app/actions/participants";

export async function createFollowUpAction(
  participantId: string,
  basePath: string,
  _state: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const validated = FollowUpSchema.safeParse({
    date: formData.get("date"),
    type: formData.get("type"),
    status: formData.get("status") || undefined,
    observation: formData.get("observation"),
    needs_return: formData.get("needs_return") === "on",
    next_follow_up_date: formData.get("next_follow_up_date"),
  });

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Verifique os campos do formulário." };
  }

  const supabase = await createClient();
  const { data: leader } = await supabase
    .from("leaders")
    .select("id")
    .eq("profile_id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .maybeSingle();

  // Admin sem registro em `leaders` não tem um leader_id próprio; nesse
  // caso usa a líder atual da participante (follow_ups exige leader_id).
  let leaderId = leader?.id;
  if (!leaderId) {
    const { data: participant } = await supabase
      .from("participants")
      .select("current_leader_id")
      .eq("id", participantId)
      .single();
    leaderId = participant?.current_leader_id ?? undefined;
  }
  if (!leaderId) return { error: "Participante sem líder atribuída — não é possível registrar acompanhamento." };

  try {
    await createFollowUp(participantId, leaderId, validated.data);
  } catch (e) {
    return { error: toUserMessage(e, "actions.followups.create", "Erro ao registrar acompanhamento.") };
  }

  revalidatePath(`${basePath}/${participantId}`);
  // As filas de acompanhamento são outra rota: sem revalidá-las, a líder
  // registrava o contato na ficha e a pessoa continuava listada como pendente.
  revalidatePath("/acompanhamentos");
  revalidatePath("/meus-acompanhamentos");
  return { success: true };
}

// Editar / excluir: só pastora, Gestora de Pessoas e desenvolvedor (pedido de
// 17/10/2026). A RLS é a barreira real; isto é a porta.
async function podeGerenciar() {
  const profile = await getCurrentProfile();
  return isAdminRole(profile?.role);
}

export async function updateFollowUpAction(
  followUpId: string,
  basePath: string,
  participantId: string,
  _state: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  if (!(await podeGerenciar())) return { error: "Você não tem permissão para editar acompanhamentos." };
  const validated = FollowUpSchema.safeParse({
    date: formData.get("date"),
    type: formData.get("type"),
    status: formData.get("status") || undefined,
    observation: formData.get("observation"),
    needs_return: formData.get("needs_return") === "on",
    next_follow_up_date: formData.get("next_follow_up_date"),
  });
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Verifique os campos do formulário." };
  }
  try {
    await updateFollowUp(followUpId, validated.data);
  } catch (e) {
    return { error: toUserMessage(e, "actions.followups.update", "Erro ao salvar o acompanhamento.") };
  }
  revalidatePath(`${basePath}/${participantId}`);
  revalidatePath("/acompanhamentos");
  return { success: true };
}

export async function deleteFollowUpAction(
  followUpId: string,
  basePath: string,
  participantId: string,
): Promise<{ error?: string }> {
  if (!(await podeGerenciar())) return { error: "Você não tem permissão para excluir acompanhamentos." };
  try {
    await softDeleteFollowUp(followUpId);
  } catch (e) {
    return { error: toUserMessage(e, "actions.followups.delete", "Erro ao excluir o acompanhamento.") };
  }
  revalidatePath(`${basePath}/${participantId}`);
  revalidatePath("/acompanhamentos");
  return {};
}
