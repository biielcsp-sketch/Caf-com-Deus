import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdminRole } from "@/lib/services/profiles.service";
import { logAuditEvent } from "@/lib/services/audit.service";
import { AppError, dbError } from "@/lib/errors";
import {
  STUDY_BUCKET as BUCKET,
  STUDY_MAX_SIZE_BYTES as MAX_SIZE_BYTES,
  STUDY_ALLOWED_EXTENSIONS,
  STUDY_MIME_BY_EXTENSION,
  STUDY_PATH_PATTERN,
  studyFileExtension,
} from "@/lib/study-materials";

// Mesma disciplina do upload de avatar (S6): o Content-Type que o navegador
// manda é fácil de forjar, então conferimos os magic bytes de verdade e só
// aceitamos o que a lista permite.
const SIGNATURES: { mime: string; ext: string; test: (b: Uint8Array) => boolean }[] = [
  {
    mime: "application/pdf",
    ext: "pdf",
    test: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  },
  {
    // .docx / .xlsx são zip (PK\x03\x04) — a distinção fina entre eles vem
    // da extensão declarada, já validada contra a lista de permitidos.
    mime: "application/zip",
    ext: "zip",
    test: (b) => b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07),
  },
  {
    // .doc / .xls antigos (OLE2)
    mime: "application/x-ole-storage",
    ext: "ole",
    test: (b) =>
      b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0 &&
      b[4] === 0xa1 && b[5] === 0xb1 && b[6] === 0x1a && b[7] === 0xe1,
  },
  {
    mime: "image/jpeg",
    ext: "jpg",
    test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/png",
    ext: "png",
    test: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    mime: "image/webp",
    ext: "webp",
    test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

export type StudyMaterial = {
  id: string;
  title: string;
  description: string | null;
  reference_month: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  created_at: string;
  // Só preenchido quando o material em si é uma imagem — nesse caso a
  // miniatura é a própria imagem, sem precisar gerar nada. PDF/Word/Excel
  // não têm capa própria: a tela mostra um ícone colorido no lugar (ver
  // MaterialCover em study-materials-panel.tsx).
  thumbnail_url?: string | null;
};

// Lista os materiais do mês. A policy de SELECT libera para toda usuária
// autenticada — líder, co-líder, anfitriã e participante veem o mesmo.
export async function listStudyMaterials(): Promise<StudyMaterial[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("study_materials")
    .select("id, title, description, reference_month, file_name, mime_type, size_bytes, storage_path, created_at")
    .order("reference_month", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) dbError(error, "studyMaterials.list");

  // Miniatura só para os materiais que já são imagem — os outros tipos não
  // têm uma capa própria para mostrar (gerar uma a partir da primeira
  // página do PDF exigiria uma biblioteca nova, fora do que já está
  // instalado no projeto). O bucket é privado, então mesmo a miniatura
  // precisa de URL assinada.
  const materials = data ?? [];
  return Promise.all(
    materials.map(async (material) => {
      if (!material.mime_type.startsWith("image/")) return material;
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(material.storage_path, 60 * 10);
      return { ...material, thumbnail_url: signed?.signedUrl ?? null };
    }),
  );
}

// Link temporário de download — o bucket é privado, então nada é servido
// por URL pública; cada acesso gera uma URL assinada de curta duração.
export async function getStudyMaterialUrl(storagePath: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 10);
  if (error) dbError(error, "studyMaterials.signedUrl");
  return data?.signedUrl ?? null;
}

