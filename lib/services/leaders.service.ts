import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/services/audit.service";
import { getOcupacaoAtual } from "@/lib/services/occupancy.service";
import { getCurrentProfile, isAdminRole } from "@/lib/services/profiles.service";
import { revokeUserSessions } from "@/lib/services/session.service";
import { AppError, dbError } from "@/lib/errors";
import type { Enums, Tables, TablesUpdate } from "@/types/database.types";
import type { LeaderProfileUpdateInput } from "@/lib/validators/leader.schema";

export type LeaderRow = Tables<"leaders">;

export async function listLeaders() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leaders")
    .select(
      "*, profile:profiles(full_name, email, phone), groups(id, name)",
    )
    .order("status");

  if (error) dbError(error, "leaders.list");

  // Ocupação vem do serviço dedicado, que ignora participantes excluídas —
  // a contagem embutida não ignorava e mostrava líder "lotada" sem estar.
  const { porLider } = await getOcupacaoAtual();

  return (data ?? [])
    .map((l) => ({
    ...l,
    full_name: l.profile?.full_name ?? "—",
    email: l.profile?.email ?? null,
    phone: l.profile?.phone ?? null,
    occupied: porLider.get(l.id) ?? 0,
    // Nomes dos cafés que ficariam sem responsável se ela fosse excluída —
    // a confirmação de exclusão precisa avisar isso pelo nome.
    cafes: (l.groups ?? []).map((g) => g.name),
    }))
    // `.order("id")` ordenava por uuid aleatório: a lista embaralhava a cada
    // carregamento. Ordena pelo nome dentro de cada status.
    // Status primeiro ("ativa" < "inativa"), nome depois. Ordenar só pelo nome
    // jogava fora o `.order("status")` e misturava líderes inativas no meio
    // das ativas.
    .sort(
      (a, b) =>
        a.status.localeCompare(b.status) || a.full_name.localeCompare(b.full_name, "pt-BR"),
    );
}

