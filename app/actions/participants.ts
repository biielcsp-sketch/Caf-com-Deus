"use server";

import { isInactiveReason } from "@/lib/inactive-reasons";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ParticipantCreateSchema,
  ParticipantPersonalSchema,
  ParticipantAdminSchema,
  ParticipantSelfEditSchema,
} from "@/lib/validators/participant.schema";
import {
  createParticipant,
  createParticipantAsLeader,
  updateParticipantPersonal,
  updateParticipantAdminFields,
  changeParticipantStatus,
  claimParticipantAccount,
  updateMyParticipantProfile,
  getCurrentParticipant,
  setParticipantVisitor,
  confirmVisitorContact,
} from "@/lib/services/participants.service";
import { eraseParticipantNow } from "@/lib/services/erasure.service";
import { getCurrentProfile, isAdminRole } from "@/lib/services/profiles.service";
import { isLeaderRole, isPeopleManagerRole } from "@/lib/role-labels";
import { createClient } from "@/lib/supabase/server";
import { checkClaimAccountRateLimit, checkParticipantWriteRateLimit } from "@/lib/rate-limit";
import { logAuthEvent, isRlsDenied } from "@/lib/services/auth-audit.service";
import { toUserMessage } from "@/lib/errors";
import type { Enums } from "@/types/database.types";

export type FormActionState = { error?: string; success?: boolean; warning?: string } | undefined;

// Mesmo motivo do readOptionalString: desmarcar TODOS os checkboxes precisa
// gravar uma lista vazia, não sumir do payload e deixar a lista antiga.
function readArray(formData: FormData, key: string) {
  const values = formData.getAll(key).map(String).filter(Boolean);
  return values;
}

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

// Cadastro pela líder: mesmos campos pessoais do cadastro da pastora, sem
// nenhum campo administrativo. O vínculo com a líder e com o café dela é
// resolvido no serviço a partir da sessão — nunca vem do formulário, senão
// uma líder poderia cadastrar participante no nome de outra.
export async function createParticipantAsLeaderAction(
  _state: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const profile = await getCurrentProfile();
  if (!isLeaderRole(profile?.role)) {
    return { error: "Apenas líderes podem cadastrar participantes por aqui." };
  }

  const allowed = await checkParticipantWriteRateLimit(profile!.id);
  if (!allowed) {
    return { error: "Muitas alterações em pouco tempo. Aguarde um minuto e tente novamente." };
  }

  const validated = ParticipantPersonalSchema.safeParse({
    full_name: formData.get("full_name"),
    preferred_name: readOptionalString(formData, "preferred_name"),
    phone: readOptionalString(formData, "phone"),
    whatsapp: readOptionalString(formData, "whatsapp"),
    email: readOptionalString(formData, "email"),
    birth_date: readOptionalString(formData, "birth_date"),
    cep: readOptionalString(formData, "cep"),
    church_status: readOptionalString(formData, "church_status"),
    church_name: readOptionalString(formData, "church_name"),
    city: readOptionalString(formData, "city"),
    neighborhood: readOptionalString(formData, "neighborhood"),
    address: readOptionalString(formData, "address"),
    availability_days: readArray(formData, "availability_days"),
    availability_period: readArray(formData, "availability_period"),
    location_preference: readOptionalString(formData, "location_preference"),
    home_meeting_ok: formData.get("home_meeting_ok") === "on",
    other_notes: readOptionalString(formData, "other_notes"),
  });

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Verifique os campos do formulário." };
  }

  let created;
  try {
    created = await createParticipantAsLeader(validated.data);
  } catch (e) {
    if (isRlsDenied(e)) {
      await logAuthEvent("access_denied", profile!.id, { action: "createParticipantAsLeader" });
    }
    return { error: toUserMessage(e, "actions.participants.createAsLeader", "Erro ao cadastrar participante.") };
  }

  revalidatePath("/minhas-participantes");
  revalidatePath("/inicio");
  redirect(`/minhas-participantes/${created.id}`);
}

