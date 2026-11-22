"use client";

import { useActionState, useEffect, useState } from "react";
import { GitBranch, Users, X } from "lucide-react";
import { setCafeOriginAction } from "@/app/actions/multiplication";
import { Picker } from "@/components/ui/Picker";
import { ContactLinks, Field, formatDate } from "@/components/gestao-membros/participant-detail-card";
import { AVAILABILITY_DAY_LABELS } from "@/lib/validators/participant.schema";
import type { TreeNode } from "@/lib/services/multiplication.service";

// Árvore de multiplicação dos cafés. Cada café é um cartão; os cafés que
// nasceram dele ficam embaixo, ligados por traços — um galho novo a cada
// multiplicação. Tocar no cartão abre café, líder e participantes de hoje.

function contarDescendentes(n: TreeNode): number {
  return n.children.reduce((acc, c) => acc + 1 + contarDescendentes(c), 0);
}

function NodeCard({ node, onOpen, raiz }: { node: TreeNode; onOpen: (n: TreeNode) => void; raiz?: boolean }) {
  const filhos = contarDescendentes(node);
  return (
    <button
      type="button"
      onClick={() => onOpen(node)}
      className={`w-44 shrink-0 rounded-xl border p-3 text-left shadow-sm transition-colors hover:bg-muted ${
        raiz ? "border-primary bg-primary/10" : "border-border bg-card"
      } ${node.status === "inativo" ? "opacity-60" : ""}`}
    >
      <p className="truncate text-sm font-semibold text-foreground" title={node.name}>
        {node.name}
      </p>
      <p className="truncate text-xs text-muted-foreground">{node.leader?.name ?? "Sem líder"}</p>
      <div className="mt-2 flex items-center justify-between text-xs text-foreground">
        <span className="inline-flex items-center gap-1">
          <Users size={12} /> {node.participants.length}
        </span>
        {filhos > 0 && (
          <span className="inline-flex items-center gap-1 text-primary">
            <GitBranch size={12} /> {filhos}
          </span>
        )}
      </div>
      {node.multipliedAt && (
        <p className="mt-1 text-[11px] text-muted-foreground">Nasceu em {formatDate(node.multipliedAt)}</p>
      )}
    </button>
  );
}

