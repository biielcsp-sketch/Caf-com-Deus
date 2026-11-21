import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, dbError } from "@/lib/errors";
import { getCurrentProfile } from "@/lib/services/profiles.service";
import { logAuditEvent } from "@/lib/services/audit.service";
import { isPeopleManagerRole } from "@/lib/role-labels";
import { compareNames, sortByName } from "@/lib/sort-by-name";

// Multiplicação de café: um café "dá à luz" outro. Uma participante do café
// de origem vira líder do café novo e as que forem junto são transferidas
// numa operação só (RPC app_multiply_cafe — migration 20261018130000).

export type CafeOption = {
  id: string;
  name: string;
  leaderName: string;
  participantes: number;
  parentGroupId: string | null;
  multipliedAt: string | null;
};

export async function listCafesForMultiplication(): Promise<CafeOption[]> {
  const supabase = await createClient();
  const [{ data: groups, error }, { data: parts, error: partsError }] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, parent_group_id, multiplied_at, leader:leaders(id, profile:profiles(full_name))")
      .neq("status", "inativo"),
    supabase
      .from("participants")
      .select("current_group_id")
      .is("deleted_at", null)
      .is("anonymized_at", null)
      .not("current_group_id", "is", null),
  ]);
  if (error) dbError(error, "multiplication.cafes");
  if (partsError) dbError(partsError, "multiplication.cafes.count");

  const contagem = new Map<string, number>();
  for (const p of parts ?? []) {
    if (p.current_group_id) contagem.set(p.current_group_id, (contagem.get(p.current_group_id) ?? 0) + 1);
  }

  return (groups ?? [])
    .map((g) => ({
      id: g.id,
      name: g.name,
      leaderName: g.leader?.profile?.full_name ?? "Sem líder",
      participantes: contagem.get(g.id) ?? 0,
      parentGroupId: g.parent_group_id,
      multipliedAt: g.multiplied_at,
    }))
    .sort((a, b) => compareNames(a.name, b.name));
}

export type CafeMember = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  hasAccount: boolean;
};

export async function listCafeMembers(groupId: string): Promise<CafeMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("participants")
    .select("id, full_name, email, phone, whatsapp, profile_id")
    .eq("current_group_id", groupId)
    .is("deleted_at", null)
    .is("anonymized_at", null);
  if (error) dbError(error, "multiplication.members");
  return sortByName(
    (data ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      phone: p.phone,
      whatsapp: p.whatsapp,
      hasAccount: Boolean(p.profile_id),
    })),
    (p) => p.full_name,
  );
}

export type MultiplyInput = {
  originGroupId: string;
  newLeaderParticipantId: string;
  participantIds: string[];
  date: string | null;
  cafe: {
    name: string;
    address: string | null;
    region: string | null;
    available_days: string[];
    meeting_time: string | null;
    capacity: number | null;
  };
  // Só quando a nova líder ainda não tem login no app.
  account?: { email: string; password: string };
};

export async function multiplyCafe(input: MultiplyInput) {
  // service_role cria o login quando a nova líder não tem — então a checagem
  // de papel aqui não é só UX (a RPC repete a checagem no banco).
  const profile = await getCurrentProfile();
  if (!isPeopleManagerRole(profile?.role)) {
    throw new AppError("Apenas a pastora ou a gestora de pessoas podem registrar uma multiplicação.");
  }

  const supabase = await createClient();
  const { data: lider, error: liderError } = await supabase
    .from("participants")
    .select("id, full_name, phone, whatsapp, profile_id, current_group_id")
    .eq("id", input.newLeaderParticipantId)
    .single();
  if (liderError || !lider) dbError(liderError, "multiplication.leader", "Participante não encontrada.");
  if (lider.current_group_id !== input.originGroupId) {
    throw new AppError("A nova líder precisa ser participante do café de origem.");
  }

  let profileId = lider.profile_id;
  let contaCriada: string | null = null;

  if (!profileId) {
    if (!input.account) {
      throw new AppError("A nova líder ainda não tem acesso ao app. Informe o e-mail e a senha provisória.");
    }
    const admin = createAdminClient();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: input.account.email,
      password: input.account.password,
      email_confirm: true,
      user_metadata: { full_name: lider.full_name, must_change_password: true },
    });
    if (createError || !created.user) {
      const jaExiste =
        createError?.code === "email_exists" ||
        /already been registered|already exists/i.test(createError?.message ?? "");
      dbError(
        createError,
        "multiplication.createUser",
        jaExiste
          ? "Já existe uma conta com esse e-mail. Use outro e-mail ou vincule a conta existente."
          : "Não foi possível criar o acesso da nova líder.",
      );
    }
    profileId = created.user.id;
    contaCriada = created.user.id;
    // app_handle_new_user cria o profile como 'lider'; completa o contato.
    await admin
      .from("profiles")
      .update({ phone: lider.phone, whatsapp: lider.whatsapp })
      .eq("id", profileId);
  }

  const { data: novoCafeId, error } = await supabase.rpc("app_multiply_cafe", {
    p_origin_group_id: input.originGroupId,
    p_new_leader_participant_id: input.newLeaderParticipantId,
    p_new_leader_profile_id: profileId,
    p_cafe: input.cafe,
    p_participant_ids: input.participantIds,
    ...(input.date ? { p_date: input.date } : {}),
  });
  if (error) {
    // Sem isto sobrava um login de líder sem café e sem linha em `leaders`.
    if (contaCriada) await createAdminClient().auth.admin.deleteUser(contaCriada);
    dbError(error, "multiplication.rpc", error.message || "Não foi possível registrar a multiplicação.");
  }

  // Motivo da inatividade de quem passou a liderar (a RPC já a deixou Inativa).
  await supabase
    .from("participants")
    .update({ inactive_reason: "multiplicou_o_cafe" })
    .eq("id", input.newLeaderParticipantId);

  await logAuditEvent({
    action: "cafe.multiply",
    entity: "groups",
    entityId: novoCafeId as string,
    after: {
      origin_group_id: input.originGroupId,
      new_leader_participant_id: input.newLeaderParticipantId,
      transferidas: input.participantIds.length,
    },
  });

  return { groupId: novoCafeId as string, contaCriada: Boolean(contaCriada) };
}

