"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { multiplyCafe, setCafeOrigin } from "@/lib/services/multiplication.service";
import { getCurrentProfile } from "@/lib/services/profiles.service";
import { isPeopleManagerRole } from "@/lib/role-labels";
import { toUserMessage } from "@/lib/errors";
import { AVAILABILITY_DAYS } from "@/lib/validators/participant.schema";

export type MultiplyState =
  | { error?: string; success?: false }
  | { success: true; cafeName: string; transferidas: number; contaCriada: boolean; email: string | null }
  | undefined;

const Schema = z.object({
  originGroupId: z.uuid({ error: "Escolha o café de origem." }),
  newLeaderParticipantId: z.uuid({ error: "Escolha quem vai liderar o novo café." }),
  participantIds: z.array(z.uuid()),
  date: z.string().trim().optional(),
  name: z.string().trim().min(2, { error: "Informe o nome do novo café." }),
  address: z.string().trim().optional(),
  region: z.string().trim().optional(),
  available_days: z.array(z.enum(AVAILABILITY_DAYS)),
  meeting_time: z.string().trim().optional(),
  capacity: z.string().trim().optional(),
  email: z.string().trim().optional(),
  password: z.string().optional(),
  needsAccount: z.enum(["0", "1"]),
});

export async function multiplyCafeAction(_state: MultiplyState, formData: FormData): Promise<MultiplyState> {
  const profile = await getCurrentProfile();
  if (!isPeopleManagerRole(profile?.role)) {
    return { error: "Apenas a pastora ou a gestora de pessoas podem registrar uma multiplicação." };
  }

  const parsed = Schema.safeParse({
    originGroupId: formData.get("originGroupId"),
    newLeaderParticipantId: formData.get("newLeaderParticipantId"),
    participantIds: formData.getAll("participantIds").map(String),
    date: formData.get("date") || undefined,
    name: formData.get("name"),
    address: formData.get("address") || undefined,
    region: formData.get("region") || undefined,
    available_days: formData.getAll("available_days").map(String),
    meeting_time: formData.get("meeting_time") || undefined,
    capacity: formData.get("capacity") || undefined,
    email: formData.get("email") || undefined,
    password: formData.get("password") || undefined,
    needsAccount: formData.get("needsAccount") ?? "0",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os campos." };
  const v = parsed.data;

  let account: { email: string; password: string } | undefined;
  if (v.needsAccount === "1") {
    const email = z.email().safeParse(v.email);
    if (!email.success) return { error: "Informe um e-mail válido para o acesso da nova líder." };
    if (!v.password || v.password.length < 8) {
      return { error: "A senha provisória precisa ter pelo menos 8 caracteres." };
    }
    account = { email: email.data, password: v.password };
  }

  const capacity = v.capacity ? Number(v.capacity) : null;
  if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) {
    return { error: "A capacidade precisa ser um número maior que zero." };
  }

  try {
    const result = await multiplyCafe({
      originGroupId: v.originGroupId,
      newLeaderParticipantId: v.newLeaderParticipantId,
      participantIds: v.participantIds.filter((id) => id !== v.newLeaderParticipantId),
      date: v.date || null,
      cafe: {
        name: v.name,
        address: v.address ?? null,
        region: v.region ?? null,
        available_days: v.available_days,
        meeting_time: v.meeting_time ?? null,
        capacity,
      },
      account,
    });
    revalidatePath("/gestao-membros");
    revalidatePath("/cafes");
    revalidatePath("/cafes/multiplicacao");
    return {
      success: true,
      cafeName: v.name,
      transferidas: v.participantIds.length,
      contaCriada: result.contaCriada,
      email: account?.email ?? null,
    };
  } catch (e) {
    return { error: toUserMessage(e, "actions.multiplyCafe", "Não foi possível registrar a multiplicação.") };
  }
}

// Registrar a origem de um café que já existia (multiplicações anteriores ao
// sistema).
export async function setCafeOriginAction(
  groupId: string,
  _state: { error?: string; success?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; success?: boolean } | undefined> {
  const profile = await getCurrentProfile();
  if (!isPeopleManagerRole(profile?.role)) {
    return { error: "Apenas a pastora ou a gestora de pessoas podem registrar uma multiplicação." };
  }
  const parent = (formData.get("parentGroupId") as string | null) || null;
  const date = (formData.get("date") as string | null) || null;
  try {
    await setCafeOrigin(groupId, parent, date);
  } catch (e) {
    return { error: toUserMessage(e, "actions.setCafeOrigin", "Não foi possível salvar o café de origem.") };
  }
  revalidatePath("/cafes/multiplicacao");
  return { success: true };
}
