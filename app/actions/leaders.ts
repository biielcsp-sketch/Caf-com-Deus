"use server";

import { revalidatePath } from "next/cache";
import {
  LeaderCreateSchema,
  LeaderProfileUpdateSchema,
  LeaderUpdateSchema,
} from "@/lib/validators/leader.schema";
import {
  createLeaderAccount,
  updateLeader,
  updateLeaderProfile,
  setLeaderStatus,
  deleteLeader,
} from "@/lib/services/leaders.service";
import { getCurrentProfile, isAdminRole } from "@/lib/services/profiles.service";
import { toUserMessage } from "@/lib/errors";
import type { FormActionState } from "@/app/actions/participants";

// O cadastro de líder não redireciona mais ao terminar: a tela precisa
// ficar de pé mostrando o que a pastora tem que enviar para a líder. A
// senha NÃO volta daqui de propósito — o formulário já a tem no próprio
// estado, então não há motivo para ela atravessar a rede uma segunda vez.
export type LeaderCreateState =
  | { status: "error"; error: string }
  | { status: "created"; leaderId: string; fullName: string; email: string }
  | undefined;

// Campo vazio precisa virar `null`, NUNCA `undefined`. O supabase-js serializa
// o update com JSON.stringify, e JSON.stringify descarta as chaves cujo valor é
// `undefined` — ou seja, a coluna nem entrava no PATCH e ficava com o valor
// antigo. Quem apagava o bairro errado de uma ficha via "Salvo." na tela e o
// bairro errado continuava no banco, em todos os campos opcionais do sistema.
// `null` é o que realmente limpa a coluna; os schemas zod desses campos são
// todos `.optional().nullable()`.
function readOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export async function createLeaderAction(
  _state: LeaderCreateState,
  formData: FormData,
): Promise<LeaderCreateState> {
  const profile = await getCurrentProfile();
  if (!isAdminRole(profile?.role)) {
    return { status: "error", error: "Apenas administradoras podem cadastrar líderes." };
  }

  const validated = LeaderCreateSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: readOptionalString(formData, "phone"),
    whatsapp: readOptionalString(formData, "whatsapp"),
    city: readOptionalString(formData, "city"),
    neighborhood: readOptionalString(formData, "neighborhood"),
    meeting_address: readOptionalString(formData, "meeting_address"),
    region: readOptionalString(formData, "region"),
    max_capacity: formData.get("max_capacity"),
    role: formData.get("role") || undefined,
  });

  if (!validated.success) {
    return {
      status: "error",
      error: validated.error.issues[0]?.message ?? "Verifique os campos do formulário.",
    };
  }

  let leader;
  try {
    leader = await createLeaderAccount(validated.data);
  } catch (e) {
    return {
      status: "error",
      error: toUserMessage(e, "actions.leaders.create", "Erro ao cadastrar líder."),
    };
  }

  revalidatePath("/liderancas");
  return {
    status: "created",
    leaderId: leader.id,
    fullName: validated.data.full_name,
    email: validated.data.email,
  };
}

// Um único "Salvar" grava as duas metades da tela: os dados da conta
// (profiles + e-mail de login) e os dados do café da líder (`leaders`).
// São tabelas diferentes, mas para a pastora é uma ficha só — dividir em
// dois botões só criaria a chance de salvar metade.
export async function updateLeaderAction(
  id: string,
  _state: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const profile = await getCurrentProfile();
  if (!isAdminRole(profile?.role)) {
    return { error: "Apenas administradoras podem alterar os dados da líder." };
  }

  const validatedProfile = LeaderProfileUpdateSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    phone: readOptionalString(formData, "phone"),
    whatsapp: readOptionalString(formData, "whatsapp"),
  });

  if (!validatedProfile.success) {
    return {
      error: validatedProfile.error.issues[0]?.message ?? "Verifique os campos do formulário.",
    };
  }

  const validated = LeaderUpdateSchema.safeParse({
    city: readOptionalString(formData, "city"),
    neighborhood: readOptionalString(formData, "neighborhood"),
    meeting_address: readOptionalString(formData, "meeting_address"),
    region: readOptionalString(formData, "region"),
    max_capacity: formData.get("max_capacity"),
    admin_notes: readOptionalString(formData, "admin_notes"),
  });

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Verifique os campos do formulário." };
  }

  try {
    // Conta primeiro: é a parte que pode falhar por e-mail duplicado. Se
    // falhar, nada foi gravado ainda e a pastora corrige e salva de novo.
    await updateLeaderProfile(id, validatedProfile.data);
    await updateLeader(id, validated.data);
  } catch (e) {
    return { error: toUserMessage(e, "actions.leaders.update", "Erro ao salvar.") };
  }

  revalidatePath(`/liderancas/${id}`);
  revalidatePath("/liderancas");
  revalidatePath("/contas");
  return { success: true };
}

// Mesmo tratamento do deleteLeaderAction logo abaixo: devolve o erro. Antes
// lançava, e o botão "Inativar" voltava ao normal sem nada acontecer e sem
// nenhuma explicação na tela.
export async function toggleLeaderStatusAction(
  id: string,
  currentStatus: "ativa" | "inativa",
): Promise<{ error?: string }> {
  const profile = await getCurrentProfile();
  if (!isAdminRole(profile?.role)) {
    return { error: "Apenas administradoras podem inativar líderes." };
  }

  try {
    await setLeaderStatus(id, currentStatus === "ativa" ? "inativa" : "ativa");
  } catch (e) {
    return { error: toUserMessage(e, "actions.leaders.toggleStatus", "Erro ao alterar o status da líder.") };
  }

  revalidatePath("/liderancas");
  revalidatePath(`/liderancas/${id}`);
  return {};
}

// Devolve o erro em vez de lançar: exceção dentro de Server Action não
// chega ao navegador em produção — o React substitui a mensagem por
// "Minified React error #441". Era o que aparecia no lugar da explicação
// real ("esta líder tem 1 café liderado por ela...").
export async function deleteLeaderAction(
  id: string,
): Promise<{ error?: string; loginRemovido?: boolean }> {
  const profile = await getCurrentProfile();
  if (!isAdminRole(profile?.role)) {
    return { error: "Apenas administradoras podem excluir líderes." };
  }

  try {
    const result = await deleteLeader(id);
    // Os cafés dela ficam sem líder: sem revalidar, a lista de cafés
    // continuava mostrando o nome de quem acabou de ser excluída.
    revalidatePath("/liderancas");
    revalidatePath("/grupos");
    revalidatePath("/cafes");
    return { loginRemovido: result.loginRemovido };
  } catch (e) {
    return { error: toUserMessage(e, "actions.leaders.delete", "Erro ao excluir a líder.") };
  }
}
