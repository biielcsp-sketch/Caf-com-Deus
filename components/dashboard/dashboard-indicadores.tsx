"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Check, SlidersHorizontal, X } from "lucide-react";
import { BarList } from "@/components/dashboard/bar-list";

export type Painel = {
  id: string;
  titulo: string;
  contador?: number;
  items: { label: string; count: number }[];
};

export type Indicador = { id: string; titulo: string; valor: string | number };

const CHAVE = "dashboard-indicadores";
const EVENTO = "dashboard-indicadores-mudou";

function assinar(cb: () => void) {
  window.addEventListener(EVENTO, cb);
  return () => window.removeEventListener(EVENTO, cb);
}

function lerSalvo() {
  try {
    return localStorage.getItem(CHAVE) ?? "[]";
  } catch {
    return "[]";
  }
}

// Os 5 painéis viram botões; ao tocar, abre o conteúdo numa janela.
// O 6º botão deixa escolher indicadores extras (guardados neste aparelho).
export function DashboardIndicadores({
  paineis,
  indicadores,
}: {
  paineis: Painel[];
  indicadores: Indicador[];
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const salvo = useSyncExternalStore(assinar, lerSalvo, () => "[]");
  const escolhidos = useMemo<string[]>(() => {
    try {
      const v = JSON.parse(salvo);
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }, [salvo]);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  function alternar(id: string) {
    const novo = escolhidos.includes(id) ? escolhidos.filter((x) => x !== id) : [...escolhidos, id];
    try {
      localStorage.setItem(CHAVE, JSON.stringify(novo));
      window.dispatchEvent(new Event(EVENTO));
    } catch {
      /* sem armazenamento: não personaliza */
    }
  }

  const painel = paineis.find((p) => p.id === aberto);
  const visiveis = indicadores.filter((i) => escolhidos.includes(i.id));

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {paineis.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setAberto(p.id)}
            className="glass-panel flex min-h-24 flex-col justify-between rounded-3xl p-4 text-left"
          >
            <span className="text-sm font-semibold leading-tight text-primary">{p.titulo}</span>
            {p.contador !== undefined && (
              <span className="font-display text-2xl font-semibold leading-none text-foreground">
                {p.contador}
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAberto("personalizar")}
          className="glass-panel flex min-h-24 flex-col items-start justify-between rounded-3xl border-dashed p-4 text-left text-muted-foreground"
        >
          <SlidersHorizontal size={20} />
          <span className="text-sm font-semibold leading-tight">Personalizar</span>
        </button>
      </div>

      {visiveis.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {visiveis.map((i) => (
            <div key={i.id} className="glass-panel rounded-3xl p-4">
              <p className="font-display text-2xl font-semibold leading-none text-foreground">{i.valor}</p>
              <p className="mt-2 text-[11px] leading-tight text-muted-foreground">{i.titulo}</p>
            </div>
          ))}
        </div>
      )}

      <dialog
        ref={dialogRef}
        onClose={() => setAberto(null)}
        onClick={(e) => e.target === dialogRef.current && setAberto(null)}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl border-0 bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/40"
      >
        <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">
              {aberto === "personalizar" ? "Personalizar" : painel?.titulo}
            </h2>
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => setAberto(null)}
              className="glass-panel flex h-9 w-9 items-center justify-center rounded-full"
            >
              <X size={16} />
            </button>
          </div>

          {aberto === "personalizar" ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Escolha os indicadores que aparecem no Dashboard.</p>
              {indicadores.map((i) => {
                const ativo = escolhidos.includes(i.id);
                return (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => alternar(i.id)}
                    aria-pressed={ativo}
                    className="glass-panel flex items-center justify-between gap-3 rounded-full px-4 py-3 text-left text-sm"
                  >
                    <span>{i.titulo}</span>
                    <span className={ativo ? "text-primary" : "text-transparent"}>
                      <Check size={16} />
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            painel && <BarList items={painel.items} />
          )}
        </div>
      </dialog>
    </>
  );
}
