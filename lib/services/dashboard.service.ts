import "server-only";
import { normalizarCidade } from "@/lib/cidade";
import { createClient } from "@/lib/supabase/server";
import { computeAttentionAlerts, precisaAtencaoPastoral } from "@/lib/services/followup.service";
import {
  hojeEmSaoPaulo,
  primeiroDiaDoMesEmSaoPaulo,
  primeiroDiaDoProximoMesEmSaoPaulo,
} from "@/lib/dates";
import { getOcupacaoAtual } from "@/lib/services/occupancy.service";

export async function getAdminDashboard() {
  const supabase = await createClient();

  // Nenhuma destas consultas capturava `error`. Qualquer falha (RLS, timeout,
  // PostgREST fora do ar) virava um `0` no card ou um gráfico vazio — que num
  // dashboard passa perfeitamente por "ainda não tem dados". Agora a falha vai
  // para o log do servidor; derrubar o painel inteiro por causa de um card
  // seria pior.
  const resultados = await Promise.all([
    supabase.from("participants").select("*", { count: "exact", head: true }).is("deleted_at", null),
    // `.is("deleted_at", null)` em TODOS os contadores: a exclusão de uma
    // participante não muda o status dela nem o vínculo com líder/café, só
    // marca `deleted_at`. Sem o filtro, os cards contavam quem já foi
    // excluída.
    supabase.from("participants").select("*", { count: "exact", head: true }).eq("status", "ativa").is("deleted_at", null),
    supabase
      .from("participants")
      .select("*", { count: "exact", head: true })
      .eq("status", "aguardando_distribuicao")
      .is("deleted_at", null),
    supabase.from("leaders").select("*", { count: "exact", head: true }).eq("status", "ativa"),
    supabase
      .from("meetings")
      .select("id, date")
      .gte("date", primeiroDiaDoMesEmSaoPaulo())
      // Faltava o limite de cima: o card "Encontros este mês" somava todo
      // encontro já agendado daqui para a frente.
      .lt("date", primeiroDiaDoProximoMesEmSaoPaulo()),
    supabase.from("attendance").select("status").neq("status", "nao_informado"),
    supabase
      .from("participants")
      .select("id, status")
      .in("status", ["distribuida", "ativa", "acompanhamento"])
      .is("deleted_at", null),
    supabase.from("participants").select("city").is("deleted_at", null),
    supabase
      .from("participants")
      .select("current_leader_id, leader:leaders(profile:profiles(full_name))")
      .not("current_leader_id", "is", null)
      .is("deleted_at", null),
    supabase.from("groups").select("id, name, capacity"),
    supabase.from("participants").select("enrollment_date").is("deleted_at", null),
  ]);

  const NOMES = [
    "totalParticipants",
    "activeParticipants",
    "awaitingDistribution",
    "activeLeaders",
    "monthMeetings",
    "attendanceAll",
    "participantsForAlerts",
    "byRegion",
    "byLeader",
    "groups",
    "enrollments",
  ];
  resultados.forEach((r, i) => {
    if (r.error) console.error("[dashboard] consulta %s falhou:", NOMES[i], r.error.message);
  });

  const [
    { count: totalParticipants },
    { count: activeParticipants },
    { count: awaitingDistribution },
    { count: activeLeaders },
    { data: monthMeetings },
    { data: attendanceAll },
    { data: participantsForAlerts },
    { data: byRegionRaw },
    { data: byLeaderRaw },
    { data: groups },
    { data: enrollmentsRaw },
  ] = resultados;

  const totalAttendance = attendanceAll?.length ?? 0;
  const presentCount = attendanceAll?.filter((a) => a.status === "presente").length ?? 0;
  const averageAttendance = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : null;

  const alertsMap = await computeAttentionAlerts(
    (participantsForAlerts ?? []).map((p) => ({ id: p.id, status: p.status })),
  );
  const needingAttention = [...alertsMap.values()].filter(precisaAtencaoPastoral).length;

  const byRegion = countBy(byRegionRaw ?? [], (r) => normalizarCidade(r.city) || "Não informado");
  const byLeader = countBy(byLeaderRaw ?? [], (r) => r.leader?.profile?.full_name || "Sem líder");
  const { porGrupo } = await getOcupacaoAtual();
  const byGroup = (groups ?? []).map((g) => ({
    name: g.name,
    occupied: porGrupo.get(g.id) ?? 0,
    capacity: g.capacity,
  }));

  const monthlyEvolution = monthlyCount(enrollmentsRaw?.map((e) => e.enrollment_date) ?? []);
  const attendanceBreakdown = countBy(attendanceAll ?? [], (a) => a.status);

  return {
    totalParticipants: totalParticipants ?? 0,
    activeParticipants: activeParticipants ?? 0,
    awaitingDistribution: awaitingDistribution ?? 0,
    activeLeaders: activeLeaders ?? 0,
    meetingsThisMonth: monthMeetings?.length ?? 0,
    averageAttendance,
    needingAttention,
    byRegion,
    byLeader,
    byGroup,
    monthlyEvolution,
    attendanceBreakdown,
  };
}

export async function getLeaderDashboard(leaderId: string) {
  const supabase = await createClient();

  const { data: myParticipants } = await supabase
    .from("participants")
    .select("id, status")
    .eq("current_leader_id", leaderId)
    .is("deleted_at", null);

  // Último encontro REALIZADO: um planejado ou cancelado de ontem não tem
  // presença para resumir e escondia o resumo do último que de fato houve.
  const { data: lastMeeting } = await supabase
    .from("meetings")
    .select("id, title, date")
    .eq("leader_id", leaderId)
    .eq("status", "realizado")
    .lte("date", hojeEmSaoPaulo())
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: nextMeeting } = await supabase
    .from("meetings")
    .select("id, title, date, time, location")
    .eq("leader_id", leaderId)
    .gt("date", hojeEmSaoPaulo())
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();

  let lastMeetingSummary: {
    presentes: number;
    ausentes: number;
    justificaram: number;
    registradas: number;
    vinculadas: number;
  } | null = null;
  if (lastMeeting) {
    const [{ data: attendance }, { count: vinculadas }] = await Promise.all([
      supabase.from("attendance").select("status").eq("meeting_id", lastMeeting.id),
      supabase
        .from("meeting_participants")
        .select("*", { count: "exact", head: true })
        .eq("meeting_id", lastMeeting.id),
    ]);
    const informadas = (attendance ?? []).filter((a) => a.status !== "nao_informado");
    lastMeetingSummary = {
      presentes: informadas.filter((a) => a.status === "presente").length,
      ausentes: informadas.filter((a) => a.status === "ausente").length,
      justificaram: informadas.filter((a) => a.status === "justificou").length,
      registradas: informadas.length,
      vinculadas: vinculadas ?? 0,
    };
  }

  const alertsMap = await computeAttentionAlerts(
    (myParticipants ?? []).map((p) => ({ id: p.id, status: p.status })),
  );
  const needingAttention = [...alertsMap.values()].filter(precisaAtencaoPastoral).length;

  return {
    participantCount: myParticipants?.length ?? 0,
    lastMeeting,
    lastMeetingSummary,
    nextMeeting,
    needingAttention,
  };
}

function countBy<T>(items: T[], keyFn: (item: T) => string) {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

function monthlyCount(dates: string[]) {
  const now = new Date();
  const months: { label: string; key: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ label: d.toLocaleDateString("pt-BR", { month: "short" }), key, count: 0 });
  }
  for (const date of dates) {
    const key = date.slice(0, 7);
    const month = months.find((m) => m.key === key);
    if (month) month.count++;
  }
  return months;
}
