"use server";

import { revalidatePath } from "next/cache";
import { getBibleChapter, toggleBibleFavorite } from "@/lib/services/bible.service";
import { toUserMessage } from "@/lib/errors";

// Troca de capítulo sem recarregar a página inteira. Devolve o erro em vez de
// deixar a exceção subir: a API da Bíblia é externa e, fora do ar, quebrava o
// leitor inteiro ao virar a página.
export async function loadChapterAction(abbrev: string, chapter: number) {
  try {
    return await getBibleChapter(abbrev, chapter);
  } catch (e) {
    return { error: toUserMessage(e, "actions.bible.loadChapter", "Não foi possível carregar o capítulo.") };
  }
}

export async function toggleFavoriteAction(input: {
  bookAbbrev: string;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
}) {
  try {
    const result = await toggleBibleFavorite(input);
    revalidatePath("/biblia");
    return result;
  } catch (e) {
    return { error: toUserMessage(e, "actions.bible.toggleFavorite", "Não foi possível salvar o favorito.") };
  }
}
