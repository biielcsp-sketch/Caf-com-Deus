import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/services/audit.service";
import { getMyLeaderContext } from "@/lib/services/leaders.service";
import { AppError, dbError } from "@/lib/errors";
import { hojeEmSaoPaulo } from "@/lib/dates";
import { INACTIVE_REASON_LABELS, type InactiveReason } from "@/lib/inactive-reasons";
import type { Tables, TablesInsert, Enums, Json } from "@/types/database.types";
import type {
  ParticipantCreateInput,
  ParticipantPersonalInput,
  ParticipantSelfEditInput,
} from "@/lib/validators/participant.schema";

export type ParticipantRow = Tables<"participants">;

export type ParticipantListItem = ParticipantRow & {
  leader: { id: string; full_name: string } | null;
  group: { id: string; name: string } | null;
};

export type ParticipantFilters = {
  search?: string;
  leaderId?: string;
  region?: string;
  status?: Enums<"participant_status">;
  groupId?: string;
  enrolledFrom?: string;
  enrolledTo?: string;
};

// Igreja: o campo novo (church_status) manda; o antigo (is_lagoinha_member,
// sim/não) é mantido em sincronia para quem ainda lê. O nome da igreja só vale
// para "outra". Sem resposta, o campo antigo não é tocado.
function churchColumns<T extends { church_status?: string | null; church_name?: string | null }>(input: T) {
  const { church_status, church_name, ...resto } = input;
  const status = church_status ?? null;
  return {
    ...resto,
    church_status: status,
    church_name: status === "outra" ? church_name?.trim() || null : null,
    ...(status ? { is_lagoinha_member: status === "lagoinha" } : {}),
  };
}

export function displayName(row: Pick<ParticipantRow, "full_name" | "anonymized_at">) {
  return row.anonymized_at ? "Participante removida" : row.full_name;
}

export async function listParticipants(filters: ParticipantFilters = {}) {
  const supabase = await createClient();

  let query = supabase
    .from("participants")
    .select(
      "*, leader:leaders!participants_current_leader_id_fkey(id, profile:profiles(full_name)), group:groups!participants_current_group_id_fkey(id, name)",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (filters.search) {
    query = query.ilike("full_name", `%${filters.search}%`);
  }
  if (filters.leaderId) {
    query = query.eq("current_leader_id", filters.leaderId);
  }
  if (filters.region) {
    query = query.or(`city.ilike.%${filters.region}%,neighborhood.ilike.%${filters.region}%`);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.groupId) {
    query = query.eq("current_group_id", filters.groupId);
  }
  if (filters.enrolledFrom) {
    query = query.gte("enrollment_date", filters.enrolledFrom);
  }
  if (filters.enrolledTo) {
    query = query.lte("enrollment_date", filters.enrolledTo);
  }

  const { data, error } = await query;
  if (error) dbError(error, "participants.list");

  return (data ?? []).map((row) => ({
    ...row,
    full_name: displayName(row),
    leader: row.leader ? { id: row.leader.id, full_name: row.leader.profile?.full_name ?? "" } : null,
    group: row.group,
  }));
}

export async function getParticipant(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("participants")
    .select(
      "*, leader:leaders!participants_current_leader_id_fkey(id, profile:profiles(full_name)), group:groups!participants_current_group_id_fkey(id, name), account:profiles!participants_profile_id_fkey(email)",
    )
    .eq("id", id)
    .single();

  if (error) return null;
  return {
    ...data,
    full_name: displayName(data),
    leader: data.leader ? { id: data.leader.id, full_name: data.leader.profile?.full_name ?? "" } : null,
    group: data.group,
  };
}

export type TimelineEntry = {
  id: string;
  date: string;
  kind: "status" | "leader";
  description: string;
};

export async function getParticipantTimeline(id: string): Promise<TimelineEntry[]> {
  const supabase = await createClient();

  const [statusHistory, leaderHistory] = await Promise.all([
    supabase
      .from("participant_status_history")
      .select("id, status, note, created_at, effective_date")
      .eq("participant_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("participant_leader_history")
      .select("id, start_date, end_date, reason, leader:leaders(id, profile:profiles(full_name))")
      .eq("participant_id", id)
      .order("start_date", { ascending: true }),
  ]);

  const entries: TimelineEntry[] = [];

  for (const row of statusHistory.data ?? []) {
    entries.push({
      id: `status-${row.id}`,
      date: row.effective_date ? `${row.effective_date}T12:00:00` : row.created_at,
      kind: "status",
      description:
        `Status alterado para "${row.status}"${row.note ? ` — ${row.note}` : ""}` +
        (row.effective_date
          ? ` (lançado em ${new Date(row.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })})`
          : ""),
    });
  }

  for (const row of leaderHistory.data ?? []) {
    const leaderName = row.leader?.profile?.full_name ?? "líder removida";
    entries.push({
      id: `leader-start-${row.id}`,
      date: row.start_date,
      kind: "leader",
      description: `Distribuída para ${leaderName}`,
    });
    if (row.end_date) {
      entries.push({
        id: `leader-end-${row.id}`,
        date: row.end_date,
        kind: "leader",
        description: `Encerrado o vínculo com ${leaderName}${row.reason ? ` — ${row.reason}` : ""}`,
      });
    }
  }

  // As entradas de status trazem `created_at` completo ("2026-09-23T14:00:00+00")
  // e as de vínculo trazem data pura ("2026-09-23"). Comparando como texto,
  // "2026-09-23" < "2026-09-23T...", então no mesmo dia TODO evento de vínculo
  // aparecia antes de todo evento de status, qualquer que fosse a hora real.
  // Compara só o dia; empate no mesmo dia mantém a ordem de inserção.
  return entries.sort((a, b) => a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)));
}