// Organograma com CSS puro: cada nível é uma linha de cartões, com o traço
// vertical saindo do pai e o horizontal ligando os irmãos.
function Branch({ node, onOpen, raiz }: { node: TreeNode; onOpen: (n: TreeNode) => void; raiz?: boolean }) {
  return (
    <div className="relative flex flex-col items-center px-2 pt-5">
      {!raiz && <span aria-hidden className="absolute left-1/2 top-0 h-5 w-px bg-border" />}
      <NodeCard node={node} onOpen={onOpen} raiz={raiz} />
      {node.children.length > 0 && (
        <>
          <span aria-hidden className="h-5 w-px bg-border" />
          <div className="relative flex">
            {node.children.map((c, i) => (
              <div key={c.id} className="relative">
                {node.children.length > 1 && (
                  <span
                    aria-hidden
                    className={`absolute top-0 h-px bg-border ${
                      i === 0 ? "left-1/2 right-0" : i === node.children.length - 1 ? "left-0 right-1/2" : "left-0 right-0"
                    }`}
                  />
                )}
                <Branch node={c} onOpen={onOpen} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function dias(lista: string[]) {
  if (lista.length === 0) return "—";
  return lista.map((d) => AVAILABILITY_DAY_LABELS[d as keyof typeof AVAILABILITY_DAY_LABELS] ?? d).join(", ");
}

function DetailPanel({ node, onClose }: { node: TreeNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={node.name}>
      <button aria-label="Fechar" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto bg-background p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{node.name}</h2>
            {node.multipliedAt && (
              <p className="text-xs text-muted-foreground">Multiplicado em {formatDate(node.multipliedAt)}</p>
            )}
          </div>
          <button aria-label="Fechar" onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X size={20} />
          </button>
        </div>

        <section className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-xs font-semibold text-foreground">Café</p>
          <dl className="grid grid-cols-1 gap-2">
            <Field label="Dia e horário">
              {dias(node.available_days)}
              {node.meeting_time ? ` · ${node.meeting_time.slice(0, 5)}` : ""}
            </Field>
            <Field label="Local">{[node.address, node.region].filter(Boolean).join(" · ") || "—"}</Field>
            <Field label="Situação">{node.status}</Field>
            <Field label="Cafés que nasceram dele">{contarDescendentes(node)}</Field>
          </dl>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-xs font-semibold text-foreground">Líder</p>
          {node.leader ? (
            <dl className="grid grid-cols-1 gap-2">
              <Field label="Nome">{node.leader.name}</Field>
              <Field label="Contato">
                <ContactLinks phone={node.leader.phone} whatsapp={node.leader.whatsapp} />
              </Field>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Sem líder no momento.</p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-xs font-semibold text-foreground">
            Participantes hoje ({node.participants.length})
          </p>
          {node.participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma participante no momento.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm text-foreground">
              {node.participants.map((p) => (
                <li key={p.id} className="border-b border-border/60 py-1 last:border-0">
                  {p.full_name}
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}

function RegisterOrigin({
  cafes,
  canEdit,
  abertoPorPadrao,
}: {
  cafes: { id: string; name: string }[];
  canEdit: boolean;
  abertoPorPadrao: boolean;
}) {
  const [groupId, setGroupId] = useState("");
  const [parentId, setParentId] = useState("");
  const [state, action, pending] = useActionState(setCafeOriginAction.bind(null, groupId), undefined);
  if (!canEdit) return null;
  const inputClass =
    "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";

  return (
    <details open={abertoPorPadrao} className="rounded-2xl border border-border bg-card p-4">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        Ligar um café ao café de onde ele nasceu
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">
        Para cafés que nasceram de outro antes do sistema: escolha o café e de qual café ele saiu. Não move
        ninguém — só desenha o galho na árvore. Para uma multiplicação nova, use Gestão de Membros → Multiplicar café.
      </p>
      <form action={action} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
        <Picker
          value={groupId}
          onChange={setGroupId}
          options={cafes.map((c) => ({ value: c.id, label: c.name }))}
          title="Café que nasceu"
          placeholder="Café que nasceu..."
        />
        <Picker
          name="parentGroupId"
          value={parentId}
          onChange={setParentId}
          options={cafes.filter((c) => c.id !== groupId).map((c) => ({ value: c.id, label: c.name }))}
          title="De qual café ele saiu"
          placeholder="...do café"
        />
        <input name="date" type="date" className={inputClass} />
        <button
          type="submit"
          disabled={pending || !groupId || !parentId}
          className="btn btn-primary"
        >
          {pending ? "Salvando..." : "Salvar"}
        </button>
      </form>
      {state?.error && <p className="mt-2 text-sm text-danger">{state.error}</p>}
      {state?.success && <p className="mt-2 text-sm text-primary">Galho registrado na árvore.</p>}
    </details>
  );
}

export function MultiplicationTree({
  arvores,
  avulsos,
  canEdit,
}: {
  arvores: TreeNode[];
  avulsos: TreeNode[];
  canEdit: boolean;
}) {
  const [aberto, setAberto] = useState<TreeNode | null>(null);
  const todos: { id: string; name: string }[] = [];
  const coletar = (n: TreeNode) => {
    todos.push({ id: n.id, name: n.name });
    n.children.forEach(coletar);
  };
  [...arvores, ...avulsos].forEach(coletar);
  todos.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <div className="flex flex-col gap-5">
      {arvores.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Nenhuma multiplicação registrada ainda. Quando um café multiplicar (Gestão de Membros → Multiplicar café), ele
          aparece aqui com o novo café como galho.
        </p>
      ) : (
        arvores.map((r) => (
          <section key={r.id} className="rounded-2xl border border-border bg-card/50 p-3">
            <div className="overflow-x-auto pb-2">
              <div className="mx-auto flex w-max justify-center">
                <Branch node={r} onOpen={setAberto} raiz />
              </div>
            </div>
          </section>
        ))
      )}

      <RegisterOrigin cafes={todos} canEdit={canEdit} abertoPorPadrao={arvores.length === 0} />

      {aberto && <DetailPanel node={aberto} onClose={() => setAberto(null)} />}
    </div>
  );
}