export async function getLeader(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leaders")
    .select("*, profile:profiles(full_name, email, phone, whatsapp), groups(id, name)")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

export async function updateLeader(id: string, input: TablesUpdate<"leaders">) {
  const supabase = await createClient();
  if (input.max_capacity !== undefined && input.max_capacity !== null && input.max_capacity <= 0) {
    throw new AppError("A capacidade máxima precisa ser maior que zero.");
  }

  const { data, error } = await supabase.from("leaders").update(input).eq("id", id).select().single();
  if (error) dbError(error, "leaders.update");

  // S7: uma líder inativada não pode continuar usando a sessão que já
  // tinha aberta — sem isso, o acesso dela só cai quando o token expirar
  // naturalmente.
  if (input.status === "inativa") {
    await revokeUserSessions(data.profile_id);
  }

  await logAuditEvent({ action: "leader.update", entity: "leaders", entityId: id, after: input });
  return data;
}

export async function setLeaderStatus(id: string, status: "ativa" | "inativa") {
  return updateLeader(id, { status });
}

// Dados da CONTA da líder (linha em `profiles` + e-mail de login em
// auth.users). Antes isso só existia na tela "Contas", exclusiva do perfil
// Desenvolvedor — a pastora não tinha como corrigir um e-mail ou um
// telefone digitado errado no cadastro, mesmo sendo ela quem cadastra as
// líderes. No banco nunca houve impedimento: a policy `profiles_update` já
// libera app_is_admin() para qualquer linha e o guard de auto-escalação
// (app_guard_profile_self_update) isenta admin — o bloqueio era só de tela.
//
// O e-mail é a exceção que exige service_role: ele vive em dois lugares
// (auth.users, que é o login, e profiles.email, que é o que as telas
// mostram) e os dois precisam mudar na mesma operação. Trocar só o
// profiles.email deixaria a líder entrando com o endereço antigo e a
// pastora vendo o novo — o pior dos dois mundos.
export async function updateLeaderProfile(leaderId: string, input: LeaderProfileUpdateInput) {
  const current = await getCurrentProfile();
  if (!isAdminRole(current?.role)) {
    throw new AppError("Apenas a pastora ou a desenvolvedora podem alterar os dados da conta.");
  }

  const supabase = await createClient();
  const { data: leader, error: findError } = await supabase
    .from("leaders")
    .select("profile_id, profile:profiles(email)")
    .eq("id", leaderId)
    .single();
  if (findError) dbError(findError, "leaders.updateProfile.find");

  const profileId = leader.profile_id;
  const emailNovo = input.email.trim().toLowerCase();
  const emailAtual = (leader.profile?.email ?? "").trim().toLowerCase();

  const admin = createAdminClient();

  if (emailNovo !== emailAtual) {
    const { error: authError } = await admin.auth.admin.updateUserById(profileId, {
      email: emailNovo,
      email_confirm: true,
    });
    if (authError) {
      dbError(
        authError,
        "leaders.updateProfile.authEmail",
        "Não foi possível alterar o e-mail. Confira se ele está correto e se já não existe outra conta usando esse endereço.",
      );
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({
      full_name: input.full_name,
      email: emailNovo,
      phone: input.phone || null,
      whatsapp: input.whatsapp || null,
    })
    .eq("id", profileId);
  if (error) dbError(error, "leaders.updateProfile");

  await logAuditEvent({
    action: "leader.update_profile",
    entity: "profiles",
    entityId: profileId,
    after: { full_name: input.full_name, email: emailNovo },
  });
}

export type CreateLeaderAccountInput = {
  full_name: string;
  email: string;
  password: string;
  phone?: string | null;
  whatsapp?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  meeting_address?: string | null;
  region?: string | null;
  max_capacity: number;
  // Co-líder: mesma função da líder (mesma linha em `leaders`, mesmas
  // permissões via app_current_leader_id()) — muda só o rótulo do papel.
  role?: "lider" | "co_lider";
};

// Cria o login da líder e o registro em `leaders`. Usa service_role — só
// chame a partir de uma Server Action que já validou que quem está pedindo
// é admin.
//
// A conta nasce com senha provisória e e-mail já confirmado, no mesmo
// molde de claimParticipantAccount(). Antes isso era um convite por
// e-mail (inviteUserByEmail), que dependia do serviço de e-mail embutido
// do Supabase — limitado a poucos envios por hora e, nas palavras da
// própria documentação deles, "para experimentar", com disponibilidade
// best-effort. Na prática o cadastro travava a partir da segunda líder
// seguida. Sem e-mail nenhum, não há limite nenhum: a pastora passa a
// senha por WhatsApp e a líder é obrigada a trocar no primeiro acesso.
export async function createLeaderAccount(input: CreateLeaderAccountInput) {
  // Checagem redundante: a Server Action que chama isto já valida admin, mas
  // service_role ignora RLS — repetimos a checagem aqui (defesa em
  // profundidade) para que um futuro caller desprotegido não vire um convite
  // de líder disparado por qualquer usuário autenticado.
  const profile = await getCurrentProfile();
  if (!isAdminRole(profile?.role)) {
    throw new AppError("Apenas administradoras podem cadastrar líderes.");
  }

  if (input.max_capacity <= 0) throw new AppError("A capacidade máxima precisa ser maior que zero.");

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    // Sem e-mail de confirmação: quem cadastrou foi a pastora, o endereço
    // já veio conferido por ela.
    email_confirm: true,
    // `must_change_password` é lido pelo proxy.ts direto do usuário da
    // sessão (sem consulta extra ao banco) para empurrar a líder à troca
    // no primeiro acesso. Não é barreira de segurança — user_metadata é
    // gravável pela própria usuária —, é o que faz a senha provisória não
    // virar definitiva por esquecimento.
    user_metadata: { full_name: input.full_name, must_change_password: true },
  });
  if (createError || !created.user) {
    // O erro de e-mail repetido é o único que a admin consegue resolver
    // sozinha, então ele merece uma frase própria.
    const alreadyExists =
      createError?.code === "email_exists" ||
      /already been registered|already exists/i.test(createError?.message ?? "");
    dbError(
      createError,
      "leaders.create.createUser",
      alreadyExists
        ? "Já existe uma conta com esse e-mail. Confira a lista de lideranças ou use outro endereço."
        : "Não foi possível criar o acesso da líder.",
    );
  }

  // app_handle_new_user já criou o profile com role 'lider'; ajusta
  // telefone/whatsapp e, quando for co-líder, o papel.
  const roleToSet = input.role === "co_lider" ? "co_lider" : null;
  if (input.phone || input.whatsapp || roleToSet) {
    // O retorno era descartado: se este update falhasse, uma conta criada
    // como CO-LÍDER era gravada como líder (e telefone/WhatsApp recém
    // digitados sumiam) sem ninguém ficar sabendo.
    const { error: perfilError } = await admin
      .from("profiles")
      .update({
        phone: input.phone ?? null,
        whatsapp: input.whatsapp ?? null,
        ...(roleToSet ? { role: roleToSet } : {}),
      })
      .eq("id", created.user.id);
    if (perfilError) {
      await admin.auth.admin.deleteUser(created.user.id);
      dbError(perfilError, "leaders.create.updateProfile", "Não foi possível criar o acesso da líder.");
    }
  }

  const { data: leader, error: leaderError } = await admin
    .from("leaders")
    .insert({
      profile_id: created.user.id,
      city: input.city ?? null,
      neighborhood: input.neighborhood ?? null,
      meeting_address: input.meeting_address ?? null,
      region: input.region ?? null,
      max_capacity: input.max_capacity,
      status: "ativa",
    })
    .select()
    .single();
  if (leaderError) {
    // Sem esta limpeza sobrava um login válido com papel de líder e SEM linha
    // em `leaders`: ela entrava no app e todas as telas de liderança ficavam
    // vazias, e a conta nem aparecia na lista de lideranças para consertar.
    await admin.auth.admin.deleteUser(created.user.id);
    dbError(leaderError, "leaders.create");
  }

  await logAuditEvent({
    action: "leader.create",
    entity: "leaders",
    entityId: leader.id,
    after: { full_name: input.full_name, email: input.email },
  });

  return leader;
}

// Contas com papel Anfitriã, para o seletor do formulário de grupo.
// Contexto da líder logada: a linha dela em `leaders` e o café que ela
// lidera. A policy `leaders_select` já limita a consulta à própria linha,
// então não há como isto devolver a liderança de outra pessoa — mesmo se
// alguém chamar de um lugar sem checagem de papel.
export async function getMyLeaderContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("leaders")
    .select("id, status, groups(id, name)")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (error) dbError(error, "leaders.myContext");
  if (!data) return null;

  // `groups.leader_id` aponta para `leaders`, então o PostgREST devolve uma
  // lista aqui (uma líder pode, em tese, ter mais de um café). Hoje é sempre
  // zero ou um; pegamos o primeiro.
  const cafe = Array.isArray(data.groups) ? data.groups[0] : data.groups;

  return {
    leaderId: data.id,
    status: data.status,
    groupId: cafe?.id ?? null,
    groupName: cafe?.name ?? null,
  };
}

