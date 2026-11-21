import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPublicEnrollmentRateLimit } from "@/lib/rate-limit";
import { AppError, dbError } from "@/lib/errors";
import type { PublicEnrollmentInput } from "@/lib/validators/public-enrollment.schema";
import type { Json, TablesInsert } from "@/types/database.types";

export type PublicEnrollmentResult = "created" | "duplicate" | "discarded";

// Q2: a rota pública /cadastro valida `?origem=` contra isto ANTES de
// mostrar o formulário — link sem origem rastreável não deve permitir
// cadastro. `enrollment_sources` só tem policy de RLS para `authenticated`
// (admin CRUD, líder select) — quem acessa esta página não tem sessão
// nenhuma, por isso o client admin, não o normal.
export type PublicEnrollmentSource = {
  id: string;
  code: string;
  // Preenchidos quando o link pertence a uma líder: quem se inscreve por ele
  // entra direto no café dela, sem passar pela distribuição.
  leaderId: string | null;
  groupId: string | null;
  groupName: string | null;
};

// Devolve a origem se o link vale, ou null. Link de líder inativa não vale
// (a pessoa cairia num café sem responsável).
export async function getPublicEnrollmentSource(
  code: string,
): Promise<PublicEnrollmentSource | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("enrollment_sources")
    .select("id, code, leader_id, group_id, leader:leaders(status), group:groups(name)")
    .eq("code", code)
    .eq("active", true)
    .maybeSingle();
  if (error) dbError(error, "publicEnrollment.validateSource");
  if (!data) return null;

  if (data.leader_id) {
    const leader = Array.isArray(data.leader) ? data.leader[0] : data.leader;
    if (!leader || leader.status !== "ativa") return null;
  }

  const group = Array.isArray(data.group) ? data.group[0] : data.group;
  return {
    id: data.id,
    code: data.code,
    leaderId: data.leader_id,
    groupId: data.group_id,
    groupName: group?.name ?? null,
  };
}

export async function validateEnrollmentSource(code: string): Promise<boolean> {
  return Boolean(await getPublicEnrollmentSource(code));
}

// Reaproveitado tanto pelo autocadastro (abaixo) quanto pela tela de
// revisão de novas inscrições (Q3) — a mesma checagem de duplicata não
// pode ter duas implementações divergentes.
export async function findDuplicateParticipantByPhone(
  phone: string,
  excludeParticipantId?: string,
) {
  const admin = createAdminClient();
  let query = admin
    .from("participants")
    .select("id")
    .eq("phone", phone.trim())
    .neq("status", "inativa")
    .is("deleted_at", null);
  if (excludeParticipantId) {
    query = query.neq("id", excludeParticipantId);
  }
  // Revisão v41 (item 2.4): era `.maybeSingle()`, que devolve ERRO quando
  // vem mais de uma linha — e `phone` não tem constraint de unicidade. Mãe
  // e filha com o mesmo celular (ou duas irmãs, ou um telefone de casa)
  // derrubavam dois fluxos de uma vez: o cadastro público pelo QR Code
  // passava a falhar para qualquer pessoa com aquele número, e a tela de
  // revisão de novas inscrições (Q3) quebrava ao calcular a pré-seleção.
  // Para a pergunta que esta função responde — "já existe alguém com este
  // telefone?" — a primeira linha basta.
  const { data, error } = await query.limit(1);
  if (error) dbError(error, "publicEnrollment.findDuplicate");
  return data?.[0] ?? null;
}

export async function findDuplicateParticipantByCpf(cpf: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("participants")
    .select("id")
    .eq("cpf", cpf)
    .is("deleted_at", null)
    .limit(1);
  if (error) dbError(error, "publicEnrollment.findDuplicateCpf");
  return data?.[0] ?? null;
}

// Desfaz a conta criada no início do cadastro quando a participante não
// chega a ser gravada — senão o e-mail ficaria "preso" numa conta sem
// cadastro e a pessoa nunca mais conseguiria se inscrever com ele.
// profiles.id referencia auth.users sem cascade, então o profile sai antes.
async function rollbackNewAccount(userId: string) {
  const admin = createAdminClient();
  const { error: profileError } = await admin.from("profiles").delete().eq("id", userId);
  if (profileError) {
    console.error("[publicEnrollment.rollback] profile não removido:", profileError.message);
    return;
  }
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) {
    console.error("[publicEnrollment.rollback] usuário não removido:", authError.message);
  }
}

