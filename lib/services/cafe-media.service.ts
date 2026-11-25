import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile, isAdminRole } from "@/lib/services/profiles.service";
import { logAuditEvent } from "@/lib/services/audit.service";
import {
  createResumableUpload,
  createDriveFolder,
  getDriveFileMeta,
  getPinnedFolderId,
  deleteFromDrive,
  type DriveFileMeta,
} from "@/lib/google-drive";
import { AppError, dbError } from "@/lib/errors";

/* ===================================================================
   Mural do café: fotos e vídeos.

   Os arquivos ficam no Google Drive, nunca no banco. No banco fica só a
   linha que descreve a publicação — id do arquivo no Drive, legenda,
   grupo, quem postou — mais as curtidas e os comentários, que são dados,
   não arquivos.

   A tabela ainda se chama `cafe_photos` porque foi criada antes de o
   mural aceitar vídeo, e renomear tabela com política de RLS em cima
   custa mais do que vale. O código chama de mídia.
   =================================================================== */

const LEGACY_BUCKET = "fotos";
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 300 * 1024 * 1024;
// Carrossel estilo Instagram: até 5 fotos numa publicação. Vídeo nunca
// entra em carrossel — é sempre uma publicação sozinha.
const MAX_CAROUSEL_ITEMS = 5;

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
// mp4 e quicktime cobrem Android e iPhone, que é de onde as fotos vêm.
const VIDEO_MIMES = ["video/mp4", "video/quicktime", "video/webm"];

export type MediaType = "image" | "video";

export type CafeMedia = {
  id: string;
  mediaType: MediaType;
  caption: string | null;
  createdAt: string;
  groupId: string;
  groupName: string | null;
  authorId: string;
  authorName: string | null;
  /** Onde o navegador busca o arquivo. Sempre uma rota nossa, nunca o
   *  Drive direto — é ela que confere se quem pediu pode ver. */
  url: string;
  /** Todas as fotos da publicação, na ordem do carrossel — length 1 fora do
   *  carrossel (vídeo, ou publicação com uma foto só). O primeiro item é
   *  sempre igual a `{ id, url }`. */
  items: { id: string; url: string }[];
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
};

export type CafeMediaComment = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string | null;
  authorId: string;
};

function extensionFor(mime: string) {
  return (
    {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/heic": "heic",
      "image/heif": "heif",
      "video/mp4": "mp4",
      "video/quicktime": "mov",
      "video/webm": "webm",
    }[mime] ?? "bin"
  );
}

/* ------------------------- Leitura ------------------------- */

type MediaRow = {
  id: string;
  caption: string | null;
  created_at: string;
  media_type: string;
  group_id: string;
  author_profile_id: string;
  likes: { count: number }[];
  comments: { count: number }[];
};

// `author:profiles!cafe_photos_author_profile_id_fkey` — o nome da chave
// estrangeira NÃO é decoração, é o que faz esta consulta funcionar.
//
// `cafe_photo_likes` tem PRIMARY KEY (photo_id, profile_id) e chaves para
// `cafe_photos` e para `profiles`. Isso é uma tabela de junção, e o PostgREST
// a lê como um relacionamento many-to-many entre as duas — então, de
// `cafe_photos` até `profiles`, existem DOIS caminhos: a chave direta
// `author_profile_id` e o M2M pelas curtidas. Diante de dois, o PostgREST não
// escolhe: recusa a consulta inteira (PGRST201), e não só o vínculo do autor.
//
// O efeito prático era um mural eternamente "vazio" com as fotos gravadas no
// banco — a tela engolia o erro e mostrava a mesma mensagem de mural sem
// publicação. Quebrou na migration que criou curtidas e comentários
// (20260908), não na que criou o mural.
//
// Regra geral para este projeto: ao embutir uma tabela que também é alvo de
// uma tabela de junção, nomeie a chave estrangeira.
const MEDIA_SELECT =
  "id, caption, created_at, media_type, group_id, author_profile_id, " +
  "likes:cafe_photo_likes(count), comments:cafe_photo_comments(count)";

