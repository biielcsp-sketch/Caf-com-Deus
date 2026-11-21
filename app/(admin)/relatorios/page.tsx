import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/dashboard/stat-card";
import { BarList } from "@/components/dashboard/bar-list";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { getReports } from "@/lib/services/reports.service";
import { hojeEmSaoPaulo } from "@/lib/dates";

type SearchParams = { from?: string; to?: string };

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";

function fmt(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
}

function Tabela({
  titulo,
  colunas,
  linhas,
  vazio = "Sem dados no período.",
}: {
  titulo: string;
  colunas: string[];
  linhas: (string | number)[][];
  vazio?: string;
}) {
  return (
    <Card className="p-5">
      <p className="mb-3 text-sm font-semibold text-foreground">{titulo}</p>
      {linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
              <tr>
                {colunas.map((c, i) => (
                  <th key={c} className={`py-2 pr-3 font-medium ${i > 0 ? "text-right" : ""}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i} className="border-t border-border/60">
                  {l.map((v, j) => (
                    <td key={j} className={`py-1.5 pr-3 ${j > 0 ? "text-right tabular-nums" : "text-foreground"}`}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const hoje = hojeEmSaoPaulo();
  const inicioAno = `${hoje.slice(0, 4)}-01-01`;
  const from = params.from && DATA.test(params.from) ? params.from : inicioAno;
  const to = params.to && DATA.test(params.to) ? params.to : hoje;

  const r = await getReports({ from, to });

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/dashboard" label="Dashboard" />
      <PageHeader
        title="Relatórios"
        description={`Cafés, presenças e acompanhamentos de ${fmt(from)} a ${fmt(to)}.`}
      />

      <form className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3">
        <label className="text-xs text-muted-foreground">
          De
          <input type="date" name="from" defaultValue={from} className={`${inputClass} mt-1`} />
        </label>
        <label className="text-xs text-muted-foreground">
          Até
          <input type="date" name="to" defaultValue={to} className={`${inputClass} mt-1`} />
        </label>
        <button
          type="submit"
          className="self-end rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Atualizar
        </button>
      </form>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Cafés realizados" value={r.resumo.cafesRealizados} />
        <StatCard label="Cafés cancelados" value={r.resumo.cafesCancelados} />
        <StatCard label="Total de presenças" value={r.resumo.totalPresencas} />
        <StatCard label="Participantes únicas" value={r.resumo.participantesUnicas} />
        <StatCard label="Presenças de visitantes" value={r.resumo.presencasVisitantes} />
        <StatCard label="Acompanhamentos" value={r.resumo.acompanhamentos} />
      </div>

      <Tabela
        titulo="Participantes x Cafés"
        colunas={["Café", "Líder", "Encontros", "Presenças", "Únicas", "Média/encontro"]}
        linhas={r.participantesPorCafe.map((c) => [
          c.cafe,
          c.lider,
          c.encontros,
          c.presencas,
          c.unicas,
          c.mediaPorEncontro,
        ])}
      />

      <Tabela
        titulo="Visitantes no período"
        colunas={["Visitante", "Café", "Presenças", "Contato"]}
        linhas={r.visitantesNoPeriodo.map((v) => [
          v.nome,
          v.cafe,
          v.presencas,
          v.contatoConfirmado ? "Confirmado" : "Pendente",
        ])}
        vazio="Nenhuma visitante presente no período."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Tabela
          titulo="Participação de cada pessoa"
          colunas={["Participante", "Presenças"]}
          linhas={r.participacaoPorPessoa.map((p) => [p.nome, p.presencas])}
        />
        <Tabela
          titulo="Acompanhamentos por pessoa"
          colunas={["Participante", "Registros", "Último"]}
          linhas={r.acompanhamentosPorPessoa.map((p) => [p.nome, p.total, fmt(p.ultimo)])}
        />
        <Card className="p-5">
          <p className="mb-3 text-sm font-semibold text-foreground">Status dos acompanhamentos</p>
          <BarList items={r.acompanhamentosPorStatus.map((s) => ({ label: s.label, count: s.value }))} />
        </Card>
        <Card className="p-5">
          <p className="mb-3 text-sm font-semibold text-foreground">Acompanhamentos por tipo</p>
          <BarList items={r.acompanhamentosPorTipo.map((s) => ({ label: s.label, count: s.value }))} />
        </Card>
      </div>
    </div>
  );
}
