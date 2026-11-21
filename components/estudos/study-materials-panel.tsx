"use client";

import { useState, useTransition, type FormEvent } from "react";
import { FileText, Image as ImageIcon, Sheet, Download, Trash2, Pencil } from "lucide-react";
import {
  registerStudyMaterialAction,
  updateStudyMaterialAction,
  deleteStudyMaterialAction,
  getStudyMaterialUrlAction,
  type StudyMaterialActionState,
} from "@/app/actions/study-materials";
import { createClient } from "@/lib/supabase/client";
import {
  STUDY_BUCKET,
  STUDY_MAX_SIZE_BYTES,
  STUDY_ALLOWED_EXTENSIONS,
  STUDY_MIME_BY_EXTENSION,
  buildStudyStoragePath,
  studyFileExtension,
} from "@/lib/study-materials";
import { erroDeVersaoAntiga, MENSAGEM_VERSAO_ANTIGA } from "@/lib/client-errors";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { StudyMaterial } from "@/lib/services/study-materials.service";
import { mesAtualEmSaoPaulo } from "@/lib/dates";

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary";
const labelClass = "text-sm font-medium text-foreground";

// Capa de cada material: quando o arquivo já é uma imagem, a miniatura é a
// própria imagem (thumbnail_url, gerada no servidor); para PDF/Word/Excel,
// que não têm uma capa própria, mostra um ícone grande sobre um fundo
// colorido — usando só as cores já definidas no tema do app (primary/accent
// em globals.css), sem inventar paleta nova.
function coverStyle(mime: string): { Icon: typeof FileText; className: string } {
  if (mime.includes("sheet") || mime.includes("excel")) {
    return { Icon: Sheet, className: "bg-gradient-to-br from-accent/25 to-accent/10 text-accent" };
  }
  if (mime === "application/pdf") {
    return { Icon: FileText, className: "bg-gradient-to-br from-primary/20 to-primary/5 text-primary" };
  }
  if (mime.startsWith("image/")) {
    return { Icon: ImageIcon, className: "bg-gradient-to-br from-accent/25 to-accent/10 text-accent" };
  }
  return { Icon: FileText, className: "bg-gradient-to-br from-muted to-muted/60 text-muted-foreground" };
}