async function decorate(rows: MediaRow[]): Promise<CafeMedia[]> {
  if (rows.length === 0) return [];

  const profile = await getCurrentProfile();
  const supabase = await createClient();

  // Nome da autora e do café vêm de uma função do banco, não de embutir
  // `groups`/`profiles`: essas tabelas são fechadas para participante, e o
  // mural é aberto a todas — embutir daria nome vazio nas publicações de
  // outros cafés.
  const { data: nomes, error: nomesError } = await supabase.rpc("app_mural_names", {
    p_photo_ids: rows.map((r) => r.id),
  });
  if (nomesError) dbError(nomesError, "cafeMedia.names");
  const nomesPorId = new Map((nomes ?? []).map((n) => [n.photo_id, n]));

  // Quais destas eu curti — uma consulta só para a página inteira, em vez
  // de uma por publicação. Curtida é sempre no id da linha-pai; fotos do
  // carrossel (linhas filhas) não têm curtida própria.
  let mine = new Set<string>();
  if (profile) {
    const { data } = await supabase
      .from("cafe_photo_likes")
      .select("photo_id")
      .eq("profile_id", profile.id)
      .in(
        "photo_id",
        rows.map((r) => r.id),
      );
    mine = new Set((data ?? []).map((l) => l.photo_id));
  }

  // As fotos extras do carrossel (linhas filhas), de todas as publicações
  // desta página numa consulta só — vídeo nunca tem filha, então nem
  // precisa perguntar por ele.
  const parentIds = rows.filter((r) => r.media_type !== "video").map((r) => r.id);
  const childrenByParent = new Map<string, { id: string }[]>();
  if (parentIds.length > 0) {
    const { data: children, error: childrenError } = await supabase
      .from("cafe_photos")
      .select("id, parent_media_id")
      .in("parent_media_id", parentIds)
      .order("sort_order", { ascending: true });
    if (childrenError) dbError(childrenError, "cafeMedia.listChildren");
    for (const child of children ?? []) {
      if (!child.parent_media_id) continue;
      const lista = childrenByParent.get(child.parent_media_id) ?? [];
      lista.push({ id: child.id });
      childrenByParent.set(child.parent_media_id, lista);
    }
  }

  return rows.map((row) => {
    const itemIds = [row.id, ...(childrenByParent.get(row.id) ?? []).map((c) => c.id)];
    return {
      id: row.id,
      mediaType: row.media_type === "video" ? "video" : "image",
      caption: row.caption,
      createdAt: row.created_at,
      groupId: row.group_id,
      groupName: nomesPorId.get(row.id)?.group_name ?? null,
      authorId: row.author_profile_id,
      authorName: nomesPorId.get(row.id)?.author_name ?? null,
      url: `/api/midia/${row.id}`,
      items: itemIds.map((id) => ({ id, url: `/api/midia/${id}` })),
      likeCount: row.likes?.[0]?.count ?? 0,
      likedByMe: mine.has(row.id),
      commentCount: row.comments?.[0]?.count ?? 0,
    };
  });
}

// A RLS já decide quais grupos a usuária enxerga — aqui não se filtra de
// novo, senão a regra passaria a existir em dois lugares.
//
// Só linhas-pai (parent_media_id nulo): cada uma é uma publicação. As
// fotos extras do carrossel são buscadas à parte, em `decorate`.
export async function listCafeMedia(limit = 30): Promise<CafeMedia[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cafe_photos")
    .select(MEDIA_SELECT)
    .is("parent_media_id", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) dbError(error, "cafeMedia.list");
  return decorate((data ?? []) as unknown as MediaRow[]);
}

// A última publicação, para o feed.
export async function getLatestCafeMedia(): Promise<CafeMedia | null> {
  const list = await listCafeMedia(1);
  return list[0] ?? null;
}