// Único ponto do sistema onde alguém sem sessão autenticada escreve no
// banco (decisão travada no CLAUDE.md). NUNCA via policy de RLS `anon` em
// `participants` — RLS restringe linha, não coluna, e uma policy anônima
// de INSERT deixaria qualquer visitante escrever `status`,
// `current_leader_id` ou `admin_notes` direto pela API do Supabase,
// ignorando o formulário (ver seção 4 do documento de arquitetura). Por
// isso sempre `service_role`, com o payload montado campo a campo.
export async function submitPublicEnrollment(
  input: PublicEnrollmentInput,
  ip: string,
): Promise<PublicEnrollmentResult> {
  // 1. Honeypot: só bot preenche esse campo (escondido na tela, Q2). Quem
  // chama isto deve responder sucesso genérico de qualquer forma — nunca
  // ensinar o bot a se adaptar revelando que foi descartado.
  if (input.website) {
    return "discarded";
  }

  // 2. Rate limit por IP — pré-autenticado, reaproveita o núcleo do S4
  // (/lib/rate-limit.ts).
  const allowed = await checkPublicEnrollmentRateLimit(ip);
  if (!allowed) {
    throw new AppError("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
  }

  // 3. O link precisa valer de novo aqui no servidor: é ele que decide em
  // qual café a participante entra. Validar só na página deixaria qualquer
  // POST forjado escolher a origem.
  const source = await getPublicEnrollmentSource(input.code);
  if (!source) {
    throw new AppError("Este link de inscrição não está mais disponível.");
  }

  // 4. Duplicata por CPF ou telefone (status != 'inativa') — mesma pessoa
  // escaneando o QR de novo não deve virar um segundo cadastro, e quem já
  // está no sistema não ganha conta nova por aqui (senão bastaria saber o CPF
  // de alguém para assumir o cadastro dela).
  const [byCpf, byPhone] = await Promise.all([
    findDuplicateParticipantByCpf(input.cpf),
    findDuplicateParticipantByPhone(input.phone),
  ]);
  if (byCpf || byPhone) {
    return "duplicate";
  }

  const admin = createAdminClient();
  const email = input.email.trim().toLowerCase();

  // 5. Cria o usuário ANTES do cadastro: o Auth é quem garante que o e-mail
  // é único e que a senha é aceita. `email_confirm: true` porque ainda não há
  // SMTP próprio para mandar a confirmação (pendente: domínio) — quando houver,
  // este é o ponto que passa a exigir confirmação por e-mail.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name.trim() },
  });
  if (createError || !created.user) {
    if (createError && (createError.code === "email_exists" || createError.status === 422)) {
      throw new AppError(
        "Já existe um acesso com esse e-mail. Entre com sua senha ou use \"Esqueci minha senha\" na tela de login.",
      );
    }
    dbError(createError, "publicEnrollment.createUser", "Não foi possível criar seu acesso. Tente novamente.");
  }
  const userId = created.user.id;

  // app_handle_new_user cria o profile como 'lider' por padrão; corrige.
  const { error: roleError } = await admin
    .from("profiles")
    .update({ role: "participante", full_name: input.full_name.trim() })
    .eq("id", userId);
  if (roleError) {
    await rollbackNewAccount(userId);
    dbError(roleError, "publicEnrollment.setRole");
  }

  // 6. Payload montado campo a campo — NUNCA spread do body recebido.
  // status, contact_authorized_at, enrollment_source e o vínculo com líder
  // são decididos aqui, nunca vêm do formulário (item 6).
  const payload: TablesInsert<"participants"> = {
    full_name: input.full_name.trim(),
    preferred_name: input.preferred_name?.trim() || null,
    phone: input.phone.trim(),
    whatsapp: input.whatsapp?.trim() || null,
    email,
    cpf: input.cpf,
    is_lagoinha_member: input.church_status === "lagoinha",
    church_status: input.church_status,
    church_name: input.church_status === "outra" ? input.church_name?.trim() || null : null,
    cep: input.cep || null,
    profile_id: userId,
    birth_date: input.birth_date || null,
    city: input.city?.trim() || null,
    neighborhood: input.neighborhood?.trim() || null,
    address: input.address?.trim() || null,
    availability_days: input.availability_days ?? null,
    availability_period: input.availability_period ?? null,
    location_preference: input.location_preference?.trim() || null,
    home_meeting_ok: input.home_meeting_ok ?? true,
    other_notes: input.other_notes?.trim() || null,
    status: "nova_inscricao",
    // A autorização de contato é o único registro de consentimento que o
    // sistema guarda. O Zod já exige `contact_authorized === true` antes de
    // chegar aqui; o horário é decidido no servidor, nunca vem do formulário.
    contact_authorized_at: new Date().toISOString(),
    enrollment_source: input.code,
  };

  // 7. Gravação com service_role — comentário acima explica por que RLS/anon
  // não é usado aqui.
  if (source.leaderId) {
    // Link de líder: entra direto no café dela, com histórico, numa função só.
    const { error: linkError } = await admin.rpc("app_enroll_participant_via_leader_link", {
      p_payload: payload as unknown as Json,
      p_leader_id: source.leaderId,
      p_group_id: source.groupId,
    } as unknown as Parameters<typeof admin.rpc<"app_enroll_participant_via_leader_link">>[1]);
    if (linkError) {
      await rollbackNewAccount(userId);
      dbError(linkError, "publicEnrollment.enrollViaLeaderLink", isCpfConflict(linkError) ? CPF_TAKEN : undefined);
    }
  } else {
    const { error: insertError } = await admin.from("participants").insert(payload);
    if (insertError) {
      await rollbackNewAccount(userId);
      dbError(insertError, "publicEnrollment.insert", isCpfConflict(insertError) ? CPF_TAKEN : undefined);
    }
  }

  return "created";
}

// Duas pessoas enviando o mesmo CPF ao mesmo tempo passam pela checagem de
// duplicata; quem barra de verdade é o índice único do banco (23505).
const CPF_TAKEN = "Este CPF já está cadastrado. Se você já participa, entre com seu acesso.";
function isCpfConflict(error: { code?: string; message?: string }) {
  return error.code === "23505" && (error.message ?? "").includes("participants_cpf_unique");
}
