"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile, updateMyProfile } from "@/lib/services/profiles.service";
import { MyProfileSchema } from "@/lib/validators/my-profile.schema";
import { toUserMessage } from "@/lib/errors";

export type FormActionState = { error?: string; success?: boolean } | undefined;

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

export async function updateMyProfileAction(
  _state: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sessão expirada. Faça login novamente." };

  const validated = MyProfileSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: readOptionalString(formData, "phone"),
    whatsapp: readOptionalString(formData, "whatsapp"),
  });
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await updateMyProfile(validated.data);
  } catch (e) {
    return { error: toUserMessage(e, "actions.profile.updateMy", "Erro ao salvar seus dados.") };
  }

  revalidatePath("/", "layout");
  return { success: true };
}
