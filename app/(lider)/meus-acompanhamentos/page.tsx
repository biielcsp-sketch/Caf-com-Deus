import { listParticipants } from "@/lib/services/participants.service";
import { getMyLeaderContext } from "@/lib/services/leaders.service";
import { computeAttentionAlerts } from "@/lib/services/followup.service";
import { AttentionList } from "@/components/acompanhamento/attention-list";
import { AcompanhamentoExplainer } from "@/components/acompanhamento/acompanhamento-explainer";
import { BackLink } from "@/components/ui/BackLink";

export default async function MeusAcompanhamentosPage() {
  // Mesma correção da lista: filtrar pela líder logada em vez de confiar só no
  // RLS, que é aberto para quem também é gestora de pessoas ou administração.
  const leader = await getMyLeaderContext();
  const participants = leader ? await listParticipants({ leaderId: leader.leaderId }) : [];
  const alertsMap = await computeAttentionAlerts(
    participants.map((p) => ({ id: p.id, status: p.status })),
  );

  return (
    <div>
      <BackLink href="/inicio" label="Início" />
      <h1 className="mt-3 text-2xl font-semibold text-foreground">Acompanhamentos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Participantes que precisam de atenção agora
      </p>
      <div className="mt-4">
        <AcompanhamentoExplainer />
      </div>
      <div className="mt-4">
        <AttentionList participants={participants} alertsMap={alertsMap} basePath="/minhas-participantes" />
      </div>
    </div>
  );
}
