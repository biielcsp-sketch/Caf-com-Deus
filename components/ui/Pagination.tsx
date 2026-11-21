import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Paginação por links (funciona sem JavaScript e mantém busca e filtros na
// URL). Some quando só há uma página.
export function Pagination({
  basePath,
  params,
  page,
  totalPages,
  total,
  pageSize,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}) {
  if (totalPages <= 1) return null;

  const hrefFor = (target: number) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") qs.set(key, value);
    }
    if (target > 1) qs.set("page", String(target));
    const text = qs.toString();
    return text ? `${basePath}?${text}` : basePath;
  };

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const btn = "glass-inner flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-foreground";
  const off = "glass-inner flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-muted-foreground opacity-50";

  return (
    <nav aria-label="Paginação" className="mt-5 flex flex-col items-center gap-3">
      <p className="text-xs text-muted-foreground">
        {first}–{last} de {total} · página {page} de {totalPages}
      </p>
      <div className="flex w-full items-center justify-between gap-3">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={btn} rel="prev">
            <ChevronLeft size={16} />
            Anterior
          </Link>
        ) : (
          <span aria-disabled className={off}>
            <ChevronLeft size={16} />
            Anterior
          </span>
        )}
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} className={btn} rel="next">
            Próxima
            <ChevronRight size={16} />
          </Link>
        ) : (
          <span aria-disabled className={off}>
            Próxima
            <ChevronRight size={16} />
          </span>
        )}
      </div>
    </nav>
  );
}