// Cadastro feito pela própria líder — a mulher que chegou no café dela e
// ainda não estava no sistema. Diferente do cadastro da pastora em dois
// pontos que importam: a participante já nasce vinculada a quem cadastrou
// (não entra na fila de distribuição, porque a líder dela já é conhecida) e
// a líder não envia campo administrativo nenhum (`admin_notes`,
// `current_leader_id`, origem) — o schema aceito aqui é só o de dados
// pessoais.
export async function createParticipantAsLeader(input: ParticipantPersonalInput) {
  const supabase = await createClient();

  const contexto = await getMyLeaderContext();
  if (!contexto) {
    throw new AppError("Só quem tem cadastro de líder pode cadastrar participante por aqui.");
  }
  if (contexto.status !== "ativa") {
    throw new AppError("Seu cadastro de líder está inativo. Fale com a pastora.");
  }

  const { availability_days, availability_period, email, ...rest } = churchColumns(input);

  const payload: TablesInsert<"participants"> = {
    ...rest,
    email: email || null,
    availability_days: availability_days ?? null,
    availability_period: availability_period ?? null,
    current_leader_id: contexto.leaderId,
    current_group_id: contexto.groupId,
    // "Ativa" e não "nova inscrição": quem cadastra é a líder que já está
    // com ela no café — não há primeiro contato pendente nem distribuição a
    // fazer. A trilha de acompanhamento começa do zero ("Em processo"), que
    // é o padrão da coluna.
    status: "ativa",
    enrollment_source: "Cadastro da líder",
  };

  // Uma função do Postgres, não dois inserts soltos: o vínculo no histórico
  // precisa existir desde o primeiro dia (é ele que alimenta a tela
  // "Histórico" e a jornada). Quando eram duas chamadas separadas e a segunda
  // falhava, sobrava uma participante com líder e SEM histórico nenhum — e aí
  // uma transferência futura fechava zero vínculos e abria um novo, como se
  // ela nunca tivesse sido da primeira líder.
  const { data, error } = await supabase.rpc("app_create_participant_by_leader", {
    p_payload: payload as unknown as Json,
    p_leader_id: contexto.leaderId,
    p_group_id: contexto.groupId,
  } as unknown as Parameters<typeof supabase.rpc<"app_create_participant_by_leader">>[1]);
  if (error) dbError(error, "participants.createAsLeader");
  if (!data) throw new AppError("Não foi possível cadastrar a participante. Tente novamente.");

  await logAuditEvent({
    action: "participant.create_by_leader",
    entity: "participants",
    entityId: data.id,
    after: { full_name: data.full_name, leader_id: contexto.leaderId },
  });

  return data;
}

