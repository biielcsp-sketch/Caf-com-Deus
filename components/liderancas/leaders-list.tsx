import Link from "next/link";
import { Pencil } from "lucide-react";
import { LeaderDeleteButton } from "@/components/liderancas/leader-delete-button";
import type { listLeaders } from "@/lib/services/leaders.service";

type Leader = Awaited<ReturnType<typeof listLeaders>>[number];

export function LeadersList({ leaders }: { leaders: Leader[] }) {
  if (leaders.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Nenhuma líder cadastrada ainda.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {leaders.map((l) => {
        const pct = Math.min(100, Math.round((l.occupied / l.max_capacity) * 100));
        return (
          // Cartão deixa de ser um link inteiro por causa dos botões: um
          // <button> dentro de um <a> não é HTML válido.
          <div
            key={l.id}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 hover:bg-muted sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <Link href={`/liderancas/${l.id}`} className="min-w-0 sm:flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-foreground">{l.full_name}</p>
                {l.status === "inativa" && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    Inativa
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {l.city ?? "Cidade não informada"} · {l.region ?? "sem região"}
              </p>
              <div className="mt-2 h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {l.occupied}/{l.max_capacity} membros{l.visitors > 0 && ` · ${l.visitors} visitante${l.visitors > 1 ? "s" : ""}`}
              </p>
            </Link>
            <div className="btn-row sm:shrink-0">
              <Link
                href={`/liderancas/${l.id}`}
                className="btn btn-secondary"
              >
                <Pencil size={14} />
                Editar
              </Link>
              <LeaderDeleteButton id={l.id} nome={l.full_name} cafes={l.cafes} compact />
            </div>
          </div>
        );
      })}
    </div>
  );
}
