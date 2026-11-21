import { listCafeMembers, listCafesForMultiplication } from "@/lib/services/multiplication.service";
import { MultiplyCafeForm } from "@/components/gestao-membros/multiply-cafe-form";
import { BackLink } from "@/components/ui/BackLink";

type SearchParams = { origem?: string };

export default async function MultiplicacaoPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { origem } = await searchParams;
  const cafes = await listCafesForMultiplication();
  const origemValida = origem && cafes.some((c) => c.id === origem) ? origem : null;
  const members = origemValida ? await listCafeMembers(origemValida) : [];

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/gestao-membros" label="Gestão de Membros" />
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Multiplicar café</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Uma participante passa a liderar um café novo e as que forem junto são transferidas de uma vez. O novo café
          fica ligado ao de origem na árvore de multiplicação.
        </p>
      </div>
      <MultiplyCafeForm key={origemValida ?? "none"} cafes={cafes} origemId={origemValida} members={members} />
    </div>
  );
}