// Os cafés em que a usuária pode publicar: os que ela lidera (líder ou
// co-líder). Admin recebe todos; participante e anfitriã, nenhum — elas
// curtem e comentam, mas não postam.
export async function listGroupsICanPostTo(): Promise<{ id: string; name: string }[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data: leader } = await supabase
    .from("leaders")
    .select("id")
    .eq("profile_id", profile.id)
    .maybeSingle();

  const isAdmin = isAdminRole(profile.role);
  if (!leader && !isAdmin) return [];

  let query = supabase.from("groups").select("id, name").order("name");
  if (!isAdmin && leader) query = query.eq("leader_id", leader.id);

  const { data, error } = await query;
  if (error) dbError(error, "cafeMedia.listGroupsICanPostTo");
  return data ?? [];
}

/* ------------------------- A pasta do mural -------------------------
   Por padrão o app cria a própria pasta no Drive de quem autorizou, e
   guarda o id em app_config. É o que permite usar a permissão estreita
   do Google (drive.file, que só enxerga arquivo criado pelo próprio
   app): com ela não há verificação a passar, nem política de privacidade
   a publicar, nem autorização caindo a cada 7 dias.

   A pasta aparece no Drive dela normalmente e pode ser movida ou
   renomeada — o acesso é pelo id, não pelo lugar onde ela está.

   GOOGLE_DRIVE_FOLDER_ID continua valendo como override, para quem
   preferir fixar uma pasta que já existe. Aí é preciso a permissão ampla
   do Drive, com tudo o que ela cobra. */

const FOLDER_CONFIG_KEY = "drive_folder_id";
const FOLDER_NAME = "Café com Deus Shine — Mural";

async function getMuralFolderId(): Promise<string> {
  const pinned = getPinnedFolderId();
  if (pinned) return pinned;

  const admin = createAdminClient();
  const { data } = await admin
    .from("app_config")
    .select("value")
    .eq("key", FOLDER_CONFIG_KEY)
    .maybeSingle();

  const saved = (data?.value as { id?: string } | null)?.id;
  if (saved) return saved;

  // Primeira publicação de todas: cria a pasta e guarda o id. Se duas
  // usuárias publicarem no mesmo instante, o upsert deixa uma das duas
  // pastas órfã e vazia no Drive — chato, não quebra nada, e é raro o
  // bastante para não valer um lock.
  const folderId = await createDriveFolder(FOLDER_NAME);
  const { error } = await admin
    .from("app_config")
    .upsert({ key: FOLDER_CONFIG_KEY, value: { id: folderId } });
  if (error) dbError(error, "cafeMedia.saveFolderId");

  return folderId;
}

/* ------------------------- Envio -------------------------
   Duas etapas. O servidor abre a sessão de upload (só ele tem o token do
   Drive) e o navegador manda os bytes direto para o Google; depois o
   servidor confere o que entrou e grava a linha. Os bytes nunca passam
   por aqui — é o que permite mandar vídeo de celular. */

// A origem que o Google vai autorizar para o PUT do navegador. Tem que ser
// idêntica à da barra de endereços — inclusive em deploy preview, que tem
// domínio próprio —, por isso sai da requisição e não de uma constante.
//
// O `Origin` do cabeçalho é escolhido pelo cliente, então só é aceito quando
// bate com o host da própria requisição; fora isso, a origem é montada a
// partir do host. Assim ninguém consegue pedir uma sessão de upload liberada
// para um site de terceiro.
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const declared = h.get("origin");

  if (declared) {
    try {
      if (!host || new URL(declared).host === host) return new URL(declared).origin;
    } catch {
      // origem malformada: cai no caminho do host abaixo.
    }
  }

  if (!host) {
    throw new AppError("Não foi possível identificar o endereço do site para iniciar o envio.");
  }
  return `${proto}://${host}`;
}

async function assertCanPostTo(groupId: string) {
  const allowed = await listGroupsICanPostTo();
  if (!allowed.some((g) => g.id === groupId)) {
    throw new AppError("Você não pode publicar neste café.");
  }
}

