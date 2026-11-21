import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getMyLeaderContext } from "@/lib/services/leaders.service";
import { displayName } from "@/lib/services/participants.service";
import { AppError, dbError } from "@/lib/errors";
import type { Tables } from "@/types/database.types";

export type EnrollmentSourceRow = Tables<"enrollment_sources">;

const DEFAULT_LABEL = "Cadastro público";
const DEFAULT_CODE = "cadastro";

// Um único QR fixo pro sistema inteiro (decisão do usuário — não mais uma
// origem nomeada por evento). Se já existir alguma linha em
// enrollment_sources (inclusive de quando a tela ainda permitia criar
// várias), reaproveita a mais antiga como a canônica; só cria uma nova se
// não existir nenhuma ainda. O código nunca muda depois de criado — é o
// que fica impresso no QR.
export async function getOrCreateDefaultEnrollmentSource(): Promise<EnrollmentSourceRow> {
  const supabase = await createClient();
  const { data: existing, error } = await supabase
    .from("enrollment_sources")
    .select("*")
    // Os links das líderes (leader_id preenchido) não são o QR geral.
    .is("leader_id", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) dbError(error, "enrollmentSources.getDefault");
  if (existing) return existing;

  const { data: created, error: createError } = await supabase
    .from("enrollment_sources")
    .insert({ label: DEFAULT_LABEL, code: DEFAULT_CODE, active: true })
    .select()
    .single();
  if (createError) dbError(createError, "enrollmentSources.createDefault");
  return created;
}

// Link de inscrição da líder logada: um só, criado na primeira vez que ela
// abre a tela e reaproveitado depois. O código é aleatório e nunca muda — é
// o que fica no QR e nos links já enviados. Quem se inscreve por ele entra
// direto no café dela (ver public-enrollment.service.ts).
export async function getOrCreateMyLeaderEnrollmentSource(): Promise<{
  code: string;
  groupName: string | null;
}> {
  const contexto = await getMyLeaderContext();
  if (!contexto) throw new AppError("Só quem tem cadastro de líder tem link de inscrição.");
  if (contexto.status !== "ativa") {
    throw new AppError("Seu cadastro de líder está inativo. Fale com a pastora.");
  }

  const supabase = await createClient();
  const { data: existing, error } = await supabase
    .from("enrollment_sources")
    .select("code")
    .eq("leader_id", contexto.leaderId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) dbError(error, "enrollmentSources.getMyLeaderLink");
  if (existing) return { code: existing.code, groupName: contexto.groupName };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AppError("Sessão expirada. Faça login novamente.");

  const code = `l-${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;
  const { error: createError } = await supabase.from("enrollment_sources").insert({
    label: `Link da líder${contexto.groupName ? ` · ${contexto.groupName}` : ""}`,
    code,
    active: true,
    leader_id: contexto.leaderId,
    group_id: contexto.groupId,
    created_by: user.id,
  });
  if (createError) dbError(createError, "enrollmentSources.createMyLeaderLink");

  return { code, groupName: contexto.groupName };
}

export type EnrollmentRegistration = {
  id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
};

// "Quem se cadastrou" — todo mundo que entrou pelo QR fixo, mais recente
// primeiro.
export async function listEnrollmentRegistrations(code: string): Promise<EnrollmentRegistration[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("participants")
    .select("id, full_name, phone, anonymized_at, created_at")
    .eq("enrollment_source", code)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) dbError(error, "enrollmentSources.listRegistrations");
  return (data ?? []).map((row) => ({
    id: row.id,
    full_name: displayName(row),
    phone: row.anonymized_at ? null : row.phone,
    created_at: row.created_at,
  }));
}