function MaterialCover({ material, big }: { material: StudyMaterial; big?: boolean }) {
  const aspect = big ? "aspect-[16/9]" : "aspect-[4/3]";
  // Se a imagem não carregar por qualquer motivo (URL assinada expirada, rede
  // instável), cai para o ícone colorido em vez de deixar o navegador mostrar
  // o ícone de imagem quebrada — mesmo fallback que os outros tipos já usam.
  const [falhou, setFalhou] = useState(false);
  if (material.thumbnail_url && !falhou) {
    return (
      <div className={`${aspect} w-full overflow-hidden rounded-t-xl bg-muted`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária, sem otimização do next/image */}
        <img
          src={material.thumbnail_url}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFalhou(true)}
        />
      </div>
    );
  }
  const { Icon, className } = coverStyle(material.mime_type);
  return (
    <div className={`flex ${aspect} w-full items-center justify-center rounded-t-xl ${className}`}>
      <Icon size={big ? 56 : 36} strokeWidth={1.25} />
    </div>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function monthLabel(referenceMonth: string) {
  const date = new Date(`${referenceMonth.slice(0, 7)}-01T00:00:00`);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function StudyMaterialsPanel({
  materials,
  canManage,
}: {
  materials: StudyMaterial[];
  canManage: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  // O arquivo vai do navegador direto para o Supabase Storage, e só depois
  // uma Server Action grava a linha.
  //
  // Antes o arquivo ia dentro do FormData da própria Server Action, e aí
  // esbarrava no limite de corpo dela (1MB por padrão no Next.js, e o limite
  // da função serverless por cima disso). Um PDF de estudo passa desse
  // tamanho com folga, então o envio morria antes de chegar na aplicação — o
  // que aparecia na tela era a página de erro do navegador, não uma mensagem
  // do app. Quem escreve no bucket `estudos` é só admin, pela policy
  // `estudos_admin_insert`; as checagens daqui são de UX, e o servidor
  // reconfere tamanho, tipo e magic bytes antes de gravar a linha.
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const form = e.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    const title = String(data.get("title") ?? "").trim();
    const referenceMonth = String(data.get("reference_month") ?? "").trim();
    const description = String(data.get("description") ?? "").trim();

    if (!(file instanceof File) || file.size === 0) return setError("Selecione um arquivo.");
    if (!title) return setError("Dê um título ao material.");
    if (!/^\d{4}-\d{2}$/.test(referenceMonth)) return setError("Informe o mês de referência.");
    if (file.size > STUDY_MAX_SIZE_BYTES) {
      return setError("O arquivo precisa ter no máximo 15MB.");
    }

    const ext = studyFileExtension(file.name);
    if (!STUDY_ALLOWED_EXTENSIONS.includes(ext as (typeof STUDY_ALLOWED_EXTENSIONS)[number])) {
      return setError("Formato não aceito. Envie PDF, Word, Excel ou imagem.");
    }

    setPending(true);
    const storagePath = buildStudyStoragePath(referenceMonth, ext);

    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from(STUDY_BUCKET)
      .upload(storagePath, file, { contentType: STUDY_MIME_BY_EXTENSION[ext], upsert: false });

    if (uploadError) {
      setPending(false);
      setError("Não foi possível enviar o arquivo. Verifique sua conexão e tente de novo.");
      return;
    }

    // Anotado em vez de deixar o TypeScript inferir de um `let` vazio: o
    // build do Netlify é o único type check que temos, e cada erro custa um
    // deploy.
    let result: StudyMaterialActionState;
    try {
      result = await registerStudyMaterialAction({
        storagePath,
        title,
        description,
        referenceMonth,
        fileName: file.name,
      });
    } catch (e) {
      setPending(false);
      setError(erroDeVersaoAntiga(e) ? MENSAGEM_VERSAO_ANTIGA : "Não foi possível enviar o material.");
      return;
    }

    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    form.reset();
  }

  const grouped = materials.reduce<Record<string, StudyMaterial[]>>((acc, item) => {
    const key = item.reference_month.slice(0, 7);
    (acc[key] ??= []).push(item);
    return acc;
  }, {});
  const months = Object.keys(grouped).sort().reverse();

  // Em UTC, no último dia do mês depois das 21h em Brasília, isto já apontava
  // para o mês seguinte e o estudo do mês perdia o rótulo "Estudo deste mês".
  const currentMonth = mesAtualEmSaoPaulo();

  return (
    <div className="flex flex-col gap-6">
      {canManage && (
        <Card className="p-6">
          <p className="mb-4 text-sm font-semibold text-foreground">Enviar material</p>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className={labelClass} htmlFor="title">Título</label>
              <input id="title" name="title" required placeholder="Tema do mês" className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass} htmlFor="reference_month">Mês de referência</label>
              <input
                id="reference_month"
                name="reference_month"
                type="month"
                required
                defaultValue={currentMonth}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass} htmlFor="file">Arquivo</label>
              <input
                id="file"
                name="file"
                type="file"
                required
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className={labelClass} htmlFor="description">Descrição (opcional)</label>
              <textarea id="description" name="description" rows={2} className={inputClass} />
            </div>
            {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
            {success && <p className="text-sm text-primary sm:col-span-2">Material enviado.</p>}
            <Button type="submit" disabled={pending} className="self-start">
              {pending ? "Enviando..." : "Enviar material"}
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Aceita PDF, Word, Excel e imagem, até 15MB por arquivo.
          </p>
        </Card>
      )}

      {months.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">
            Nenhum material publicado ainda.
          </p>
        </Card>
      ) : (
        months.map((month) => {
          const isCurrent = month === currentMonth;
          return (
            <div key={month}>
              <div className="mb-3 flex items-center gap-2">
                <p className="text-sm font-semibold capitalize text-foreground">
                  {isCurrent ? "Estudo deste mês" : monthLabel(month)}
                </p>
                {isCurrent && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Mês atual
                  </span>
                )}
              </div>
              {/* O mês corrente ganha cartões maiores (1-2 colunas) para se
                  destacar; os anteriores ficam num acervo mais compacto
                  (até 3 colunas), sem outra tela nem clique extra. */}
              <div className={isCurrent ? "grid grid-cols-1 gap-4 lg:grid-cols-2" : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
                {grouped[month].map((material) => (
                  <MaterialCard key={material.id} material={material} canManage={canManage} big={isCurrent} />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function MaterialCard({
  material,
  canManage,
  big,
}: {
  material: StudyMaterial;
  canManage: boolean;
  big?: boolean;
}) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // O bucket é privado: o link de download é assinado na hora do clique e
  // vale poucos minutos, em vez de ficar exposto no HTML da listagem.
  async function open() {
    setError(null);
    const url = await getStudyMaterialUrlAction(material.storage_path);
    if (!url) {
      setError("Não foi possível abrir o arquivo agora.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (editing) {
    return (
      <MaterialEditForm
        material={material}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <MaterialCover material={material} big={big} />
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className={`truncate font-medium text-foreground ${big ? "text-base" : "text-sm"}`}>
          {material.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {material.file_name} · {formatSize(material.size_bytes)}
        </p>
        {material.description && (
          <p className={`text-xs text-muted-foreground ${big ? "line-clamp-3" : "line-clamp-2"}`}>
            {material.description}
          </p>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={open}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <Download size={15} />
            Abrir
          </button>
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg border border-border p-2 text-foreground hover:bg-muted"
                aria-label="Editar material"
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!confirm(`Remover "${material.title}"?`)) return;
                  startTransition(async () => {
                    setError(null);
                    // O retorno era ignorado: quando a remoção era recusada, o
                    // card continuava na tela sem nenhum aviso.
                    const resultado = await deleteStudyMaterialAction(material.id);
                    if (resultado?.error) setError(resultado.error);
                  });
                }}
                className="rounded-lg border border-border p-2 text-danger hover:bg-muted disabled:opacity-50"
                aria-label="Remover material"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MaterialEditForm({
  material,
  onCancel,
  onSaved,
}: {
  material: StudyMaterial;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(material.title);
  const [description, setDescription] = useState(material.description ?? "");
  const [referenceMonth, setReferenceMonth] = useState(material.reference_month.slice(0, 7));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateStudyMaterialAction(material.id, {
        title,
        description,
        referenceMonth,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelClass}>Título</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Mês de referência</label>
          <input
            type="month"
            value={referenceMonth}
            onChange={(e) => setReferenceMonth(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelClass}>Descrição (opcional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={inputClass}
          />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button type="button" disabled={pending} onClick={handleSave}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
        <Button variant="secondary" type="button" disabled={pending} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
