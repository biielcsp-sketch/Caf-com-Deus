import "server-only";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/errors";
import { sortByName } from "@/lib/sort-by-name";

// Prazo para a líder confirmar o primeiro contato com quem acabou de chegar ao
// café dela. O mesmo número está na rotina do banco
// (app_escalate_pending_contacts, migration 20261018120000) — se mudar aqui,
// muda lá.
export const PRAZO_CONTATO_DIAS = 3;

export type PendingContact = {
  participantId: string;
  participantName: string;
  phone: string | null;
  whatsapp: string | null;
  leaderId: string;
  leaderName: string;
  leaderPhone: string | null;
  leaderWhatsapp: string | null;
  cafeName: string | null;
  assignedAt: string;
  diasDesde: number;
  atrasado: boolean;
};

const DIA_MS = 1000 * 60 * 60 * 24;

// Vínculos abertos sem contato confirmado. A RLS de participant_leader_history
// já recorta: a líder enxerga os dela; pastora e gestora enxergam todos.
// `leaderId` filtra de forma explícita na tela da líder (lição da v72: não
// confiar só na RLS quando a pessoa acumula papéis).
export async function listPendingContacts(opts: { leaderId?: string; somenteAtrasados?: boolean } = {}) {
  const supabase = await createClient();

  let query = supabase
    .from("participant_leader_history")
    .select(
      `participant_id, leader_id, created_at,
       participant:participants!participant_leader_history_participant_id_fkey(id, status, full_name, preferred_name, phone, whatsapp, deleted_at, anonymized_at, current_leader_id),
       leader:leaders!participant_leader_history_leader_id_fkey(id, profile:profiles(full_name, phone, whatsapp)),
       group:groups!participant_leader_history_group_id_fkey(name)`,
    )
    .is("end_date", null)
    .is("contact_confirmed_at", null);
  if (opts.leaderId) query = query.eq("leader_id", opts.leaderId);

  const { data, error } = await query;
  if (error) dbError(error, "contactAlerts.list");

  const agora = Date.now();
  const lista: PendingContact[] = [];
  for (const r of data ?? []) {
    const p = r.participant;
    if (!p || p.deleted_at || p.anonymized_at || p.status === "inativa" || p.current_leader_id !== r.leader_id) continue;
    const diasDesde = Math.floor((agora - new Date(r.created_at).getTime()) / DIA_MS);
    const atrasado = diasDesde >= PRAZO_CONTATO_DIAS;
    if (opts.somenteAtrasados && !atrasado) continue;
    lista.push({
      participantId: p.id,
      participantName: p.preferred_name ? `${p.full_name} (${p.preferred_name})` : p.full_name,
      phone: p.phone,
      whatsapp: p.whatsapp,
      leaderId: r.leader_id,
      leaderName: r.leader?.profile?.full_name ?? "—",
      leaderPhone: r.leader?.profile?.phone ?? null,
      leaderWhatsapp: r.leader?.profile?.whatsapp ?? null,
      cafeName: r.group?.name ?? null,
      assignedAt: r.created_at,
      diasDesde,
      atrasado,
    });
  }
  // Atrasadas primeiro, depois as mais antigas; empate por nome.
  return sortByName(lista, (c) => c.participantName).sort(
    (a, b) => Number(b.atrasado) - Number(a.atrasado) || b.diasDesde - a.diasDesde,
  );
}

export async function confirmParticipantContact(participantId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("app_confirm_participant_contact", {
    p_participant_id: participantId,
  });
  if (error) dbError(error, "contactAlerts.confirm", "Não foi possível confirmar o contato.");
}
