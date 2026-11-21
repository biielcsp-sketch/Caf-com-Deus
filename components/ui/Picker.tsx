"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

// Seletor no visual do app. O <select> nativo abre, no Android, a lista
// preta do sistema — fora do padrão do app e sem espaço para mostrar mais que
// o nome. Aqui cada opção pode trazer uma linha de apoio (café, pontos,
// ocupação), e a lista ganha busca quando é comprida.
//
// No celular abre como painel de baixo para cima; no computador, centralizado.
// Com `name`, grava o valor num <input type="hidden"> para funcionar dentro de
// <form action>.

export type PickerOption = {
  value: string;
  label: string;
  description?: string;
  group?: string;
};

export function Picker({
  name,
  value,
  onChange,
  options,
  placeholder = "Escolha...",
  title,
  required,
  disabled,
  className = "",
}: {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: PickerOption[];
  placeholder?: string;
  title?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const listId = useId();
  const buscaRef = useRef<HTMLInputElement>(null);
  const selecionada = options.find((o) => o.value === value) ?? null;
  const comBusca = options.length > 7;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    // Trava a rolagem da página por baixo do painel.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (comBusca) setTimeout(() => buscaRef.current?.focus(), 50);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, comBusca]);

  const grupos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtradas = termo
      ? options.filter((o) => `${o.label} ${o.description ?? ""}`.toLowerCase().includes(termo))
      : options;
    const mapa = new Map<string, PickerOption[]>();
    for (const o of filtradas) {
      const g = o.group ?? "";
      mapa.set(g, [...(mapa.get(g) ?? []), o]);
    }
    return [...mapa.entries()];
  }, [options, busca]);

  function escolher(v: string) {
    onChange(v);
    setOpen(false);
    setBusca("");
  }

  return (
    <>
      {name && <input type="hidden" name={name} value={value} required={required} />}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-left text-sm outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 ${className}`}
      >
        <span className="min-w-0">
          {selecionada ? (
            <>
              <span className="block truncate text-foreground">{selecionada.label}</span>
              {selecionada.description && (
                <span className="block truncate text-xs text-muted-foreground">{selecionada.description}</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <button aria-label="Fechar" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative flex max-h-[85vh] w-full flex-col rounded-t-2xl bg-background shadow-xl sm:max-w-lg sm:rounded-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-foreground">{title ?? placeholder}</p>
              <button type="button" aria-label="Fechar" onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-muted">
                <X size={18} />
              </button>
            </div>
            {comBusca && (
              <div className="border-b border-border px-4 py-2">
                <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                  <Search size={15} className="text-muted-foreground" />
                  <input
                    ref={buscaRef}
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar"
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </label>
              </div>
            )}
            <ul id={listId} role="listbox" className="flex-1 overflow-y-auto px-2 py-2">
              {grupos.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">Nada encontrado.</li>}
              {grupos.map(([grupo, itens]) => (
                <li key={grupo || "_"}>
                  {grupo && (
                    <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {grupo}
                    </p>
                  )}
                  <ul>
                    {itens.map((o) => {
                      const ativo = o.value === value;
                      return (
                        <li key={o.value}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={ativo}
                            onClick={() => escolher(o.value)}
                            className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left ${
                              ativo ? "bg-primary/10" : "hover:bg-muted"
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block text-sm text-foreground">{o.label}</span>
                              {o.description && (
                                <span className="block text-xs text-muted-foreground">{o.description}</span>
                              )}
                            </span>
                            {ativo && <Check size={16} className="shrink-0 text-primary" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
