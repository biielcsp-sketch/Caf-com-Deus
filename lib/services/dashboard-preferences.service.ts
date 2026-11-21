import "server-only";
import { createClient } from "@/lib/supabase/server";
import { AppError, dbError } from "@/lib/errors";

// Ids que o Dashboard sabe exibir. Qualquer outro valor é descartado.
export const INDICADORES_VALIDOS = ["encontros-mes", "ativas", "lideres", "total"] as const;

function filtrar(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return INDICADORES_VALIDOS.filter((id) => ids.includes(id));
}

export async function getMyDashboardIndicadores(): Promise<string[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("dashboard_preferences")
    .select("indicadores")
    .eq("profile_id", user.id)
    .maybeSingle();
  return filtrar(data?.indicadores);
}

export async function saveMyDashboardIndicadores(ids: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AppError("Sessão expirada. Entre de novo.");
  const { error } = await supabase
    .from("dashboard_preferences")
    .upsert(
      { profile_id: user.id, indicadores: filtrar(ids), updated_at: new Date().toISOString() },
      { onConflict: "profile_id" },
    );
  if (error) dbError(error, "dashboard.prefs.save", "Não foi possível salvar a personalização.");
}
