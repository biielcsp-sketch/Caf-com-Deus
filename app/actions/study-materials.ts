"use server";

import { revalidatePath } from "next/cache";
import {
  registerStudyMaterial,
  updateStudyMaterial,
  deleteStudyMaterial,
  getStudyMaterialUrl,
} from "@/lib/services/study-materials.service";
import { toUserMessage } from "@/lib/errors";

export type StudyMaterialActionState = { error?: string; success?: boolean } | undefined;

// O arquivo não passa por aqui — ele vai do navegador direto para o Supabase
// Storage, e esta ação só grava a linha depois. Ver o comentário longo em
// study-materials.service.ts sobre por que o caminho antigo (arquivo dentro
// do FormData da Server Action) não funcionava para PDF.
export async function registerStudyMaterialAction(input: {
  storagePath: string;
  title: string;
  description?: string | null;
  referenceMonth: string;
  fileName: string;
}): Promise<StudyMaterialActionState> {
  try {
    await registerStudyMaterial(input);
    revalidatePath("/estudos");
    revalidatePath("/feed");
    return { success: true };
  } catch (e) {
    return {
      error: toUserMessage(e, "actions.studyMaterials.register", "Não foi possível enviar o material."),
    };
  }
}

export async function updateStudyMaterialAction(
  id: string,
  input: { title: string; description?: string | null; referenceMonth: string },
): Promise<StudyMaterialActionState> {
  try {
    await updateStudyMaterial(id, input);
    revalidatePath("/estudos");
    revalidatePath("/feed");
    return { success: true };
  } catch (e) {
    return {
      error: toUserMessage(e, "actions.studyMaterials.update", "Não foi possível salvar as alterações."),
    };
  }
}

// Devolve o erro em vez de lançar: o serviço recusa quem não é admin, e a
// exceção fazia a remoção falhar em silêncio — o card continuava na tela sem
// ninguém explicar por quê.
export async function deleteStudyMaterialAction(id: string): Promise<{ error?: string }> {
  try {
    await deleteStudyMaterial(id);
  } catch (e) {
    return { error: toUserMessage(e, "actions.studyMaterials.delete", "Não foi possível remover o material.") };
  }
  revalidatePath("/estudos");
  revalidatePath("/feed");
  return {};
}

// A URL assinada é gerada sob demanda (dura 10 minutos) — nunca fica
// embutida no HTML da listagem, que é cacheável.
export async function getStudyMaterialUrlAction(storagePath: string) {
  return getStudyMaterialUrl(storagePath);
}
