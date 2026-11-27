"use client";

import { useState } from "react";

export type EncontroDoFeedItem = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  groupName: string | null;
  ministeredBy: string | null;
};

// Quantos encontros aparecem antes de "Ver mais". O resto vem num toque.
export const ENCONTROS_VISIVEIS = 10;

export function ProximosEncontrosLista({ encontros }: { encontros: EncontroDoFeedItem[] }) {
  const [verTodos, setVerTodos] = useState(false);
  const visiveis = verTodos ? encontros : encontros.slice(0, ENCONTROS_VISIVEIS);
  const restantes = encontros.length - ENCONTROS_VISIVEIS;

  return (
    <div className="flex flex-col gap-3">
      {visiveis.map((meeting) => (
        <div key={meeting.id} className="rounded-xl border border-border p-3">
          <p className="text-sm font-medium text-foreground">{meeting.title}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(`${meeting.date}T00:00:00`).toLocaleDateString("pt-BR")}
            {meeting.time ? ` — ${meeting.time.slice(0, 5)}` : ""}
            {meeting.groupName ? ` · ${meeting.groupName}` : ""}
          </p>
          {meeting.ministeredBy && (
            <p className="mt-1 text-xs text-muted-foreground">Palavra: {meeting.ministeredBy}</p>
          )}
        </div>
      ))}
      {restantes > 0 && (
        <button
          type="button"
          onClick={() => setVerTodos((v) => !v)}
          aria-expanded={verTodos}
          className="rounded-xl border border-border py-2.5 text-sm font-medium text-primary hover:bg-muted"
        >
          {verTodos ? "Ver menos" : `Ver mais (${restantes})`}
        </button>
      )}
    </div>
  );
}
