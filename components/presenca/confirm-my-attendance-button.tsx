"use client";

import { useActionState } from "react";
import { confirmMyAttendanceAction } from "@/app/actions/attendance";
import type { FormActionState } from "@/app/actions/participants";

// Botão "Confirmar presença" da tela Minha jornada. Existe como componente
// próprio para ter estado: antes era um `<form action={...}>` direto numa
// página de servidor e, se a policy recusasse a confirmação, a tela inteira
// da participante virava erro — a usuária menos técnica do app vendo a tela
// de erro genérica do Next.
export function ConfirmMyAttendanceButton({ meetingId }: { meetingId: string }) {
  const [state, formAction, pending] = useActionState<FormActionState, FormData>(
    confirmMyAttendanceAction.bind(null, meetingId),
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary"
      >
        {pending ? "Confirmando..." : "Confirmar presença"}
      </button>
      {state?.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