export async function createParticipantAction(
  _state: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const profile = await getCurrentProfile();
  if (!isAdminRole(profile?.role)) {
    return { error: "Apenas administradoras podem cadastrar participantes." };
  }

  const allowed = await checkParticipantWriteRateLimit(profile!.id);
  if (!allowed) {
    return { error: "Muitas alterações em pouco tempo. Aguarde um minuto e tente novamente." };
  }

  const validated = ParticipantCreateSchema.safeParse({
    full_name: formData.get("full_name"),
    preferred_name: readOptionalString(formData, "preferred_name"),
    phone: readOptionalString(formData, "phone"),
    whatsapp: readOptionalString(formData, "whatsapp"),
    email: readOptionalString(formData, "email"),
    birth_date: readOptionalString(formData, "birth_date"),
    cep: readOptionalString(formData, "cep"),
    church_status: readOptionalString(formData, "church_status"),
    church_name: readOptionalString(formData, "church_name"),
    city: readOptionalString(formData, "city"),
    neighborhood: readOptionalString(formData, "neighborhood"),
    address: readOptionalString(formData, "address"),
    availability_days: readArray(formData, "availability_days"),
    availability_period: readArray(formData, "availability_period"),
    location_preference: readOptionalString(formData, "location_preference"),
    home_meeting_ok: formData.get("home_meeting_ok") === "on",
    other_notes: readOptionalString(formData, "other_notes"),
    admin_notes: readOptionalString(formData, "admin_notes"),
    enrollment_source: readOptionalString(formData, "enrollment_source"),
    // `current_leader_id` era lido aqui e não existe em tela nenhuma: leitura
    // morta. A líder é atribuída pela distribuição, não por este formulário.
  });

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Verifique os campos do formulário." };
  }

  let created;
  try {
    created = await createParticipant(validated.data);
  } catch (e) {
    // Isto só dispara de verdade se alguém burlar a checagem de isAdminRole
    // acima (ex.: chamando a Server Action diretamente) — RLS de INSERT em
    // `participants` não tem policy para líder, então o insert seria negado
    // pelo Postgres (42501), não pela nossa checagem de app.
    if (isRlsDenied(e)) {
      await logAuthEvent("access_denied", profile!.id, { action: "createParticipant" });
    }
    return { error: toUserMessage(e, "actions.participants.create", "Erro ao cadastrar participante.") };
  }

  revalidatePath("/participantes");
  redirect(`/participantes/${created.id}`);
}

export async function updateParticipantPersonalAction(
  id: string,
  isLeaderRoute: boolean,
  _state: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sessão expirada. Faça login novamente." };

  // Revisão v41 (item 2.5): a ação recebe o id da ficha por parâmetro e
  // aceitava qualquer sessão. Ficha alheia a RLS já barrava — mas a policy
  // `participants_update_own` deixa a participante atualizar a PRÓPRIA
  // linha inteira, então ela conseguia chamar isto com o próprio id e
  // mexer em full_name, email, birth_date e cidade, campos que o formulário
  // dela (ParticipantSelfEditSchema) de propósito não expõe. O caminho da
  // participante é updateMyParticipantProfileAction, que resolve o alvo
  // pela sessão e usa o schema restrito.
  if (!isAdminRole(profile.role) && !isLeaderRole(profile.role)) {
    return { error: "Use a tela da sua jornada para atualizar os seus dados." };
  }

  const allowed = await checkParticipantWriteRateLimit(profile.id);
  if (!allowed) {
    return { error: "Muitas alterações em pouco tempo. Aguarde um minuto e tente novamente." };
  }

  const validated = ParticipantPersonalSchema.safeParse({
    full_name: formData.get("full_name"),
    preferred_name: readOptionalString(formData, "preferred_name"),
    phone: readOptionalString(formData, "phone"),
    whatsapp: readOptionalString(formData, "whatsapp"),
    email: readOptionalString(formData, "email"),
    birth_date: readOptionalString(formData, "birth_date"),
    cep: readOptionalString(formData, "cep"),
    church_status: readOptionalString(formData, "church_status"),
    church_name: readOptionalString(formData, "church_name"),
    city: readOptionalString(formData, "city"),
    neighborhood: readOptionalString(formData, "neighborhood"),
    address: readOptionalString(formData, "address"),
    availability_days: readArray(formData, "availability_days"),
    availability_period: readArray(formData, "availability_period"),
    location_preference: readOptionalString(formData, "location_preference"),
    home_meeting_ok: formData.get("home_meeting_ok") === "on",
    other_notes: readOptionalString(formData, "other_notes"),
  });

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Verifique os campos do formulário." };
  }

  try {
    await updateParticipantPersonal(id, validated.data);
  } catch (e) {
    return { error: toUserMessage(e, "actions.participants.save", "Erro ao salvar.") };
  }

  revalidatePath(isLeaderRoute ? `/minhas-participantes/${id}` : `/participantes/${id}`);
  redirect(isLeaderRoute ? `/minhas-participantes/${id}` : `/participantes/${id}`);
}