export async function createParticipant(input: ParticipantCreateInput) {
  const supabase = await createClient();

  const { availability_days, availability_period, email, ...rest } = churchColumns(input);

  const payload: TablesInsert<"participants"> = {
    ...rest,
    email: email || null,
    availability_days: availability_days ?? null,
    availability_period: availability_period ?? null,
    status: "nova_inscricao",
  };

  const { data, error } = await supabase.from("participants").insert(payload).select().single();
  if (error) dbError(error, "participants.create");

  await logAuditEvent({
    action: "participant.create",
    entity: "participants",
    entityId: data.id,
    after: { full_name: data.full_name, status: data.status },
  });

  return data;
}

export async function updateParticipantPersonal(id: string, input: ParticipantPersonalInput) {
  const supabase = await createClient();
  const { email, ...rest } = churchColumns(input);

  const { data, error } = await supabase
    .from("participants")
    .update({ ...rest, email: email || null })
    .eq("id", id)
    .select()
    .single();

  if (error) dbError(error, "participants.updatePersonal");

  await logAuditEvent({
    action: "participant.update",
    entity: "participants",
    entityId: id,
    after: { fields: Object.keys(input) },
  });

  return data;
}

export async function updateParticipantAdminFields(
  id: string,
  input: { admin_notes?: string | null; enrollment_source?: string | null },
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("participants")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) dbError(error, "participants.updateAdminFields");

  await logAuditEvent({
    action: "participant.update_admin_fields",
    entity: "participants",
    entityId: id,
    after: { fields: Object.keys(input) },
  });

  return data;
}

export async function changeParticipantStatus(
  id: string,
  status: Enums<"participant_status">,
  note: string | null,
  // Data em que a mudança aconteceu de fato (lançamento retroativo). Vazio =
  // hoje. Data futura é recusada: o histórico registra o que já aconteceu.
  effectiveDate: string | null = null,
  // Obrigatório quando o novo status é "inativa" (o "regularidade" do PPT).
  inactiveReason: InactiveReason | null = null,
) {
  const supabase = await createClient();
  if (effectiveDate && effectiveDate > hojeEmSaoPaulo()) {
    throw new AppError("A data não pode ser no futuro.");
  }
  if (status === "inativa" && !inactiveReason) {
    throw new AppError("Informe o motivo de a participante ficar inativa.");
  }
  const motivo = status === "inativa" && inactiveReason ? INACTIVE_REASON_LABELS[inactiveReason] : null;
  note = motivo ? `${motivo}${note ? ` — ${note}` : ""}` : note;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // O histórico era gravado ANTES da mudança de status: falhando o update, a
  // linha do tempo da participante afirmava uma transição que não aconteceu
  // ("Status alterado para inativa") com o badge da ficha ainda em "Ativa".
  // Muda primeiro, registra depois.
  const { data, error } = await supabase
    .from("participants")
    .update({ status, inactive_reason: status === "inativa" ? inactiveReason : null })
    .eq("id", id)
    .select()
    .single();
  if (error) dbError(error, "participants.changeStatus");

  const { error: historyError } = await supabase.from("participant_status_history").insert({
    participant_id: id,
    status,
    note,
    changed_by: user?.id ?? null,
    effective_date: effectiveDate,
  });
  if (historyError) dbError(historyError, "participants.changeStatus.history");

  await logAuditEvent({
    action: "participant.status_change",
    entity: "participants",
    entityId: id,
    after: { status, note },
  });

  return data;
}

