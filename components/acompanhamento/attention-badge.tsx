import type { ParticipantAlerts } from "@/lib/services/followup.service";

// Só dois avisos, ambos vindos de falta a encontro. Não existe aviso de
// "faz tempo que não registra contato": contato não é expectativa de rotina
// aqui (decisão de produto, 09/10/2026).
type AlertaBooleano = "acompanhamentoNecessario" | "precisaContato";

const CONFIG: { key: AlertaBooleano; label: string; className: string; title: string }[] = [
  {
    key: "acompanhamentoNecessario",
    label: "2 faltas seguidas",
    className: "bg-danger/15 text-danger",
    title: "Faltou a dois encontros seguidos. Este aviso vem da presença, não de um registro de acompanhamento.",
  },
  {
    key: "precisaContato",
    label: "Precisa de contato",
    className: "bg-accent/30 text-foreground",
    title: "Faltou ao último encontro.",
  },
];

export function AttentionBadge({ alerts }: { alerts?: ParticipantAlerts }) {
  if (!alerts) return null;
  const active = CONFIG.filter((c) => alerts[c.key]);
  if (active.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {active.map((a) => (
        <span
          key={a.key}
          title={a.title}
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${a.className}`}
        >
          {a.label}
        </span>
      ))}
    </div>
  );
}
