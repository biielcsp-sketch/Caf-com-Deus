import { listParticipants } from "@/lib/services/participants.service";
import { computeAttentionAlerts } from "@/lib/services/followup.service";
import { AttentionList } from "@/components/acompanhamento/attention-list";
import { AcompanhamentoExplainer } from "@/components/acompanhamento/acompanhamento-explainer";
import { SecaoRetratil } from "@/components/ui/SecaoRetratil";
import { BackLink } from "@/components/ui/BackLink";

export default async function AcompanhamentosPage() {
  const participants = await listParticipants();
  const alertsMap = await computeAttentionAlerts(
    participants.map((p) => ({ id: p.id, status: p.status })),
  );

  return (
    <div>
      <BackLink href="/dashboard" label="Dashboard" />
      <h1 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-foreground">Acompanhamentos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Participantes que precisam de atenção agora
      </p>
      <div className="mt-4 flex flex-col gap-4">
        <SecaoRetratil titulo="Como funciona">
          <AcompanhamentoExplainer />
        </SecaoRetratil>
        <SecaoRetratil titulo="Precisam de atenção">
          <AttentionList participants={participants} alertsMap={alertsMap} basePath="/participantes" />
        </SecaoRetratil>
      </div>
    </div>
  );
}
