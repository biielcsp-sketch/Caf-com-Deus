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
    <div className="flex flex-col gap-4">
      <BackLink href="/gestao-membros" label="Gestão de Membros" />
      <div>
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-foreground">Multiplicar café</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Uma participante passa a liderar um café novo
        </p>
      </div>
      <MultiplyCafeForm key={origemValida ?? "none"} cafes={cafes} origemId={origemValida} members={members} />
    </div>
  );
}
