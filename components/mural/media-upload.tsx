"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import { createUploadSessionAction, registerMediaPostAction } from "@/app/actions/cafe-media";
import { Button } from "@/components/ui/Button";
import { MediaPicker } from "@/components/mural/media-picker";
import { erroDeVersaoAntiga, mensagemDeErro } from "@/lib/client-errors";

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary";
const labelClass = "text-sm font-medium text-foreground";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm";
const MAX_IMAGE_MB = 15;
const MAX_VIDEO_MB = 300;
// Carrossel estilo Instagram: até 5 fotos por publicação. Vídeo é sempre
// sozinho, um de cada vez — nunca entra junto com outras fotos ou vídeos.
const MAX_IMAGENS_POR_PUBLICACAO = 5;

// Envia os bytes direto para o Google e informa o andamento. É XHR e não
// fetch porque só o XHR dá evento de progresso de upload — e sem barra,
// um vídeo de 100MB parece a tela travada.
function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<{ id: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as { id: string });
        } catch {
          reject(new Error("O Google devolveu uma resposta inesperada."));
        }
      } else {
        reject(new Error("O envio do arquivo falhou. Tente de novo."));
      }
    };
    // `onerror` do XHR não distingue queda de rede de bloqueio de CORS — o
    // navegador esconde o motivo de propósito. A mensagem antiga dizia "sem
    // conexão", o que mandava procurar no lugar errado quando a causa era
    // CORS (ver o comentário sobre `Origin` em lib/google-drive.ts).
    xhr.onerror = () =>
      reject(new Error("O envio para o Google Drive foi interrompido. Tente de novo."));
    xhr.send(file);
  });
}

export function MediaUpload({
  postableGroups,
}: {
  postableGroups: { id: string; name: string }[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [precisaRecarregar, setPrecisaRecarregar] = useState(false);

  const ehVideo = files[0]?.type.startsWith("video/") ?? false;

  // Fotos se somam (até o limite); vídeo é sempre publicação avulsa — se
  // já tem um vídeo escolhido, ou se o que chegou agora é vídeo, não dá
  // para misturar com mais nada.
  function handleFilesSelected(selecionados: File[]) {
    setError(null);
    if (selecionados.length === 0) return;

    const videoNaSelecao = selecionados.find((f) => f.type.startsWith("video/"));

    if (videoNaSelecao || ehVideo) {
      if (files.length > 0 || selecionados.length > 1) {
        setError("Vídeo é enviado sozinho, um de cada vez — sem outras fotos ou vídeos junto.");
        return;
      }
      setFiles([videoNaSelecao ?? selecionados[0]]);
      return;
    }

    const espacoLivre = MAX_IMAGENS_POR_PUBLICACAO - files.length;
    if (espacoLivre <= 0) {
      setError(`Só dá para publicar até ${MAX_IMAGENS_POR_PUBLICACAO} fotos de uma vez.`);
      return;
    }
    if (selecionados.length > espacoLivre) {
      setError(
        `Só dá para publicar até ${MAX_IMAGENS_POR_PUBLICACAO} fotos de uma vez — usei as primeiras ${espacoLivre}.`,
      );
    }
    setFiles((atuais) => [...atuais, ...selecionados.slice(0, espacoLivre)]);
  }

  function handleRemove(index: number) {
    setError(null);
    setFiles((atuais) => atuais.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const groupId = String(form.get("group_id") ?? "");
    const caption = String(form.get("caption") ?? "");

    if (!groupId) return setError("Selecione o café.");
    if (files.length === 0) return setError("Escolha uma foto ou um vídeo.");

    for (const arquivo of files) {
      const isVideo = arquivo.type.startsWith("video/");
      const limitMb = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
      if (arquivo.size > limitMb * 1024 * 1024) {
        return setError(
          isVideo
            ? `O vídeo precisa ter no máximo ${MAX_VIDEO_MB}MB.`
            : `Cada foto precisa ter no máximo ${MAX_IMAGE_MB}MB.`,
        );
      }
    }

    setProgress(0);
    const enviados: { driveFileId: string }[] = [];
    try {
      // Um arquivo de cada vez, em sequência — a barra mostra o progresso
      // combinado (arquivos já concluídos + fração do que está subindo).
      for (const [index, arquivo] of files.entries()) {
        const session = await createUploadSessionAction({
          groupId,
          mimeType: arquivo.type,
          sizeBytes: arquivo.size,
        });
        if ("error" in session) throw new Error(session.error);

        const uploaded = await uploadWithProgress(session.uploadUrl, arquivo, (percentDoArquivo) => {
          setProgress(Math.round(((index + percentDoArquivo / 100) / files.length) * 100));
        });
        enviados.push({ driveFileId: uploaded.id });
      }

      const registered = await registerMediaPostAction({ groupId, items: enviados, caption });
      if (registered.error) throw new Error(registered.error);

      formRef.current?.reset();
      setFiles([]);
      setProgress(null);
      router.refresh();
    } catch (e) {
      setProgress(null);
      setPrecisaRecarregar(erroDeVersaoAntiga(e));
      setError(mensagemDeErro(e, "Não foi possível publicar."));
    }
  }

  const enviando = progress !== null;
  const podeAdicionarMais = files.length > 0 && !ehVideo && files.length < MAX_IMAGENS_POR_PUBLICACAO;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
    >

      {postableGroups.length === 1 ? (
        <input type="hidden" name="group_id" value={postableGroups[0].id} />
      ) : (
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="group_id">Café</label>
          <select id="group_id" name="group_id" required defaultValue="" className={inputClass}>
            <option value="">Selecione o café...</option>
            {postableGroups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {/* Sem `required` no input: ele está escondido dentro do seletor, e
            navegador não valida campo que não dá para focar — quem barra o
            envio sem arquivo é a checagem no handleSubmit. */}
        <MediaPicker
          accept={ACCEPT}
          files={files}
          onFilesSelected={handleFilesSelected}
          onRemove={handleRemove}
          disabled={enviando}
          allowMore={podeAdicionarMais}
          hint={`Até ${MAX_IMAGENS_POR_PUBLICACAO} fotos ou 1 vídeo`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <input
          id="caption"
          name="caption"
          maxLength={300}
          placeholder="Escreva uma legenda…"
          aria-label="Legenda (opcional)"
          className={inputClass}
        />
      </div>

      {enviando && (
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Enviando... {progress}%
          </p>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-danger">{error}</p>
          {precisaRecarregar && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn btn-secondary"
            >
              Recarregar página
            </button>
          )}
        </div>
      )}

      <Button type="submit" disabled={enviando} className="flex items-center gap-2 self-start">
        <ImagePlus size={16} />
        {enviando ? "Enviando..." : "Publicar"}
      </Button>
    </form>
  );
}