export async function createMediaUploadSession(input: {
  groupId: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<{ uploadUrl: string; mediaType: MediaType }> {
  const profile = await getCurrentProfile();
  if (!profile) throw new AppError("Sessão expirada. Faça login novamente.");
  await assertCanPostTo(input.groupId);

  const isImage = IMAGE_MIMES.includes(input.mimeType);
  const isVideo = VIDEO_MIMES.includes(input.mimeType);
  if (!isImage && !isVideo) {
    throw new AppError("Envie uma foto (JPEG, PNG, WEBP, HEIC) ou um vídeo (MP4, MOV, WEBM).");
  }

  const mediaType: MediaType = isVideo ? "video" : "image";
  const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (input.sizeBytes <= 0) throw new AppError("Selecione um arquivo.");
  if (input.sizeBytes > limit) {
    throw new AppError(
      isVideo
        ? "O vídeo precisa ter no máximo 300MB."
        : "A foto precisa ter no máximo 15MB.",
    );
  }

  // Nome sempre gerado aqui: nome vindo do navegador nunca vira nome de
  // arquivo no Drive.
  const fileName = `${input.groupId}-${crypto.randomUUID()}.${extensionFor(input.mimeType)}`;
  const uploadUrl = await createResumableUpload({
    mimeType: input.mimeType,
    fileName,
    folderId: await getMuralFolderId(),
    sizeBytes: input.sizeBytes,
    origin: await requestOrigin(),
  });

  return { uploadUrl, mediaType };
}

// Publica uma foto (ou um vídeo) sozinho — mantida para quem já chamava
// isto assim; por baixo é só um carrossel de um item só.
export async function registerCafeMedia(input: {
  groupId: string;
  driveFileId: string;
  caption?: string | null;
}): Promise<void> {
  await registerCafeMediaPost({
    groupId: input.groupId,
    items: [{ driveFileId: input.driveFileId }],
    caption: input.caption,
  });
}

// Publica um carrossel de 1 a 5 fotos (ou 1 vídeo sozinho) — a publicação
// vira a primeira linha (`parent_media_id` nulo); as demais fotos entram
// como linhas filhas, na ordem enviada. Curtida e comentário ficam presos
// ao id da primeira linha: o carrossel inteiro é uma publicação só.
export async function registerCafeMediaPost(input: {
  groupId: string;
  items: { driveFileId: string }[];
  caption?: string | null;
}): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) throw new AppError("Sessão expirada. Faça login novamente.");
  await assertCanPostTo(input.groupId);

  if (input.items.length === 0) throw new AppError("Escolha uma foto ou um vídeo.");
  if (input.items.length > MAX_CAROUSEL_ITEMS) {
    throw new AppError(`Envie no máximo ${MAX_CAROUSEL_ITEMS} fotos por publicação.`);
  }

  // O id de cada arquivo veio do navegador, então nada dele é aceito de
  // graça: tem que existir, estar na NOSSA pasta e ser de um tipo que
  // aceitamos. O tipo aqui é o que o Google detectou do conteúdo real, o
  // que faz o papel da checagem de magic bytes de quando os bytes
  // passavam por nós.
  const folderId = await getMuralFolderId();
  const itens: { driveFileId: string; meta: DriveFileMeta; isVideo: boolean }[] = [];
  try {
    for (const item of input.items) {
      const meta = await getDriveFileMeta(item.driveFileId);
      if (!meta) throw new AppError("O arquivo não foi encontrado no Google Drive.");
      if (!meta.parents.includes(folderId)) {
        throw new AppError("Arquivo fora da pasta do mural.");
      }
      const isImage = IMAGE_MIMES.includes(meta.mimeType);
      const isVideo = VIDEO_MIMES.includes(meta.mimeType);
      if (!isImage && !isVideo) {
        throw new AppError("Tipo de arquivo não aceito.");
      }
      itens.push({ driveFileId: item.driveFileId, meta, isVideo });
    }

    // Vídeo é sempre publicação avulsa — nunca entra em carrossel. A tela
    // já impede isso, mas a regra vale de novo aqui: quem grava é quem
    // decide.
    if (itens.some((i) => i.isVideo) && itens.length > 1) {
      throw new AppError("Vídeo é enviado sozinho, um de cada vez — sem fotos junto.");
    }
  } catch (e) {
    // Qualquer arquivo que já passou pela validação (e o que acabou de
    // falhar, se chegou a existir no Drive) fica órfão na pasta do mural
    // se não limpar aqui — nenhuma linha vai ser criada no banco para
    // nenhum deles. `deleteFromDrive` nunca lança (404 já é o estado
    // desejado, e qualquer outro erro só vira log), então é seguro chamar
    // para todos os itens pedidos, validados ou não.
    for (const item of input.items) await deleteFromDrive(item.driveFileId);
    throw e;
  }

  const [primeiro, ...resto] = itens;
  const supabase = await createClient();

  const { data: inserted, error: parentError } = await supabaseInsertMedia({
    groupId: input.groupId,
    authorId: profile.id,
    driveFileId: primeiro.meta.id,
    mediaType: primeiro.isVideo ? "video" : "image",
    mimeType: primeiro.meta.mimeType,
    fileName: primeiro.meta.name,
    caption: input.caption?.trim() || null,
  });

  if (parentError) {
    // Sem a linha, os arquivos viram órfãos na pasta do Drive.
    for (const item of itens) await deleteFromDrive(item.driveFileId);
    dbError(parentError, "cafeMedia.insert");
  }

  if (resto.length > 0) {
    const { error: childrenError } = await supabase.from("cafe_photos").insert(
      resto.map((item, index) => ({
        group_id: input.groupId,
        author_profile_id: profile.id,
        drive_file_id: item.meta.id,
        media_type: item.isVideo ? ("video" as const) : ("image" as const),
        mime_type: item.meta.mimeType,
        file_name: item.meta.name,
        parent_media_id: inserted!.id,
        sort_order: index + 1,
      })),
    );

    if (childrenError) {
      // A publicação já existe sem as fotos extras — melhor desfazer tudo
      // (o cascade cuida das filhas que entraram) do que deixar um
      // carrossel pela metade.
      const { error: cleanupError, count } = await supabase
        .from("cafe_photos")
        .delete({ count: "exact" })
        .eq("id", inserted!.id);
      for (const item of itens) await deleteFromDrive(item.driveFileId);

      if (cleanupError || !count) {
        // Não deu para desfazer a linha-pai — ela continua no banco
        // apontando para um arquivo que acabamos de apagar do Drive. Isso
        // não impede o erro de chegar à usuária, mas fica registrado para
        // dar para achar depois (a tela só mostra o erro de publicação).
        console.error(
          "[cafeMedia] publicação órfã após falha ao inserir fotos do carrossel:",
          inserted!.id,
          cleanupError,
        );
      }
      dbError(childrenError, "cafeMedia.insertChildren");
    }
  }

  await logAuditEvent({
    action: "cafe_media.upload",
    entity: "cafe_photos",
    entityId: inserted!.id,
  });
}

