"use server";

import { revalidatePath } from "next/cache";
import { upsertAttendance } from "@/lib/services/attendance.service";
import { getCurrentProfile } from "@/lib/services/profiles.service";
import { getCurrentParticipant } from "@/lib/services/participants.service";
import { toUserMessage } from "@/lib/errors";
import type { Enums } from "@/types/database.types";
import type { FormActionState } from "@/app/actions/participants";

// Devolvem o erro em vez de lançar: uma exceção aqui fazia a lista de
// presença inteira sumir (e, no caso da participante, a tela "Minha jornada")
// e virar a tela de erro genérica do Next, sem dizer o que houve.

export async function markAttendanceAction(
  meetingId: string,
  participantId: string,
  basePath: string,
  _state: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const status = formData.get("status") as Enums<"attendance_status"> | null;
  const notes = (formData.get("notes") as string | null) || null;
  if (!status) return { error: "Selecione um status de presença." };

  try {
    await upsertAttendance(meetingId, participantId, status, notes);
  } catch (e) {
    return { error: toUserMessage(e, "actions.attendance.mark", "Erro ao registrar a presença.") };
  }

  revalidatePath(`${basePath}/${meetingId}/presenca`);
  revalidatePath(`${basePath}/${meetingId}`);
  return { success: true };
}

// A própria participante confirmando presença num encontro do seu grupo —
// só pode marcar 'presente' (garantido também pela RLS/policy no banco).
export async function confirmMyAttendanceAction(
  meetingId: string,
  _state: FormActionState,
  _formData: FormData,
): Promise<FormActionState> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "participante") {
    return { error: "Apenas a própria participante pode confirmar presença." };
  }

  const participant = await getCurrentParticipant();
  if (!participant) return { error: "Cadastro de participante não encontrado." };

  try {
    await upsertAttendance(meetingId, participant.id, "presente", null);
  } catch (e) {
    return { error: toUserMessage(e, "actions.attendance.confirmMine", "Erro ao confirmar sua presença.") };
  }

  revalidatePath("/minha-jornada");
  return { success: true };
}
