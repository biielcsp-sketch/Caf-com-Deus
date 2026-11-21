"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { GroupSchema } from "@/lib/validators/leader.schema";
import { createGroup, updateGroup, deleteGroup } from "@/lib/services/groups.service";
import { toUserMessage } from "@/lib/errors";
import type { FormActionState } from "@/app/actions/participants";

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

// Mesmo motivo do readOptionalString: desmarcar TODOS os checkboxes precisa
// gravar uma lista vazia, não sumir do payload e deixar a lista antiga.
function readArray(formData: FormData, key: string) {
  const values = formData.getAll(key).map(String).filter(Boolean);
  return values;
}

function parseGroupForm(formData: FormData) {
  return GroupSchema.safeParse({
    name: formData.get("name"),
    // Campo vazio vira `undefined` e o schema devolve null: café sem líder
    // é um estado aceito. `formData.get` devolveria "" e a validação de
    // uuid reprovaria.
    leader_id: readOptionalString(formData, "leader_id") ?? null,
    host_profile_id: readOptionalString(formData, "host_profile_id"),
    address: readOptionalString(formData, "address"),
    capacity: formData.get("capacity"),
    region: readOptionalString(formData, "region"),
    available_days: readArray(formData, "available_days"),
    meeting_time: readOptionalString(formData, "meeting_time"),
    status: formData.get("status") || undefined,
  });
}

export async function createGroupAction(
  _state: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const validated = parseGroupForm(formData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Verifique os campos do formulário." };
  }

  let group;
  try {
    group = await createGroup(validated.data);
  } catch (e) {
    return { error: toUserMessage(e, "actions.groups.create", "Erro ao criar grupo.") };
  }

  revalidatePath("/grupos");
  redirect(`/grupos/${group.id}`);
}

export async function updateGroupAction(
  id: string,
  _state: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const validated = parseGroupForm(formData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Verifique os campos do formulário." };
  }

  let enderecoNaoLocalizado = false;
  try {
    const salvo = await updateGroup(id, validated.data);
    enderecoNaoLocalizado = salvo.enderecoNaoLocalizado;
  } catch (e) {
    return { error: toUserMessage(e, "actions.groups.update", "Erro ao salvar grupo.") };
  }

  revalidatePath(`/grupos/${id}`);
  revalidatePath("/grupos");
  return {
    success: true,
    warning: enderecoNaoLocalizado
      ? "Salvo, mas o endereço não foi localizado no mapa, então o café está sem pino. Tente sem complemento (casa, apto) ou ajuste o ponto em Localização."
      : undefined,
  };
}

// Devolve o erro em vez de lançar — ver o comentário em
// components/admin/delete-button.tsx: exceção de Server Action chega ao
// navegador como "Minified React error #441", sem a explicação do que está
// travando a exclusão.
export async function deleteGroupAction(id: string): Promise<{ error?: string }> {
  try {
    await deleteGroup(id);
  } catch (e) {
    return { error: toUserMessage(e, "actions.groups.delete", "Erro ao excluir o café.") };
  }

  revalidatePath("/grupos");
  revalidatePath("/cafes");
  return {};
}
