import Link from "next/link";
import { Card } from "@/components/ui/Card";

type Props = {
  membros: number;
  vagas: number | null;
  presencaUltimoEncontro: number | null;
  presencaNoMes: number | null;
  precisamAtencao: number;
  visitantes: number;
  inativas: number;
};

function Kpi({
  rotulo,
  valor,
  nota,
  href,
  children,
}: {
  rotulo: string;
  valor: string;
  nota: string;
  href?: string;
  children?: React.ReactNode;
}) {
  const conteudo = (
    <Card className="flex h-full flex-col gap-1 p-4">
      <p className="text-xs font-medium text-muted-foreground">{rotulo}</p>
      <p className="font-display text-[28px] font-semibold leading-none text-foreground">{valor}</p>
      {children}
      <p className="text-xs text-muted-foreground">{nota}</p>
    </Card>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {conteudo}
    </Link>
  ) : (
    conteudo
  );
}

// Os números do café da líder, num olhar. "Membros" não conta visitante nem
// inativa — a mesma regra das vagas em Líderes e Cafés.
export function KpisDoCafe({
  membros,
  vagas,
  presencaUltimoEncontro,
  presencaNoMes,
  precisamAtencao,
  visitantes,
  inativas,
}: Props) {
  const pct = (n: number | null) => (n === null ? "—" : `${n}%`);
  const preenchido = vagas && vagas > 0 ? Math.min(100, Math.round((membros / vagas) * 100)) : 0;

  return (
    <section aria-label="Seu café em números" className="flex flex-col gap-2.5">
      <h2 className="font-display px-0.5 text-lg font-semibold text-foreground">Seu café em números</h2>
      <div className="grid grid-cols-2 gap-3 md:max-w-xl">
        <Kpi
          rotulo="Membros"
          valor={vagas ? `${membros}/${vagas}` : String(membros)}
          nota={vagas ? "vagas preenchidas" : "no seu café"}
        >
          {vagas ? (
            <div className="my-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-primary" style={{ width: `${preenchido}%` }} />
            </div>
          ) : null}
        </Kpi>
        <Kpi
          rotulo="Presença no último encontro"
          valor={pct(presencaUltimoEncontro)}
          nota={presencaUltimoEncontro === null ? "chamada ainda não feita" : "das chamadas registradas"}
        />
        <Kpi
          rotulo="Precisam de atenção"
          valor={String(precisamAtencao)}
          nota="faltaram ao último encontro"
          href={precisamAtencao > 0 ? "/meus-acompanhamentos" : undefined}
        />
        <Kpi rotulo="Visitantes" valor={String(visitantes)} nota="não ocupam vaga" />
        <Kpi rotulo="Inativas" valor={String(inativas)} nota="liberaram a vaga" />
        <Kpi
          rotulo="Presença no mês"
          valor={pct(presencaNoMes)}
          nota={presencaNoMes === null ? "sem chamada neste mês" : "encontros realizados no mês"}
        />
      </div>
    </section>
  );
}