export async function updateParticipantAdminAction(
  id: string,
  _state: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const profile = await getCurrentProfile();
  // Mesmo portão do status logo abaixo: a Gestora de Pessoas cuida da
  // triagem das inscrições, então origem da inscrição e observações
  // internas são campos de trabalho dela. O banco já permitia
  // (participants_people_manager_update); o bloqueio era só aqui, e o
  // painel aparecia na ficha dela com o botão recusando.
  if (!isPeopleManagerRole(profile?.role)) {
    return { error: "Você não tem permissão para editar estes campos." };
  }

  const allowed = await checkParticipantWriteRateLimit(profile!.id);
  if (!allowed) {
    return { error: "Muitas alterações em pouco tempo. Aguarde um minuto e tente novamente." };
  }

  const validated = ParticipantAdminSchema.pick({ admin_notes: true, enrollment_source: true }).safeParse({
    admin_notes: readOptionalString(formData, "admin_notes"),
    enrollment_source: readOptionalString(formData, "enrollment_source"),
  });
  if (!validated.success) {
    return { error: "Verifique os campos administrativos." };
  }

  try {
    await updateParticipantAdminFields(id, validated.data);
  } catch (e) {
    return { error: toUserMessage(e, "actions.participants.save", "Erro ao salvar.") };
  }

  revalidatePath(`/participantes/${id}`);
  revalidatePath("/participantes");
  return { success: true };
}

// Devolve o erro em vez de lançar: exceção em Server Action vira "Minified
// React error #441" no navegador e a ficha da participante inteira some.
export async function changeParticipantStatusAction(
  id: string,
  _state: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const profile = await getCurrentProfile();
  // Gestora de Pessoas entra aqui junto com a pastora. Mover participante
  // entre as etapas da jornada é o trabalho dela, e o banco já permitia
  // (participants_people_manager_update / psh_people_manager_insert): o
  // bloqueio era só aqui, então o painel aparecia na ficha e o botão
  // recusava. A ação equivalente da líder (changeMyParticipantStatusAction)
  // e a de transferência já usavam a checagem mais larga — esta estava fora
  // de compasso com as duas.
  if (!isPeopleManagerRole(profile?.role)) {
    return { error: "Você não tem permissão para alterar o status." };
  }

  const status = formData.get("status") as Enums<"participant_status"> | null;
  const note = readOptionalString(formData, "note");
  const effectiveDate = readOptionalString(formData, "effective_date");
  const motivo = formData.get("inactive_reason");
  if (!status) return { error: "Selecione um status." };
  if (status === "inativa" && !isInactiveReason(motivo)) return { error: "Escolha o motivo da inatividade." };

  try {
    await changeParticipantStatus(id, status, note, effectiveDate, isInactiveReason(motivo) ? motivo : null);
  } catch (e) {
    return { error: toUserMessage(e, "actions.participants.status", "Erro ao alterar o status.") };
  }

  // A lista de participantes mostra e filtra por status: sem revalidá-la, a
  // participante continuava aparecendo no filtro antigo.
  revalidatePath(`/participantes/${id}`);
  revalidatePath("/participantes");
  revalidatePath("/minhas-participantes");
  // Mudar a situação baixa o contato pendente (gatilho no banco): os painéis
  // de aviso precisam recarregar.
  revalidatePath("/dashboard");
  revalidatePath("/gestao-membros");
  revalidatePath("/inicio");
  revalidatePath("/notificacoes");
  return { success: true };
}

// Status que a líder pode dar às PRÓPRIAS participantes. "Aguardando
// distribuição" fica de fora de propósito: ele só vale sem líder, e quem
// devolve a participante para a fila é o card "Precisa de outro café" (que
// também encerra o vínculo). "Nova inscrição" e "Distribuída" são etapas
// do fluxo da pastora/gestora, não algo que a líder escolhe.
const LEADER_SETTABLE_STATUSES: Enums<"participant_status">[] = ["ativa", "acompanhamento", "inativa"];

export async function changeMyParticipantStatusAction(
  id: string,
  status: Enums<"participant_status">,
  note: string,
  effectiveDate: string | null = null,
  inactiveReason: string | null = null,
): Promise<{ error?: string; success?: boolean }> {
  const profile = await getCurrentProfile();
  if (!profile || (!isLeaderRole(profile.role) && !isAdminRole(profile.role))) {
    return { error: "Você não tem permissão para alterar o status." };
  }
  if (!LEADER_SETTABLE_STATUSES.includes(status)) {
    return { error: "Status inválido." };
  }

  try {
    const data = effectiveDate && /^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) ? effectiveDate : null;
    if (status === "inativa" && !isInactiveReason(inactiveReason)) {
      return { error: "Escolha o motivo da inatividade." };
    }
    await changeParticipantStatus(
      id,
      status,
      note.trim().slice(0, 300) || null,
      data,
      isInactiveReason(inactiveReason) ? inactiveReason : null,
    );
  } catch (e) {
    return { error: toUserMessage(e, "actions.participants.myStatus", "Erro ao alterar o status.") };
  }

  revalidatePath(`/minhas-participantes/${id}`);
  revalidatePath("/minhas-participantes");
  revalidatePath("/meus-acompanhamentos");
  revalidatePath("/inicio");
  revalidatePath("/dashboard");
  revalidatePath("/gestao-membros");
  revalidatePath("/notificacoes");
  revalidatePath(`/participantes/${id}`);
  revalidatePath("/participantes");
  return { success: true };
}