// Versão simples (pré-Fase 4): só troca o ponteiro current_leader_id, sem
// abrir/fechar registro em participant_leader_history — isso é o motor
// completo de transferência da Fase 4.
// Leitura mínima para popular selects (filtro por líder, "editar líder
// atual"). O CRUD completo de líderes é escopo da Fase 3.
// Traz também o endereço cadastrado da líder: o formulário do café usa
// isso para preencher sozinho o endereço do encontro quando a pastora
// escolhe a responsável, em vez de obrigá-la a redigitar o que já está no
// cadastro da líder.
export async function listActiveLeadersForSelect() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leaders")
    .select("id, meeting_address, region, city, neighborhood, profile:profiles(full_name)")
    .eq("status", "ativa");

  if (error) dbError(error, "participants.listActiveLeaders");
  // `.order("id")` num uuid v4 é ordem aleatória: o seletor de líderes
  // aparecia embaralhado em seis telas. Ordena pelo nome, que vem de uma
  // tabela embutida e por isso não dá para ordenar no banco.
  return (data ?? [])
    .map((l) => ({
    id: l.id,
    full_name: l.profile?.full_name ?? "",
    address: l.meeting_address ?? null,
    region: l.region ?? l.city ?? l.neighborhood ?? null,
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
}

// Histórico de vínculos da líder atual (participantes que são ou já foram
// dela) — usado na tela "Histórico" do perfil da líder.
export async function getLeaderAssignmentHistory(leaderId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("participant_leader_history")
    .select("id, start_date, end_date, reason, participant:participants(id, full_name, anonymized_at)")
    .eq("leader_id", leaderId)
    .order("start_date", { ascending: false });

  if (error) dbError(error, "participants.leaderAssignmentHistory");
  return (data ?? []).map((row) => ({
    ...row,
    participant: row.participant
      ? {
          id: row.participant.id,
          full_name: row.participant.anonymized_at ? "Participante removida" : row.participant.full_name,
        }
      : null,
  }));
}

export async function listGroupsForSelect() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("groups").select("id, name").order("name");
  if (error) dbError(error, "participants.listGroupsForSelect");
  return data ?? [];
}

// ── Acesso próprio da participante ──────────────────────────────────────

// A própria participante cria o acesso: informa o e-mail que já está no
// cadastro dela (feito pela admin/líder no momento da inscrição) e uma
// senha à sua escolha. O e-mail é o elo que garante que só quem tem um
// cadastro de participante existente consegue criar login — por isso a
// busca abaixo, não um formulário onde a admin digita o e-mail por ela.
// Usa service_role — só chame a partir de uma Server Action pública que
// não pede papel nenhum (é a própria participante, ainda sem login).
export async function claimParticipantAccount(email: string, password: string) {
  const admin = createAdminClient();

  // Revisão v41 (item 2.3): a busca era `.ilike("email", email)` seguida de
  // `.maybeSingle()`, e o resultado dela é quem define de qual participante
  // a conta vai ser criada. Dois problemas:
  //
  //   1. `%` e `_` são curingas de LIKE (e `*` vira `%` no PostgREST), e os
  //      três são caracteres válidos na parte local de um e-mail — o Zod não
  //      barra. Um "e-mail" como `a%@dominio.com` casava com a linha de
  //      outra participante.
  //   2. `email` não tem constraint de unicidade, e `.maybeSingle()` devolve
  //      ERRO (não linha) quando vem mais de uma.
  //
  // A correção não tenta escapar os curingas no padrão: o comportamento
  // exato do escape depende de como o PostgREST codifica o valor, e um
  // e-mail comum com `_` (maria_silva@...) passaria a depender disso para
  // funcionar. Em vez disso o ilike vira só uma peneira ampla — pode trazer
  // linhas a mais, nunca a menos — e quem decide é a comparação exata em
  // JS abaixo. Um curinga então só consegue trazer linhas que a peneira
  // seguinte descarta.
  const normalizedEmail = email.trim().toLowerCase();

  const { data: found, error: findError } = await admin
    .from("participants")
    .select("id, full_name, profile_id, email")
    .ilike("email", normalizedEmail)
    .is("deleted_at", null)
    .is("anonymized_at", null)
    .limit(10);
  if (findError) dbError(findError, "participants.claimAccount.find");

  const matches = (found ?? []).filter(
    (row) => row.email?.trim().toLowerCase() === normalizedEmail,
  );

  if (matches.length > 1) {
    // Duas participantes com o mesmo e-mail: não dá para saber de quem é a
    // conta que está sendo criada, e chutar a primeira criaria login no
    // cadastro da pessoa errada. Só a administração resolve.
    console.error(
      `[participants.claimAccount] ${matches.length} participantes com o mesmo e-mail`,
    );
    throw new AppError(
      "Encontramos mais de um cadastro com esse e-mail. Fale com sua líder para resolver antes de criar o acesso.",
    );
  }

  const participant = matches[0];
  if (!participant) {
    throw new AppError(
      "Não encontramos esse e-mail no nosso cadastro. Confirme com sua líder se o e-mail está certo.",
    );
  }
  if (participant.profile_id) {
    throw new AppError("Este e-mail já tem acesso criado. Faça login normalmente.");
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: participant.full_name },
  });
  if (createError || !created.user) {
    dbError(createError, "participants.claimAccount.createUser", "Não foi possível criar o acesso.");
  }

  // app_handle_new_user já criou o profile com role 'lider' por padrão;
  // corrige para 'participante' e vincula ao registro existente.
  const { error: roleError } = await admin
    .from("profiles")
    .update({ role: "participante" })
    .eq("id", created.user.id);
  if (roleError) dbError(roleError, "participants.claimAccount.setRole");

  const { error: linkError } = await admin
    .from("participants")
    .update({ profile_id: created.user.id })
    .eq("id", participant.id);
  if (linkError) dbError(linkError, "participants.claimAccount.link");

  await logAuditEvent({
    action: "participant.create_account",
    entity: "participants",
    entityId: participant.id,
    after: { email: normalizedEmail },
  });
}

