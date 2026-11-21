import { listNewEnrollmentsForReview } from "@/lib/services/enrollment-review.service";
import { listLeadersWithCafe } from "@/lib/services/integrated.service";
import { EnrollmentReviewBoard } from "@/components/novas-inscricoes/enrollment-review-board";
import { AwaitingDistributionList } from "@/components/gestao-membros/awaiting-distribution-list";
import { SecaoRetratil } from "@/components/ui/SecaoRetratil";
import { BackLink } from "@/components/ui/BackLink";

export default async function NovasInscricoesPage() {
  const [{ ready, needsAttention }, allLeaders] = await Promise.all([
    listNewEnrollmentsForReview(),
    listLeadersWithCafe(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/gestao-membros" label="Gestão de Membros" />
      <div>
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-foreground">Novas inscrições e distribuição</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ready.length + needsAttention.length} aguardando revisão
          {needsAttention.length > 0 ? ` · ${needsAttention.length} com pendência` : ""}
        </p>
      </div>

      <SecaoRetratil
        titulo="Inscrições para revisar"
        contador={ready.length + needsAttention.length}
        abertoPorPadrao
      >
        <EnrollmentReviewBoard ready={ready} needsAttention={needsAttention} allLeaders={allLeaders} />
      </SecaoRetratil>

      <SecaoRetratil titulo="Fila de distribuição">
        <AwaitingDistributionList allLeaders={allLeaders} />
      </SecaoRetratil>
    </div>
  );
}
