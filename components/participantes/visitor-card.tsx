"use client";

import { useState, useTransition } from "react";
import { confirmVisitorContactAction, setVisitorAction } from "@/app/actions/participants";
import { Card } from "@/components/ui/Card";

// Marcar como visitante, confirmar o contato e desmarcar. Visitante é uma
// marcação, não uma etapa da jornada: a participante continua com a situação
// que já tinha.
export function VisitorCard({
  participantId,
  isVisitor,
  markedAt,
  contactConfirmedAt,
}: {
  participantId: string;
  isVisitor: boolean;
  markedAt: string | null;
  contactConfirmedAt: string | null;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ error?: string }>) {
    setErro(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setErro(r.error);
    });
  }

  const marcadaEm = markedAt ? new Date(markedAt).toLocaleDateString("pt-BR") : null;
  const contatoEm = contactConfirmedAt ? new Date(contactConfirmedAt).toLocaleDateString("pt-BR") : null;

  return (
    <Card className="p-6">
      <p className="text-sm font-semibold text-foreground">Visitante</p>
      {!isVisitor ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Visitante é quem veio ao café mas ainda não faz parte dele: não ocupa vaga. Membro é quem
            faz parte do café e ocupa vaga. Marque quando for uma visita: a líder recebe um aviso para
            entrar em contato, e ela aparece no relatório de presença.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setVisitorAction(participantId, true))}
            className="btn btn-secondary mt-3"
          >
            {pending ? "Salvando..." : "Marcar como visitante"}
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Marcada como visitante{marcadaEm ? ` em ${marcadaEm}` : ""}: não ocupa vaga no café.{" "}
            {contatoEm ? `Contato confirmado em ${contatoEm}.` : "O contato ainda não foi confirmado."}
          </p>
          <div className="btn-row mt-3">
            {!contactConfirmedAt && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => confirmVisitorContactAction(participantId))}
                className="btn btn-primary"
              >
                {pending ? "Salvando..." : "Já entrei em contato"}
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setVisitorAction(participantId, false))}
              className="btn btn-secondary"
            >
              Desmarcar visitante
            </button>
          </div>
        </>
      )}
      {erro && <p className="mt-2 text-sm text-danger">{erro}</p>}
    </Card>
  );
}
