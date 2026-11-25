// Constantes compartilhadas entre o navegador e o servidor.
//
// Existe separado de study-materials.service.ts porque aquele arquivo é
// `server-only`: o envio do arquivo passou a ser feito direto do navegador
// para o Supabase Storage, e a tela precisa das mesmas listas para validar
// antes de começar o envio. As checagens daqui são de UX — quem decide de
// verdade são a RLS do bucket e a revalidação no servidor, em
// registerStudyMaterial().
export const STUDY_BUCKET = "estudos";
export const STUDY_MAX_SIZE_BYTES = 15 * 1024 * 1024;

export const STUDY_ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "jpg",
  "jpeg",
  "png",
  "webp",
] as const;

export const STUDY_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function studyFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

// O nome do arquivo no bucket é sempre gerado pelo sistema — o nome original
// vai só para a coluna file_name, que é a exibida na tela. O servidor confere
// este mesmo formato antes de gravar a linha.
export const STUDY_PATH_PATTERN =
  /^\d{4}-\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{3,4}$/;

export function buildStudyStoragePath(referenceMonth: string, ext: string) {
  return `${referenceMonth}/${crypto.randomUUID()}.${ext}`;
}

// Quem vê o estudo do mês SEGUINTE no Feed ("Já disponível"): líder, co-líder
// e a gestão. As demais participantes só veem o mês vigente. É regra de
// exibição — o banco libera a leitura de todos os materiais a qualquer logada.
const PAPEIS_QUE_VEEM_PROXIMO_MES = new Set([
  "lider",
  "co_lider",
  "admin",
  "desenvolvedor",
  "gestora_de_pessoas",
]);

export function estudoVisivelNoFeed(
  papel: string,
  mesDoMaterial: string,
  mesAtual: string,
  proximoMes: string,
): boolean {
  const mes = mesDoMaterial.slice(0, 7);
  if (mes === mesAtual) return true;
  return mes === proximoMes && PAPEIS_QUE_VEEM_PROXIMO_MES.has(papel);
}
