import { listNewEnrollmentsForReview } from "@/lib/services/enrollment-review.service";
import { listLeadersWithCafe } from "@/lib/services/integrated.service";
import { EnrollmentReviewBoard } from "@/components/novas-inscricoes/enrollment-review-board";
import { AwaitingDistributionList } from "@/components/gestao-membros/awaiting-distribution-list";
import { BackLink } from "@/components/ui/BackLink";

export default async function NovasInscricoesPage() {
  const [{ ready, needsAttention }, allLeaders] = await Promise.all([
    listNewEnrollmentsForReview(),
    listLeadersWithCafe(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/gestao-membros" label="Gestão de Membros" />
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Novas inscrições e distribuição</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ready.length + needsAttention.length} inscrição(ões) aguardando revisão
          {needsAttention.length > 0 ? ` — ${needsAttention.length} com pendência` : ""}. Toque em “Ficha da
          participante” e “Ficha da líder” para ver os dados antes de decidir.
        </p>
      </div>

      <EnrollmentReviewBoard ready={ready} needsAttention={needsAttention} allLeaders={allLeaders} />

      <AwaitingDistributionList allLeaders={allLeaders} />
    </div>
  );
}
