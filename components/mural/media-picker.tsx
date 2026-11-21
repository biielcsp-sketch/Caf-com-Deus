"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { Images, Trash2, Plus } from "lucide-react";

/* ===================================================================
   Seletor de foto/vídeo no estilo do Instagram.

   Troca o `<input type="file">` nativo — aquele "Choose File / No file
   chosen", que aparece em inglês, ignora o visual do app e não mostra o
   que foi escolhido — por uma área grande de toque com prévia.

   Aceita várias fotos (até o limite que quem chama decidir, via
   `allowMore`) para o carrossel; a regra de "vídeo é sempre sozinho" é
   decidida por quem chama (`components/mural/media-upload.tsx`), não
   aqui — este componente só mostra o que já foi escolhido e deixa
   adicionar ou remover.

   O input continua existindo, escondido dentro do <label>: é ele que abre
   o seletor do sistema, sem JavaScript nenhum. Clicar em qualquer ponto da
   área funciona porque o label é o rótulo do input, não porque alguém
   simulou o clique — o que mantém teclado e leitor de tela funcionando.
   =================================================================== */

type Preview = { key: string; file: File; url: string };

export function MediaPicker({
  accept,
  files,
  onFilesSelected,
  onRemove,
  hint,
  disabled,
  allowMore,
}: {
  accept: string;
  files: File[];
  onFilesSelected: (files: File[]) => void;
  onRemove: (index: number) => void;
  hint: string;
  disabled?: boolean;
  allowMore: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [arrastando, setArrastando] = useState(false);

  // As URLs de prévia apontam para memória do navegador e precisam ser
  // liberadas quando o arquivo sai da lista, senão ficam retidas até a
  // página fechar — relevante aqui, onde um vídeo pode ter 300MB.
  useEffect(() => {
    // Sincroniza URLs de prévia (recurso do navegador) com a lista de arquivos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviews((anteriores) => {
      for (const p of anteriores) URL.revokeObjectURL(p.url);
      return files.map((file, index) => ({
        key: `${file.name}-${file.size}-${index}`,
        file,
        url: URL.createObjectURL(file),
      }));
    });
  }, [files]);

  useEffect(() => {
    return () => {
      setPreviews((atuais) => {
        for (const p of atuais) URL.revokeObjectURL(p.url);
        return atuais;
      });
    };
  }, []);

  function escolher(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    onFilesSelected(Array.from(lista));
  }

  function aoSoltar(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setArrastando(false);
    if (disabled) return;
    escolher(e.dataTransfer.files);
  }

  const ehVideo = files[0]?.type.startsWith("video/") ?? false;
  const mostrarSeletor = previews.length === 0 || allowMore;

  return (
    <div className="flex flex-col gap-2">
      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {previews.map((p, index) => (
            <div
              key={p.key}
              className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
            >
              {ehVideo ? (
                <video src={p.url} muted playsInline className="h-full w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- blob: local, sem otimização do next/image
                <img
                  src={p.url}
                  alt={`Prévia ${index + 1} do que será publicado`}
                  className="h-full w-full object-cover"
                />
              )}
              <button
                type="button"
                onClick={() => onRemove(index)}
                disabled={disabled}
                aria-label={`Remover foto ${index + 1}`}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 disabled:opacity-50"
              >
                <Trash2 size={13} />
              </button>
              {previews.length > 1 && (
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  {index + 1}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {mostrarSeletor && (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={aoSoltar}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
            arrastando ? "border-primary bg-muted" : "border-border bg-card hover:bg-muted"
          } ${disabled ? "pointer-events-none opacity-60" : ""}`}
        >
          {previews.length === 0 ? (
            <Images size={40} strokeWidth={1.25} className="text-muted-foreground" />
          ) : (
            <Plus size={28} strokeWidth={1.5} className="text-muted-foreground" />
          )}
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium text-foreground">
              {previews.length === 0 ? "Arraste a foto ou o vídeo aqui" : "Adicionar mais fotos"}
            </p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
          <span className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Selecionar do dispositivo
          </span>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple
            disabled={disabled}
            onChange={(e) => {
              escolher(e.target.files);
              // Zera o valor do input: sem isso, escolher de novo o mesmo
              // arquivo (ex. depois de removê-lo da lista) não dispara o
              // onChange, porque para o navegador nada mudou.
              e.target.value = "";
            }}
            className="sr-only"
          />
        </label>
      )}
    </div>
  );
}