// O arquivo NÃO passa mais por aqui.
//
// Antes, a tela mandava o arquivo dentro do FormData de uma Server Action —
// e Server Action tem limite de corpo de 1MB por padrão no Next.js, abaixo
// ainda do limite da própria função serverless da hospedagem. O material do
// mês é um PDF: praticamente todo envio estourava o limite, e o que a
// pastora via era a página de erro do navegador, não uma mensagem do app.
// Nada disso aparecia como bug do código porque a requisição morria antes de
// chegar na aplicação.
//
// Agora o navegador envia direto para o Supabase Storage (a policy
// `estudos_admin_insert` é quem autoriza — só admin escreve nesse bucket) e
// só depois chama esta função, que grava a linha. É o mesmo desenho que o
// mural já usava para o Google Drive, e pela mesma razão.
//
// O que esta função NÃO confia: nada do que a tela mandou sobre o arquivo.
// Tamanho e tipo são lidos do próprio objeto no bucket, e os magic bytes são
// conferidos baixando só os primeiros bytes — a mesma disciplina do S6, que
// se perderia se o servidor deixasse de ver o arquivo.
export async function registerStudyMaterial(input: {
  storagePath: string;
  title: string;
  description?: string | null;
  referenceMonth: string; // "AAAA-MM"
  fileName: string;
}) {
  const profile = await getCurrentProfile();
  if (!isAdminRole(profile?.role)) {
    throw new AppError("Apenas administradoras podem enviar o estudo do mês.");
  }

  const title = input.title.trim();
  if (!title) throw new AppError("Dê um título ao material.");
  if (!/^\d{4}-\d{2}$/.test(input.referenceMonth)) {
    throw new AppError("Informe o mês de referência.");
  }

  const supabase = await createClient();

  // O caminho vem da tela, então é tratado como entrada: formato fixo e
  // prefixo obrigatoriamente igual ao mês declarado. Sem isso, uma linha
  // poderia apontar para qualquer objeto do bucket.
  const storagePath = input.storagePath;
  if (!STUDY_PATH_PATTERN.test(storagePath)) {
    await removeQuietly(supabase, storagePath);
    throw new AppError("Envio inválido. Recarregue a página e tente de novo.");
  }
  if (!storagePath.startsWith(`${input.referenceMonth}/`)) {
    await removeQuietly(supabase, storagePath);
    throw new AppError("Envio inválido. Recarregue a página e tente de novo.");
  }

  const declaredExt = studyFileExtension(storagePath);
  if (!STUDY_ALLOWED_EXTENSIONS.includes(declaredExt as (typeof STUDY_ALLOWED_EXTENSIONS)[number])) {
    await removeQuietly(supabase, storagePath);
    throw new AppError("Formato não aceito. Envie PDF, Word, Excel ou imagem.");
  }

  // Tamanho real, lido do bucket — não o que a tela disse que era.
  const { data: listed, error: listError } = await supabase.storage
    .from(BUCKET)
    .list(input.referenceMonth, { search: storagePath.split("/")[1], limit: 1 });
  if (listError) dbError(listError, "studyMaterials.stat");

  const object = listed?.[0];
  if (!object) throw new AppError("O arquivo não chegou ao servidor. Tente enviar de novo.");

  const sizeBytes = Number(object.metadata?.size ?? 0);
  if (sizeBytes <= 0) {
    await removeQuietly(supabase, storagePath);
    throw new AppError("O arquivo chegou vazio. Tente enviar de novo.");
  }
  if (sizeBytes > MAX_SIZE_BYTES) {
    await removeQuietly(supabase, storagePath);
    throw new AppError("O arquivo precisa ter no máximo 15MB.");
  }

  // Magic bytes: baixa só os 16 primeiros bytes por Range, não o arquivo
  // inteiro — a função não precisa carregar 15MB na memória para conferir a
  // assinatura.
  const head = await readFirstBytes(supabase, storagePath);
  if (!head || !SIGNATURES.some((sig) => sig.test(head))) {
    await removeQuietly(supabase, storagePath);
    throw new AppError("Arquivo inválido. Envie um PDF, Word, Excel ou imagem de verdade.");
  }

  const { data: inserted, error: insertError } = await supabase
    .from("study_materials")
    .insert({
      title,
      description: input.description?.trim() || null,
      reference_month: `${input.referenceMonth}-01`,
      storage_path: storagePath,
      file_name: input.fileName.slice(0, 200),
      mime_type: STUDY_MIME_BY_EXTENSION[declaredExt],
      size_bytes: sizeBytes,
      uploaded_by: profile!.id,
    })
    .select("id")
    .single();

  if (insertError) {
    // Não deixa arquivo órfão no bucket se a linha não entrou.
    await removeQuietly(supabase, storagePath);
    dbError(insertError, "studyMaterials.insert");
  }

  await logAuditEvent({
    action: "study_material.upload",
    entity: "study_materials",
    entityId: inserted!.id,
    after: { title, reference_month: input.referenceMonth },
  });
}

type StorageClient = Awaited<ReturnType<typeof createClient>>;

// Limpeza de arquivo órfão nunca pode derrubar o fluxo principal: se falhar,
// o que o usuário vê continua sendo o erro de verdade, não o da limpeza.
async function removeQuietly(supabase: StorageClient, storagePath: string) {
  try {
    await supabase.storage.from(BUCKET).remove([storagePath]);
  } catch (e) {
    console.error("[studyMaterials.removeQuietly]", e);
  }
}

async function readFirstBytes(
  supabase: StorageClient,
  storagePath: string,
): Promise<Uint8Array | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60);
  if (error || !data?.signedUrl) return null;

  try {
    const response = await fetch(data.signedUrl, { headers: { Range: "bytes=0-15" } });
    if (!response.ok && response.status !== 206) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch (e) {
    console.error("[studyMaterials.readFirstBytes]", e);
    return null;
  }
}

// Só os metadados — o arquivo em si não muda aqui. Trocar o arquivo é
// excluir e enviar de novo, para não perder a disciplina de conferência
// (tamanho, tipo, magic bytes) que só roda no envio.
export async function updateStudyMaterial(
  id: string,
  input: { title: string; description?: string | null; referenceMonth: string },
) {
  const profile = await getCurrentProfile();
  if (!isAdminRole(profile?.role)) {
    throw new AppError("Apenas administradoras podem editar o estudo do mês.");
  }

  const title = input.title.trim();
  if (!title) throw new AppError("Dê um título ao material.");
  if (!/^\d{4}-\d{2}$/.test(input.referenceMonth)) {
    throw new AppError("Informe o mês de referência.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("study_materials")
    .update({
      title,
      description: input.description?.trim() || null,
      reference_month: `${input.referenceMonth}-01`,
    })
    .eq("id", id);
  if (error) dbError(error, "studyMaterials.update");

  await logAuditEvent({
    action: "study_material.update",
    entity: "study_materials",
    entityId: id,
    after: { title, reference_month: input.referenceMonth },
  });
}

export async function deleteStudyMaterial(id: string) {
  const profile = await getCurrentProfile();
  if (!isAdminRole(profile?.role)) {
    throw new AppError("Apenas administradoras podem remover o estudo do mês.");
  }

  const supabase = await createClient();
  const { data: material, error: findError } = await supabase
    .from("study_materials")
    .select("id, storage_path")
    .eq("id", id)
    .maybeSingle();

  if (findError) dbError(findError, "studyMaterials.find");
  if (!material) throw new AppError("Material não encontrado.");

  const { error: deleteError } = await supabase.from("study_materials").delete().eq("id", id);
  if (deleteError) dbError(deleteError, "studyMaterials.delete");

  await supabase.storage.from(BUCKET).remove([material.storage_path]);

  await logAuditEvent({
    action: "study_material.delete",
    entity: "study_materials",
    entityId: id,
  });
}
