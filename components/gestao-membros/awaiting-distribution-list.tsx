import { listAwaitingDistribution } from "@/lib/services/distribution.service";
import { Card } from "@/components/ui/Card";
import { AwaitingDistributionCard } from "@/components/gestao-membros/awaiting-distribution-card";
import type { LeaderWithCafe } from "@/lib/services/integrated.service";

// Fila de quem já foi aprovada mas ainda não tem líder: aprovadas
// manualmente (as que "precisam de atenção") e as devolvidas por líderes.
// Mora na mesma tela das novas inscrições para a gestora não ter um passo
// extra entre aprovar e distribuir — e desde 09/10/2026 a escolha da líder
// acontece aqui mesmo, não mais numa tela separada.
export async function AwaitingDistributionList({
  allLeaders,
}: {
  allLeaders: LeaderWithCafe[];
}) {
  const participants = await listAwaitingDistribution();

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Aguardando distribuição</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {participants.length} participante(s) aprovada(s) ou devolvida(s) por líder, sem café definido.
        </p>
      </div>

      {participants.length === 0 && (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Nenhuma participante aguardando distribuição.</p>
        </Card>
      )}
      {participants.map((p) => (
        <AwaitingDistributionCard key={p.id} item={p} allLeaders={allLeaders} />
      ))}
    </section>
  );
}