export async function setCafeOrigin(groupId: string, parentGroupId: string | null, date: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("app_set_cafe_origin", {
    p_group_id: groupId,
    p_parent_group_id: parentGroupId,
    p_date: date,
  });
  if (error) dbError(error, "multiplication.setOrigin", error.message || "Não foi possível salvar o café de origem.");
}

// ---------------------------------------------------------------------------
// Árvore (aba Multiplicação em Cafés)

export type TreeNode = {
  id: string;
  name: string;
  status: string;
  leader: { name: string; phone: string | null; whatsapp: string | null } | null;
  address: string | null;
  region: string | null;
  available_days: string[];
  meeting_time: string | null;
  multipliedAt: string | null;
  participants: { id: string; full_name: string }[];
  children: TreeNode[];
};

export async function getMultiplicationTree() {
  const supabase = await createClient();
  const [{ data: groups, error }, { data: parts, error: partsError }] = await Promise.all([
    supabase
      .from("groups")
      .select(
        "id, name, status, address, region, available_days, meeting_time, parent_group_id, multiplied_at, leader:leaders(profile:profiles(full_name, phone, whatsapp))",
      ),
    supabase
      .from("participants")
      .select("id, full_name, current_group_id")
      .is("deleted_at", null)
      .is("anonymized_at", null)
      .not("current_group_id", "is", null),
  ]);
  if (error) dbError(error, "multiplication.tree");
  if (partsError) dbError(partsError, "multiplication.tree.participants");

  const porCafe = new Map<string, { id: string; full_name: string }[]>();
  for (const p of parts ?? []) {
    const lista = porCafe.get(p.current_group_id as string) ?? [];
    lista.push({ id: p.id, full_name: p.full_name });
    porCafe.set(p.current_group_id as string, lista);
  }

  const nos = new Map<string, TreeNode & { parent: string | null }>();
  for (const g of groups ?? []) {
    nos.set(g.id, {
      id: g.id,
      name: g.name,
      status: g.status,
      leader: g.leader?.profile
        ? { name: g.leader.profile.full_name, phone: g.leader.profile.phone, whatsapp: g.leader.profile.whatsapp }
        : null,
      address: g.address,
      region: g.region,
      available_days: g.available_days ?? [],
      meeting_time: g.meeting_time,
      multipliedAt: g.multiplied_at,
      participants: sortByName(porCafe.get(g.id) ?? [], (p) => p.full_name),
      children: [],
      parent: g.parent_group_id,
    });
  }

  const raizes: TreeNode[] = [];
  for (const no of nos.values()) {
    const pai = no.parent ? nos.get(no.parent) : null;
    if (pai) pai.children.push(no);
    else raizes.push(no);
  }
  const ordenar = (lista: TreeNode[]) => {
    lista.sort(
      (a, b) => (a.multipliedAt ?? "").localeCompare(b.multipliedAt ?? "") || compareNames(a.name, b.name),
    );
    lista.forEach((n) => ordenar(n.children));
  };
  ordenar(raizes);

  // Só os cafés que fazem parte de alguma multiplicação formam a árvore; os
  // demais aparecem separados, para registrar a origem quando for o caso.
  const arvores = raizes.filter((r) => r.children.length > 0);
  const avulsos = raizes.filter((r) => r.children.length === 0);
  return { arvores, avulsos };
}