async function supabaseInsertMedia(row: {
  groupId: string;
  authorId: string;
  driveFileId: string;
  mediaType: MediaType;
  mimeType: string;
  fileName: string;
  caption: string | null;
}) {
  const supabase = await createClient();
  return supabase
    .from("cafe_photos")
    .insert({
      group_id: row.groupId,
      author_profile_id: row.authorId,
      drive_file_id: row.driveFileId,
      media_type: row.mediaType,
      mime_type: row.mimeType,
      file_name: row.fileName,
      caption: row.caption,
      sort_order: 0,
    })
    .select("id")
    .single();
}

export async function deleteCafeMedia(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: media, error: findError } = await supabase
    .from("cafe_photos")
    .select("id, drive_file_id, storage_path")
    .eq("id", id)
    .maybeSingle();

  if (findError) dbError(findError, "cafeMedia.find");
  if (!media) throw new AppError("Publicação não encontrada.");

  // Fotos do carrossel (linhas filhas) somem do banco pelo ON DELETE
  // CASCADE quando a linha-pai é apagada, mas o arquivo delas no Drive não
  // — isso é cuidado à parte, abaixo.
  const { data: children } = await supabase
    .from("cafe_photos")
    .select("drive_file_id, storage_path")
    .eq("parent_media_id", id);

  // Quem pode apagar é a RLS que diz — se não puder, nada é removido e o
  // arquivo continua onde está.
  const { error: deleteError, count } = await supabase
    .from("cafe_photos")
    .delete({ count: "exact" })
    .eq("id", id);
  if (deleteError) dbError(deleteError, "cafeMedia.delete");
  if (!count) throw new AppError("Você não pode apagar esta publicação.");

  for (const arquivo of [media, ...(children ?? [])]) {
    if (arquivo.drive_file_id) await deleteFromDrive(arquivo.drive_file_id);
    if (arquivo.storage_path) await supabase.storage.from(LEGACY_BUCKET).remove([arquivo.storage_path]);
  }

  await logAuditEvent({ action: "cafe_media.delete", entity: "cafe_photos", entityId: id });
}