export type HostCandidate = {
  id: string;
  full_name: string;
  role: Enums<"user_role">;
  // Endereço de onde essa pessoa recebe — usado pelo formulário do café
  // para preencher o endereço do encontro sozinho.
  address: string | null;
  region: string | null;
};

// Candidatas a anfitriã de um café. Antes esta lista trazia apenas contas
// com o papel "Anfitriã", o que deixava de fora o caso real de uma líder
// que também recebe um café em casa: ela não aparecia no campo, e não
// havia como registrar os dois "cargos" na mesma pessoa.
//
// No banco isso nunca foi um impedimento: a permissão da anfitriã não vem
// de `profiles.role`, vem de `groups.host_profile_id = auth.uid()` (as
// policies participants_host_select / groups_host_select / meetings_host_
// select / attendance_host_select, criadas na migration da trilha). Ou
// seja, acumular líder + anfitriã já funcionava — faltava a tela permitir
// escolher. Admin e desenvolvedor ficam de fora de propósito: são contas
// de sistema, não pessoas que recebem café em casa.
//
// Cada candidata vem com o endereço dela para o formulário do café
// preencher o endereço do encontro automaticamente: da linha de `leaders`
// quando é liderança, do cadastro de participante quando é anfitriã sem
// cadastro de liderança.
export async function listHostsForSelect(): Promise<HostCandidate[]> {
  const supabase = await createClient();

  // Só o primeiro resultado capturava erro. Falhando os outros dois, o
  // seletor de anfitriã carregava e o preenchimento automático de endereço
  // simplesmente parava de funcionar, sem nenhum aviso.
  const [
    { data: perfis, error },
    { data: liderancas, error: liderancasError },
    { data: participantes, error: participantesError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ["anfitria", "lider", "co_lider"])
      .eq("active", true)
      .order("full_name"),
    supabase.from("leaders").select("profile_id, meeting_address, region, city, neighborhood"),
    supabase
      .from("participants")
      .select("profile_id, address, city, neighborhood")
      .not("profile_id", "is", null)
      .is("deleted_at", null),
  ]);

  if (error) dbError(error, "leaders.listHostsForSelect");
  if (liderancasError) dbError(liderancasError, "leaders.listHostsForSelect.leaders");
  if (participantesError) dbError(participantesError, "leaders.listHostsForSelect.participants");

  const porLideranca = new Map((liderancas ?? []).map((l) => [l.profile_id, l] as const));
  const porParticipante = new Map((participantes ?? []).map((p) => [p.profile_id, p] as const));

  return (perfis ?? []).map((p) => {
    const lideranca = porLideranca.get(p.id);
    const participante = porParticipante.get(p.id);

    // Liderança primeiro: quem tem cadastro de líder já informou ali o
    // endereço onde o café acontece, que é mais específico que o endereço
    // residencial do cadastro de participante.
    const address = lideranca?.meeting_address ?? participante?.address ?? null;
    const region =
      lideranca?.region ??
      lideranca?.city ??
      participante?.city ??
      lideranca?.neighborhood ??
      participante?.neighborhood ??
      null;

    return { id: p.id, full_name: p.full_name, role: p.role, address, region };
  });
}

