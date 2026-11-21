import "server-only";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/errors";

// Avisos dentro do app. Quem cria é o banco (gatilho de novo vínculo e rotina
// de contato atrasado — migration 20261018120000); o app só lê e marca como
// lido. Filtra sempre por `profile_id` da sessão: a policy antiga de SELECT
// deixa admin ler as notificações de todo mundo, e o sino é pessoal.

async function myId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

export async function countMyUnreadNotifications() {
  const { supabase, userId } = await myId();
  if (!userId) return 0;
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", userId)
    .eq("read", false);
  if (error) dbError(error, "notifications.countUnread");
  return count ?? 0;
}

export async function listMyNotifications(limit = 50) {
  const { supabase, userId } = await myId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read, created_at")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) dbError(error, "notifications.list");
  return data ?? [];
}

export async function markMyNotificationsRead(ids?: string[]) {
  const { supabase, userId } = await myId();
  if (!userId) return;
  let query = supabase.from("notifications").update({ read: true }).eq("profile_id", userId).eq("read", false);
  if (ids && ids.length > 0) query = query.in("id", ids);
  const { error } = await query;
  if (error) dbError(error, "notifications.markRead");
}