export async function getCurrentParticipant() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("participants")
    .select(
      "*, leader:leaders!participants_current_leader_id_fkey(id, profile:profiles(full_name, phone, whatsapp)), group:groups!participants_current_group_id_fkey(id, name, address, meeting_time)",
    )
    .eq("profile_id", user.id)
    .maybeSingle();

  if (error) dbError(error, "participants.getCurrent");
  return data;
}

export async function updateMyParticipantProfile(id: string, input: ParticipantSelfEditInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AppError("Sessão expirada. Faça login novamente.");

  // Revisão v41 (item 2.5): além do `id`, filtra por `profile_id` da sessão.
  // A RLS já garante isso (`participants_update_own`), mas o alvo desta
  // função vem por parâmetro e ela é o caminho da própria participante —
  // amarrar o filtro à sessão faz o erro aparecer aqui, e não depender de
  // uma policy continuar existindo amanhã.
  const { data, error } = await supabase
    .from("participants")
    .update(input)
    .eq("id", id)
    .eq("profile_id", user.id)
    .select()
    .single();

  if (error) dbError(error, "participants.updateMyProfile");
  return data;
}


// Visitante: tag na ficha, fora da jornada. Marcar avisa a líder (gatilho no
// banco) e, passados 3 dias sem contato confirmado, ela é lembrada uma vez.
// Os carimbos de data são preenchidos pelo próprio banco.
export async function setParticipantVisitor(id: string, isVisitor: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("participants")
    .update({ is_visitor: isVisitor })
    .eq("id", id)
    .select("id, is_visitor")
    .single();
  if (error) dbError(error, "participants.setVisitor");

  await logAuditEvent({
    action: isVisitor ? "participant.visitor_mark" : "participant.visitor_unmark",
    entity: "participants",
    entityId: id,
    after: { is_visitor: isVisitor },
  });
  return data;
}

export async function confirmVisitorContact(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("app_confirm_visitor_contact", { p_participant_id: id });
  if (error) dbError(error, "participants.confirmVisitorContact", "Não foi possível confirmar o contato.");
}