const ClaimAccountSchema = z
  .object({
    email: z.email({ error: "Informe um e-mail válido." }),
    password: z.string().min(6, { error: "A senha precisa ter pelo menos 6 caracteres." }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

// A própria participante cria o acesso informando o e-mail que já está
// no cadastro dela. Não exige estar logada nem ser admin — é assim que
// ela ganha o primeiro acesso.
export async function claimParticipantAccountAction(
  _state: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const validated = ClaimAccountSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Verifique os campos do formulário." };
  }

  const { email, password } = validated.data;

  const allowed = await checkClaimAccountRateLimit(email);
  if (!allowed) {
    return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
  }

  try {
    await claimParticipantAccount(email, password);
  } catch (e) {
    return { error: toUserMessage(e, "actions.participants.claimAccount", "Erro ao criar o acesso.") };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    redirect("/login");
  }

  redirect("/minha-jornada");
}

export async function updateMyParticipantProfileAction(
  _state: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "participante") {
    return { error: "Apenas a própria participante pode editar estes dados." };
  }

  const participant = await getCurrentParticipant();
  if (!participant) return { error: "Cadastro de participante não encontrado." };

  const validated = ParticipantSelfEditSchema.safeParse({
    phone: readOptionalString(formData, "phone"),
    whatsapp: readOptionalString(formData, "whatsapp"),
    address: readOptionalString(formData, "address"),
    availability_days: readArray(formData, "availability_days"),
    availability_period: readArray(formData, "availability_period"),
    location_preference: readOptionalString(formData, "location_preference"),
    home_meeting_ok: formData.get("home_meeting_ok") === "on",
  });

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Verifique os campos do formulário." };
  }

  try {
    await updateMyParticipantProfile(participant.id, validated.data);
  } catch (e) {
    return { error: toUserMessage(e, "actions.participants.save", "Erro ao salvar.") };
  }

  revalidatePath("/minha-jornada");
  redirect("/minha-jornada");
}

// Botão "Excluir" da ficha da participante. Chama-se excluir porque é o que
// a pastora espera encontrar; por baixo, os dados pessoais somem e a jornada
// fica sem dono. Apagar a linha levaria junto presença e encontros, que são
// histórico da comunidade (ver erasure.service.ts).
// Devolve o erro em vez de lançar — ver o comentário em
// components/admin/delete-button.tsx.
export async function deleteParticipantAction(
  participantId: string,
): Promise<{ error?: string }> {
  const profile = await getCurrentProfile();
  if (!isAdminRole(profile?.role)) {
    return { error: "Apenas administradoras podem excluir participantes." };
  }

  try {
    await eraseParticipantNow(participantId, "Exclusão feita pela administração.");
  } catch (e) {
    return {
      error: toUserMessage(e, "actions.participants.delete", "Erro ao excluir a participante."),
    };
  }

  revalidatePath("/participantes");
  revalidatePath(`/participantes/${participantId}`);
  return {};
}

// Visitante: marcar, desmarcar e confirmar o contato. Líder (nas próprias
// participantes, a RLS garante) e pastora/gestora.
function revalidarVisitante(id: string) {
  revalidatePath(`/participantes/${id}`);
  revalidatePath(`/minhas-participantes/${id}`);
  revalidatePath("/participantes");
  revalidatePath("/minhas-participantes");
  revalidatePath("/relatorios");
  revalidatePath("/notificacoes");
}

export async function setVisitorAction(
  id: string,
  isVisitor: boolean,
): Promise<{ error?: string; success?: boolean }> {
  const profile = await getCurrentProfile();
  if (!profile || (!isLeaderRole(profile.role) && !isAdminRole(profile.role))) {
    return { error: "Você não tem permissão para marcar visitante." };
  }
  try {
    await setParticipantVisitor(id, isVisitor);
  } catch (e) {
    return { error: toUserMessage(e, "actions.participants.visitor", "Erro ao atualizar a marcação de visitante.") };
  }
  revalidarVisitante(id);
  return { success: true };
}

export async function confirmVisitorContactAction(id: string): Promise<{ error?: string; success?: boolean }> {
  const profile = await getCurrentProfile();
  if (!profile || (!isLeaderRole(profile.role) && !isAdminRole(profile.role))) {
    return { error: "Você não tem permissão para confirmar o contato." };
  }
  try {
    await confirmVisitorContact(id);
  } catch (e) {
    return { error: toUserMessage(e, "actions.participants.visitorContact", "Erro ao confirmar o contato.") };
  }
  revalidarVisitante(id);
  return { success: true };
}
