"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MeetingSchema, MeetingUpdateSchema } from "@/lib/validators/meeting.schema";
import {
  createMeeting,
  updateMeeting,
  addMeetingParticipant,
  removeMeetingParticipant,
} from "@/lib/services/meetings.service";
import { toUserMessage } from "@/lib/errors";
import type { FormActionState } from "@/app/actions/participants";

// Campo vazio precisa virar `null`, NUNCA `undefined`. O supabase-js serializa
// o update com JSON.stringify, e JSON.stringify descarta as chaves cujo valor é
// `undefined` — ou seja, a coluna nem entrava no PATCH e ficava com o valor
// antigo. Quem apagava o bairro errado de uma ficha via "Salvo." na tela e o
// bairro errado continuava no banco, em todos os campos opcionais do sistema.
// `null` é o que realmente limpa a coluna; os schemas zod desses campos são
// todos `.optional().nullable()`.
function readOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

// Campos comuns às duas telas. `group_id` fica de fora porque só o cadastro
// tem esse campo — ver o comentário do MeetingUpdateSchema.
function camposComuns(formData: FormData) {
  return {
    title: formData.get("title"),
    date: formData.get("date"),
    time: readOptionalString(formData, "time"),
    location: readOptionalString(formData, "location"),
    ministered_by: readOptionalString(formData, "ministered_by"),
    status: formData.get("status") || undefined,
  };
}

function parseMeetingForm(formData: FormData) {
  return MeetingSchema.safeParse({ ...camposComuns(formData), group_id: formData.get("group_id") });
}

function parseMeetingUpdateForm(formData: FormData) {
  return MeetingUpdateSchema.safeParse(camposComuns(formData));
}

export async function createMeetingAction(
  basePath: string,
  _state: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const validated = parseMeetingForm(formData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Verifique os campos do formulário." };
  }

  let meeting;
  try {
    meeting = await createMeeting(validated.data);
  } catch (e) {
    return { error: toUserMessage(e, "actions.meetings.create", "Erro ao criar encontro.") };
  }

  revalidatePath(basePath);
  redirect(`${basePath}/${meeting.id}`);
}

export async function updateMeetingAction(
  id: string,
  basePath: string,
  _state: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const validated = parseMeetingUpdateForm(formData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Verifique os campos do formulário." };
  }

  try {
    await updateMeeting(id, {
      title: validated.data.title,
      date: validated.data.date,
      time: validated.data.time || null,
      location: validated.data.location || null,
      ministered_by: validated.data.ministered_by || null,
      status: validated.data.status,
    });
  } catch (e) {
    return { error: toUserMessage(e, "actions.meetings.update", "Erro ao salvar encontro.") };
  }

  revalidatePath(`${basePath}/${id}`);
  return { success: true };
}

// Devolvem o erro em vez de lançar (uma duplicada quebrava a tela do
// encontro) e revalidam também a tela de Chamada, que lista as mesmas
// participantes — sem isso, quem era adicionada aqui não aparecia lá.
export async function addMeetingParticipantAction(
  meetingId: string,
  basePath: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const participantId = formData.get("participant_id") as string | null;
  if (!participantId) return { error: "Selecione uma participante." };

  try {
    await addMeetingParticipant(meetingId, participantId);
  } catch (e) {
    return { error: toUserMessage(e, "actions.meetings.addParticipant", "Erro ao vincular a participante.") };
  }

  revalidatePath(`${basePath}/${meetingId}`);
  revalidatePath(`${basePath}/${meetingId}/presenca`);
  return {};
}

export async function removeMeetingParticipantAction(
  meetingParticipantId: string,
  meetingId: string,
  basePath: string,
): Promise<{ error?: string }> {
  try {
    await removeMeetingParticipant(meetingParticipantId);
  } catch (e) {
    return { error: toUserMessage(e, "actions.meetings.removeParticipant", "Erro ao remover a participante.") };
  }

  revalidatePath(`${basePath}/${meetingId}`);
  revalidatePath(`${basePath}/${meetingId}/presenca`);
  return {};
}
