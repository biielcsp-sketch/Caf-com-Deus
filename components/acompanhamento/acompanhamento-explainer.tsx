import { Card } from "@/components/ui/Card";
import {
  ACOMPANHAMENTO_NAO_USE_PARA,
  ACOMPANHAMENTO_O_QUE_E,
  AVISOS_AUTOMATICOS,
  AVISOS_AUTOMATICOS_NOTA,
} from "@/lib/acompanhamento-copy";

// Explicação fixa no topo das telas de acompanhamento. Existe porque as
// líderes e a pastora liam os avisos automáticos como se fossem marcações
// feitas na mão, e o número virava alarme falso (09/10/2026).
export function AcompanhamentoExplainer() {
  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-foreground">Como ler esta tela</p>
      <p className="mt-2 text-sm text-muted-foreground">{ACOMPANHAMENTO_O_QUE_E}</p>
      <p className="mt-2 text-sm text-muted-foreground">{ACOMPANHAMENTO_NAO_USE_PARA}</p>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Os avisos da lista
      </p>
      <dl className="mt-2 flex flex-col gap-2">
        {AVISOS_AUTOMATICOS.map((aviso) => (
          <div key={aviso.titulo}>
            <dt className="text-sm font-medium text-foreground">{aviso.titulo}</dt>
            <dd className="text-sm text-muted-foreground">{aviso.texto}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">{AVISOS_AUTOMATICOS_NOTA}</p>
    </Card>
  );
}
