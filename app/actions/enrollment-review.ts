"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  approveAndDistribute,
  approveAndDistributeBatch,
  approveEnrollmentManually,
  markEnrollmentAsDuplicateOrSpam,
  type BatchApproveResult,
} from "@/lib/services/enrollment-review.service";
import { getCurrentProfile } from "@/lib/services/profiles.service";
import { isPeopleManagerRole } from "@/lib/role-labels";
import { toUserMessage } from "@/lib/errors";
import type { FormActionState } from "@/app/actions/participants";

const GESTAO_PATH = "/gestao-membros";
const REVIEW_PATH = "/gestao-membros/novas-inscricoes";
const FILA_PATH = "/gestao-membros/novas-inscricoes";

// Revalida também as telas que a aprovação muda: a lista geral e o que a
// líder que recebeu a participante enxerga.
function revalidarTelasDaRevisao() {
  revalidatePath(GESTAO_PATH);
  revalidatePath(REVIEW_PATH);
  revalidatePath(FILA_PATH);
  revalidatePath("/participantes");
  revalidatePath("/minhas-participantes");
  revalidatePath("/inicio");
}

async function ehGestaoDePessoas() {
  const profile = await getCurrentProfile();
  return isPeopleManagerRole(profile?.role);
}

const SEM_PERMISSAO = "Apenas a pastora ou a gestora de pessoas podem revisar novas inscrições.";

// As três actions abaixo devolvem o erro em vez de lançar: uma exceção aqui
// fazia o quadro inteiro de novas inscrições sumir (e a seleção em lote já
// marcada ir junto), mostrando só a tela de erro genérica do Next.
export async function approveAndDistributeAction(
  participantId: string,
  _state: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  if (!(await ehGestaoDePessoas())) return { error: SEM_PERMISSAO };

  const leaderId = formData.get("leader_id") as string | null;
  const groupId = (formData.get("group_id") as string | null) || null;
  if (!leaderId) return { error: "Selecione uma líder." };

  try {
    await approveAndDistribute(participantId, leaderId, groupId);
  } catch (e) {
    return { error: toUserMessage(e, "actions.enrollmentReview.approve", "Erro ao aprovar a inscrição.") };
  }
  revalidarTelasDaRevisao();
  return { success: true };
}

export async function approveEnrollmentManuallyAction(
  participantId: string,
  _state: FormActionState,
  _formData: FormData,
): Promise<FormActionState> {
  if (!(await ehGestaoDePessoas())) return { error: SEM_PERMISSAO };

  try {
    await approveEnrollmentManually(participantId);
  } catch (e) {
    return { error: toUserMessage(e, "actions.enrollmentReview.manual", "Erro ao aprovar a inscrição.") };
  }
  revalidarTelasDaRevisao();
  return { success: true };
}

export async function markEnrollmentAsDuplicateAction(
  participantId: string,
  _state: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  if (!(await ehGestaoDePessoas())) return { error: SEM_PERMISSAO };

  const note =
    (formData.get("note") as string | null)?.trim() ||
    "Marcada como duplicata/spam na revisão de novas inscrições.";

  try {
    await markEnrollmentAsDuplicateOrSpam(participantId, note);
  } catch (e) {
    return { error: toUserMessage(e, "actions.enrollmentReview.duplicate", "Erro ao marcar a inscrição.") };
  }
  revalidarTelasDaRevisao();
  return { success: true };
}

const BatchItemSchema = z.object({
  participantId: z.uuid(),
  fullName: z.string(),
  leaderId: z.uuid(),
  groupId: z.uuid().nullable(),
});

export type BatchApproveActionState =
  | { status: "done"; results: BatchApproveResult[] }
  | { status: "error"; error: string }
  | undefined;

export async function approveAndDistributeBatchAction(
  _state: BatchApproveActionState,
  formData: FormData,
): Promise<BatchApproveActionState> {
  // Antes isto era `await assertAdmin()`, que LANÇAVA — fora do try, então o
  // caminho "não sou admin" quebrava o modal inteiro em vez de mostrar a
  // mensagem.
  if (!(await ehGestaoDePessoas())) return { status: "error", error: SEM_PERMISSAO };

  const raw = formData.get("payload");
  let parsedJson: unknown;
  try {
    parsedJson = typeof raw === "string" ? JSON.parse(raw) : null;
  } catch {
    return { status: "error", error: "Seleção inválida. Marque as participantes novamente." };
  }

  const validated = z.array(BatchItemSchema).min(1).safeParse(parsedJson);
  if (!validated.success) {
    return { status: "error", error: "Selecione ao menos uma participante para aprovar em lote." };
  }

  try {
    const results = await approveAndDistributeBatch(validated.data);
    revalidarTelasDaRevisao();
    return { status: "done", results };
  } catch (e) {
    return {
      status: "error",
      error: toUserMessage(e, "actions.enrollmentReview.batch", "Não foi possível processar o lote. Tente novamente."),
    };
  }
}
