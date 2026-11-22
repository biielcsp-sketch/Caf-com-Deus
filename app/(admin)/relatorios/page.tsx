import { StatCard } from "@/components/dashboard/stat-card";
import { BarList } from "@/components/dashboard/bar-list";
import { SecaoRetratil } from "@/components/ui/SecaoRetratil";
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
    <SecaoRetratil titulo={titulo} contador={linhas.length}>
      {linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto">
          {linhas.map((l, i) => {
            const numeros = l.slice(1).map((v, j) => ({ v, rotulo: colunas[j + 1] })).filter((x) => typeof x.v === "number");
            const textos = l.slice(1).map((v, j) => ({ v, rotulo: colunas[j + 1] })).filter((x) => typeof x.v !== "number");
            return (
              <li key={i} className="glass-inner rounded-2xl px-4 py-3">
                <p className="break-words text-sm font-medium text-foreground">{l[0]}</p>
                {textos.map((t) => (
                  <p key={t.rotulo} className="mt-0.5 break-words text-xs text-muted-foreground">
                    {t.rotulo}: {t.v}
                  </p>
                ))}
                {numeros.length > 0 && (
                  <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                    {numeros.map((n) => (
                      <div key={n.rotulo} className="flex items-baseline gap-1.5">
                        <dd className="font-display text-base font-semibold tabular-nums text-foreground">{n.v}</dd>
                        <dt className="text-[11px] text-muted-foreground">{n.rotulo}</dt>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SecaoRetratil>
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
    <div className="flex flex-col gap-4">
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
          className="btn btn-primary self-end"
        >
          Atualizar
        </button>
      </form>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Cafés realizados" value={r.resumo.cafesRealizados} />
        <StatCard label="Total de presenças" value={r.resumo.totalPresencas} />
        <StatCard label="Acompanhamentos" value={r.resumo.acompanhamentos} />
      </div>
      <SecaoRetratil titulo="Mais números">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Cafés cancelados" value={r.resumo.cafesCancelados} />
          <StatCard label="Participantes únicas" value={r.resumo.participantesUnicas} />
          <StatCard label="Presenças de visitantes" value={r.resumo.presencasVisitantes} />
        </div>
      </SecaoRetratil>

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

      <div className="flex flex-col gap-4">
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
        <SecaoRetratil titulo="Status dos acompanhamentos">
          <BarList items={r.acompanhamentosPorStatus.map((s) => ({ label: s.label, count: s.value }))} />
        </SecaoRetratil>
        <SecaoRetratil titulo="Acompanhamentos por tipo">
          <BarList items={r.acompanhamentosPorTipo.map((s) => ({ label: s.label, count: s.value }))} />
        </SecaoRetratil>
      </div>
    </div>
  );
}
