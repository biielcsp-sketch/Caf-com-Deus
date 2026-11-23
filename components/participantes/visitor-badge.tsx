// Selo de visitante: bem visível na ficha, na lista e na chamada.
export function VisitorBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="Visitante: ainda não faz parte do café e não ocupa vaga. Membro é quem faz parte do café."
      className={`inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary ${className}`}
    >
      Visitante
    </span>
  );
}