/* ------------------------- Curtidas ------------------------- */

// Devolve o estado depois da ação, para a tela não precisar recarregar.
export async function toggleCafeMediaLike(
  mediaId: string,
): Promise<{ liked: boolean; likeCount: number }> {
  const profile = await getCurrentProfile();
  if (!profile) throw new AppError("Sessão expirada. Faça login novamente.");

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("cafe_photo_likes")
    .select("photo_id")
    .eq("photo_id", mediaId)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("cafe_photo_likes")
      .delete()
      .eq("photo_id", mediaId)
      .eq("profile_id", profile.id);
    if (error) dbError(error, "cafeMedia.unlike");
  } else {
    const { error } = await supabase
      .from("cafe_photo_likes")
      .insert({ photo_id: mediaId, profile_id: profile.id });
    if (error) dbError(error, "cafeMedia.like");
  }

  const { count } = await supabase
    .from("cafe_photo_likes")
    .select("photo_id", { count: "exact", head: true })
    .eq("photo_id", mediaId);

  return { liked: !existing, likeCount: count ?? 0 };
}

/* ------------------------- Comentários ------------------------- */

export async function listCafeMediaComments(mediaId: string): Promise<CafeMediaComment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cafe_photo_comments")
    .select("id, body, created_at, profile_id")
    .eq("photo_id", mediaId)
    .order("created_at", { ascending: true });

  if (error) dbError(error, "cafeMedia.listComments");

  // Quem comentou pode ser de outro café (e `profiles` é fechada para quem
  // não é admin): o nome vem da função do banco.
  const comentarios = data ?? [];
  const { data: nomes, error: nomesError } = comentarios.length
    ? await supabase.rpc("app_mural_comment_authors", { p_comment_ids: comentarios.map((c) => c.id) })
    : { data: [], error: null };
  if (nomesError) dbError(nomesError, "cafeMedia.commentAuthors");
  const nomePorComentario = new Map((nomes ?? []).map((n) => [n.comment_id, n.author_name]));

  return comentarios.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.created_at,
    authorName: nomePorComentario.get(c.id) ?? null,
    authorId: c.profile_id,
  }));
}

export async function addCafeMediaComment(mediaId: string, body: string): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) throw new AppError("Sessão expirada. Faça login novamente.");

  const text = body.trim();
  if (!text) throw new AppError("Escreva um comentário.");
  if (text.length > 1000) throw new AppError("O comentário está muito longo.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("cafe_photo_comments")
    .insert({ photo_id: mediaId, profile_id: profile.id, body: text });
  if (error) dbError(error, "cafeMedia.addComment");
}

export async function deleteCafeMediaComment(commentId: string): Promise<void> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("cafe_photo_comments")
    .delete({ count: "exact" })
    .eq("id", commentId);
  if (error) dbError(error, "cafeMedia.deleteComment");
  if (!count) throw new AppError("Você não pode apagar este comentário.");
}

/* ------------------------- Arquivo (usado pela rota /api/midia) ------- */

// Só o necessário para a rota decidir de onde ler. A checagem de quem
// pode ver é o próprio SELECT: se a RLS não deixar, não vem linha.
export async function getMediaFileRef(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cafe_photos")
    .select("id, drive_file_id, storage_path, mime_type, media_type, file_name")
    .eq("id", id)
    .maybeSingle();

  if (error) dbError(error, "cafeMedia.getFileRef");
  return data;
}

export async function getLegacySignedUrl(storagePath: string) {
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(LEGACY_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);
  return data?.signedUrl ?? null;
}