// Exclui a líder de verdade: a linha de `leaders`, o profile e o login.
// Só passa quando não há nada pendurado nela — participantes, grupos,
// encontros, acompanhamentos ou histórico de vínculo. Todas essas FKs são
// "no action" no banco, então apagar com histórico não é uma escolha de
// produto: o Postgres recusaria. Quando há histórico, o caminho certo é
// inativar (a líder some das listas de distribuição e perde a sessão, mas
// os encontros dela continuam existindo).
export async function deleteLeader(id: string) {
  const profile = await getCurrentProfile();
  if (!isAdminRole(profile?.role)) {
    throw new AppError("Apenas a pastora ou a desenvolvedora podem excluir uma líder.");
  }

  const admin = createAdminClient();
  const { data: leader, error: leaderError } = await admin
    .from("leaders")
    .select("id, profile_id, profile:profiles(full_name)")
    .eq("id", id)
    .single();
  if (leaderError || !leader) throw new AppError("Líder não encontrada.");

  if (leader.profile_id === profile!.id) {
    throw new AppError("Você não pode excluir o seu próprio cadastro de líder.");
  }

  // Uma consulta por tabela em vez de um laço genérico: o tipo gerado do
  // banco amarra o nome da coluna à tabela, então um laço só passaria com
  // `any` — e aqui errar a coluna significaria excluir com histórico.
  //
  // Café NÃO entra mais nesta lista: ele não é histórico, é um ponteiro que
  // pode ficar nulo (ver migration cafe_sem_lider). Os quatro que sobraram
  // são registros que existiram de fato e que apagar levaria junto — e são
  // FKs "no action", então o Postgres recusaria mesmo sem esta checagem.
  const [participantes, encontros, acompanhamentos, historico] = await Promise.all([
    // `.is("deleted_at", null)`: sem isto, uma participante já excluída
    // continuava contando aqui e travava a exclusão da líder com a mensagem
    // "tem 1 participante sob responsabilidade dela" — uma participante que
    // não aparece em tela nenhuma, deixando a pastora sem saída.
    admin
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("current_leader_id", id)
      .is("deleted_at", null),
    admin.from("meetings").select("id", { count: "exact", head: true }).eq("leader_id", id),
    admin.from("follow_ups").select("id", { count: "exact", head: true }).eq("leader_id", id),
    admin.from("participant_leader_history").select("id", { count: "exact", head: true }).eq("leader_id", id),
  ]);

  const vinculos: { rotulo: string; total: number }[] = [];
  for (const [rotulo, resultado] of [
    ["participante(s) sob responsabilidade dela", participantes],
    ["encontro(s) registrado(s)", encontros],
    ["acompanhamento(s) escrito(s)", acompanhamentos],
    ["registro(s) no histórico de vínculo", historico],
  ] as const) {
    if (resultado.error) dbError(resultado.error, "leaders.delete.check");
    if (resultado.count && resultado.count > 0) {
      vinculos.push({ rotulo, total: resultado.count });
    }
  }

  if (vinculos.length > 0) {
    const lista = vinculos.map((v) => `${v.total} ${v.rotulo}`).join(", ");
    throw new AppError(
      `Não dá para excluir: esta líder tem ${lista}. Apagar levaria junto esse histórico. ` +
        'Transfira as participantes para outra líder e, se ela saiu da equipe, use "Inativar líder".',
    );
  }

  // Solta os cafés dela antes de apagar a linha: a FK é "no action", então
  // sem isto o DELETE seria recusado pelo banco. Os cafés continuam
  // existindo, com participantes, encontros e fotos — só ficam sem
  // responsável até a pastora atribuir outra líder.
  const { data: cafesSoltos, error: cafesError } = await admin
    .from("groups")
    .update({ leader_id: null })
    .eq("leader_id", id)
    .select("id, name");
  if (cafesError) dbError(cafesError, "leaders.delete.soltarCafes");

  // Se ela também era anfitriã de algum café, o mesmo vale para esse
  // ponteiro — senão o profile dela não sai e o login fica sobrando.
  const { data: cafesHospedados, error: hostError } = await admin
    .from("groups")
    .update({ host_profile_id: null })
    .eq("host_profile_id", leader.profile_id)
    .select("id, name");
  if (hostError) dbError(hostError, "leaders.delete.soltarAnfitria");

  const { error: deleteLeaderError } = await admin.from("leaders").delete().eq("id", id);
  if (deleteLeaderError) dbError(deleteLeaderError, "leaders.delete.leader");

  // O profile pode ter histórico próprio (audit_log, presença registrada).
  // Se tiver, o Postgres recusa e paramos aqui: a linha de `leaders` já
  // saiu, então ela deixa de ser líder de fato; sobra só o login, que a
  // desenvolvedora desativa em Contas.
  const { error: profileError } = await admin.from("profiles").delete().eq("id", leader.profile_id);
  if (!profileError) {
    const { error: authError } = await admin.auth.admin.deleteUser(leader.profile_id);
    if (authError) dbError(authError, "leaders.delete.auth");
  }

  const cafesSemLider = [
    ...(cafesSoltos ?? []).map((c) => c.name),
    ...(cafesHospedados ?? []).map((c) => c.name),
  ].filter((nome, i, todos) => todos.indexOf(nome) === i);

  await logAuditEvent({
    action: "leader.delete",
    entity: "leaders",
    entityId: id,
    after: {
      full_name: leader.profile?.full_name ?? null,
      login_removido: !profileError,
      cafes_sem_lider: cafesSemLider,
    },
  });

  return { loginRemovido: !profileError, cafesSemLider };
}
