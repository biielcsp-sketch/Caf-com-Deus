"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { deleteFollowUpAction } from "@/app/actions/followups";
import { FollowUpForm } from "@/components/acompanhamento/followup-form";
import type { FollowUpRow } from "@/lib/services/followup.service";

// Editar e excluir um acompanhamento — aparece só para pastora, Gestora de
// Pessoas e desenvolvedor. Excluir esconde o registro (não apaga a linha).
export function FollowUpManage({
  followUp,
  participantId,
  basePath,
}: {
  followUp: FollowUpRow;
  participantId: string;
  basePath: string;
}) {
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-2">
      <div className="btn-row">
        <button
          type="button"
          onClick={() => setEditando((v) => !v)}
          className="btn btn-secondary"
        >
          <Pencil size={12} /> {editando ? "Fechar edição" : "Editar"}
        </button>
        {!confirmando ? (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="btn btn-danger"
          >
            <Trash2 size={12} /> Excluir
          </button>
        ) : (
          <span className="flex items-center gap-2 text-xs">
            Excluir este registro?
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await deleteFollowUpAction(followUp.id, basePath, participantId);
                  if (r.error) setErro(r.error);
                  setConfirmando(false);
                })
              }
              className="btn btn-danger"
            >
              {pending ? "Excluindo..." : "Sim, excluir"}
            </button>
            <button type="button" onClick={() => setConfirmando(false)} className="underline">
              Cancelar
            </button>
          </span>
        )}
      </div>
      {erro && <p className="mt-1 text-xs text-danger">{erro}</p>}
      {editando && (
        <div className="mt-3 rounded-lg border border-border p-3">
          <FollowUpForm participantId={participantId} basePath={basePath} followUp={followUp} />
        </div>
      )}
    </div>
  );
}
