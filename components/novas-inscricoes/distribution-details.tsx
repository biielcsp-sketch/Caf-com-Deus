"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  AVAILABILITY_DAY_LABELS,
  AVAILABILITY_PERIOD_LABELS,
} from "@/lib/validators/participant.schema";
import type { LeaderSuggestion } from "@/lib/services/distribution.service";

// Detalhe que a gestora abre na própria linha, antes de aprovar: o que a
// participante pediu na inscrição e por que cada líder recebeu a nota que
// recebeu. Isto morava numa tela separada de distribuição individual, para
// onde ela tinha que navegar e depois voltar. A tela saiu em 09/10/2026 e o
// conteúdo veio para cá — decidir e ver o porquê acontecem no mesmo lugar.
//
// Fica fechado por padrão: a fila é percorrida rápido e o caso comum é
// aprovar a primeira sugestão sem abrir nada.

type Pedido = {
  availability_days: string[] | null;
  availability_period: string[] | null;
  location_preference: string | null;
  city: string | null;
  neighborhood: string | null;
};

function rotular<T extends string>(valores: string[] | null, mapa: Record<T, string>) {
  if (!valores || valores.length === 0) return null;
  return valores.map((v) => mapa[v as T] ?? v).join(", ");
}

export function DistributionDetails({
  pedido,
  suggestions,
  leaderId,
}: {
  pedido: Pedido;
  suggestions: LeaderSuggestion[];
  /** Líder escolhida agora no seletor — é a que aparece destacada. */
  leaderId: string;
}) {
  const [aberto, setAberto] = useState(false);

  const dias = rotular(pedido.availability_days, AVAILABILITY_DAY_LABELS);
  const periodos = rotular(pedido.availability_period, AVAILABILITY_PERIOD_LABELS);
  const local = [pedido.city, pedido.neighborhood].filter(Boolean).join(" / ");

  const linhas: { rotulo: string; valor: string }[] = [
    { rotulo: "Dias", valor: dias ?? "não informou" },
    { rotulo: "Períodos", valor: periodos ?? "não informou" },
    { rotulo: "Onde mora", valor: local || "não informou" },
    { rotulo: "Prefere", valor: pedido.location_preference?.trim() || "não informou" },
  ];

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <ChevronDown
          size={14}
          className={`transition-transform ${aberto ? "rotate-180" : ""}`}
          aria-hidden
        />
        {aberto ? "Ocultar detalhes" : "Ver o que ela pediu e por que esta líder"}
      </button>

      {aberto && (
        <div className="mt-3 flex flex-col gap-4 rounded-xl bg-muted/60 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              O que ela pediu na inscrição
            </p>
            <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
              {linhas.map((l) => (
                <div key={l.rotulo} className="flex gap-1.5 text-xs">
                  <dt className="text-muted-foreground">{l.rotulo}:</dt>
                  <dd className="text-foreground">{l.valor}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Como a nota foi calculada
            </p>
            {suggestions.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Nenhuma líder com vaga combinou com o que ela pediu. Dá para escolher uma em
                &quot;Outras líderes&quot;, que não recebem nota.
              </p>
            ) : (
              <div className="mt-2 flex flex-col gap-3">
                {suggestions.map((s) => (
                  <div
                    key={s.leaderId}
                    className={`rounded-lg border p-3 ${
                      s.leaderId === leaderId ? "border-primary bg-card" : "border-border"
                    }`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground">
                        {s.leaderName}
                        {s.leaderId === leaderId && (
                          <span className="ml-1.5 font-normal text-primary">· selecionada</span>
                        )}
                      </p>
                      <span className="text-xs font-semibold text-primary">
                        {s.score.toFixed(0)} pts
                      </span>
                    </div>
                    {s.groupName && (
                      <p className="text-xs text-muted-foreground">Café: {s.groupName}</p>
                    )}
                    <div className="mt-1.5 flex flex-col gap-0.5">
                      {s.breakdown.map((b) => (
                        <div key={b.criterio} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            {b.criterio} (peso {b.peso})
                          </span>
                          <span className="text-foreground">{b.pontos.toFixed(1)} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              A nota é sugestão, não decisão. Você pode escolher qualquer líder da lista.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
