import "server-only";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/errors";
import { compareNames } from "@/lib/sort-by-name";

// Relatórios pedidos no PPT de melhorias (slide 9). Tudo calculado aqui a
// partir de meetings / attendance / follow_ups, num período escolhido. O
// volume é de um ministério (centenas de linhas), então vale buscar as linhas
// e contar no servidor em vez de criar views no banco.

export type ReportPeriod = { from: string; to: string };

const FOLLOW_UP_STATUS_LABELS: Record<string, string> = {
  normal: "Normal",
  atencao: "Atenção",
  acompanhamento_necessario: "Acompanhamento necessário",
};

const FOLLOW_UP_TYPE_LABELS: Record<string, string> = {
  encontro: "Encontro",
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  visita: "Visita",
  oracao: "Oração",
  acompanhamento_pastoral: "Acompanhamento pastoral",
  outro: "Outro",
};

export async function getReports(period: ReportPeriod) {
  const supabase = await createClient();

  const { data: meetings, error } = await supabase
    .from("meetings")
    .select("id, status, date, group:groups(id, name), leader:leaders(profile:profiles(full_name))")
    .gte("date", period.from)
    .lte("date", period.to);
  if (error) dbError(error, "reports.meetings");

  const realizados = (meetings ?? []).filter((m) => m.status === "realizado");
  const cancelados = (meetings ?? []).filter((m) => m.status === "cancelado").length;
  const idsRealizados = realizados.map((m) => m.id);

  const [att, fu] = await Promise.all([
    idsRealizados.length
      ? supabase
          .from("attendance")
          .select("meeting_id, status, participant:participants(id, full_name, anonymized_at, is_visitor, visitor_contact_confirmed_at)")
          .in("meeting_id", idsRealizados)
          .eq("status", "presente")
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("follow_ups")
      .select(
        "id, status, type, date, participant:participants(id, full_name, anonymized_at), leader:leaders(profile:profiles(full_name))",
      )
      .gte("date", period.from)
      .lte("date", period.to)
      .is("deleted_at", null),
  ]);
  if (att.error) dbError(att.error, "reports.attendance");
  if (fu.error) dbError(fu.error, "reports.followUps");

  const presencas = att.data ?? [];
  const nomeParticipante = (p: { full_name: string; anonymized_at: string | null } | null) =>
    !p ? "—" : p.anonymized_at ? "(cadastro excluído)" : p.full_name;

  // Participação por pessoa (visitante leva a marca no nome)
  const porPessoa = new Map<string, { nome: string; presencas: number }>();
  for (const a of presencas) {
    if (!a.participant) continue;
    const nome = nomeParticipante(a.participant) + (a.participant.is_visitor ? " (visitante)" : "");
    const atual = porPessoa.get(a.participant.id) ?? { nome, presencas: 0 };
    atual.presencas++;
    porPessoa.set(a.participant.id, atual);
  }

  // Visitantes que estiveram presentes no período
  const nomeDoCafe = new Map(realizados.map((m) => [m.id, m.group?.name ?? "Sem café"]));
  const visitantes = new Map<
    string,
    { nome: string; cafe: string; presencas: number; contatoConfirmado: boolean }
  >();
  let presencasVisitantes = 0;
  for (const a of presencas) {
    if (!a.participant?.is_visitor) continue;
    presencasVisitantes++;
    const atual = visitantes.get(a.participant.id) ?? {
      nome: nomeParticipante(a.participant),
      cafe: nomeDoCafe.get(a.meeting_id) ?? "Sem café",
      presencas: 0,
      contatoConfirmado: !!a.participant.visitor_contact_confirmed_at,
    };
    atual.presencas++;
    visitantes.set(a.participant.id, atual);
  }

  // Participantes x cafés
  const cafePorEncontro = new Map(realizados.map((m) => [m.id, m.group?.id ?? "sem-cafe"]));
  const porCafe = new Map<
    string,
    { nome: string; lider: string; encontros: number; presencas: number; unicas: Set<string> }
  >();
  for (const m of realizados) {
    const chave = m.group?.id ?? "sem-cafe";
    const atual = porCafe.get(chave) ?? {
      nome: m.group?.name ?? "Sem café",
      lider: m.leader?.profile?.full_name ?? "—",
      encontros: 0,
      presencas: 0,
      unicas: new Set<string>(),
    };
    atual.encontros++;
    porCafe.set(chave, atual);
  }
  for (const a of presencas) {
    const c = porCafe.get(cafePorEncontro.get(a.meeting_id) ?? "sem-cafe");
    if (!c) continue;
    c.presencas++;
    if (a.participant) c.unicas.add(a.participant.id);
  }

  // Acompanhamentos
  const followUps = fu.data ?? [];
  const acompPorPessoa = new Map<string, { nome: string; total: number; ultimo: string }>();
  const acompPorStatus = new Map<string, number>();
  const acompPorTipo = new Map<string, number>();
  for (const f of followUps) {
    acompPorStatus.set(f.status, (acompPorStatus.get(f.status) ?? 0) + 1);
    acompPorTipo.set(f.type, (acompPorTipo.get(f.type) ?? 0) + 1);
    if (!f.participant) continue;
    const atual = acompPorPessoa.get(f.participant.id) ?? {
      nome: nomeParticipante(f.participant),
      total: 0,
      ultimo: f.date,
    };
    atual.total++;
    if (f.date > atual.ultimo) atual.ultimo = f.date;
    acompPorPessoa.set(f.participant.id, atual);
  }

  return {
    resumo: {
      cafesRealizados: realizados.length,
      cafesCancelados: cancelados,
      totalPresencas: presencas.length,
      participantesUnicas: porPessoa.size,
      presencasVisitantes,
      acompanhamentos: followUps.length,
    },
    participantesPorCafe: [...porCafe.values()]
      .map((c) => ({
        cafe: c.nome,
        lider: c.lider,
        encontros: c.encontros,
        presencas: c.presencas,
        unicas: c.unicas.size,
        mediaPorEncontro: c.encontros ? Math.round((c.presencas / c.encontros) * 10) / 10 : 0,
      }))
      .sort((a, b) => compareNames(a.cafe, b.cafe)),
    visitantesNoPeriodo: [...visitantes.values()].sort(
      (a, b) => b.presencas - a.presencas || compareNames(a.nome, b.nome),
    ),
    participacaoPorPessoa: [...porPessoa.values()].sort(
      (a, b) => b.presencas - a.presencas || compareNames(a.nome, b.nome),
    ),
    acompanhamentosPorPessoa: [...acompPorPessoa.values()].sort(
      (a, b) => b.total - a.total || compareNames(a.nome, b.nome),
    ),
    acompanhamentosPorStatus: [...acompPorStatus.entries()].map(([k, v]) => ({
      label: FOLLOW_UP_STATUS_LABELS[k] ?? k,
      value: v,
    })),
    acompanhamentosPorTipo: [...acompPorTipo.entries()]
      .map(([k, v]) => ({ label: FOLLOW_UP_TYPE_LABELS[k] ?? k, value: v }))
      .sort((a, b) => b.value - a.value),
  };
}
