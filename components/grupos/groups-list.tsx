import Link from "next/link";
import { AlertTriangle, Pencil } from "lucide-react";
import { GroupDeleteButton } from "@/components/grupos/group-delete-button";
import type { listGroups } from "@/lib/services/groups.service";

type Group = Awaited<ReturnType<typeof listGroups>>[number];

const STATUS_LABELS: Record<string, string> = { ativo: "Ativo", inativo: "Inativo", lotado: "Lotado" };

export function GroupsList({ groups }: { groups: Group[] }) {
  if (groups.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Nenhum grupo cadastrado ainda.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {groups.map((g) => (
        // Cartão deixa de ser um link inteiro por causa dos botões: um
        // <button> dentro de um <a> não é HTML válido (mesmo padrão de
        // components/liderancas/leaders-list.tsx).
        <div
          key={g.id}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 hover:bg-muted sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        >
          <Link href={`/grupos/${g.id}`} className="min-w-0 sm:flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium text-foreground">{g.name}</p>
              {g.semLider && (
                <span className="flex items-center gap-1 rounded-full bg-danger/15 px-2 py-0.5 text-xs font-medium text-danger">
                  <AlertTriangle size={12} />
                  Sem líder
                </span>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              Líder: {g.leader_name ?? "a definir"} · {g.region ?? "sem região"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {g.occupied}/{g.capacity} vagas{g.visitors > 0 && ` · ${g.visitors} visitante${g.visitors > 1 ? "s" : ""}`} · {STATUS_LABELS[g.status]}
            </p>
          </Link>
          <div className="btn-row sm:shrink-0">
            <Link
              href={`/grupos/${g.id}`}
              className="btn btn-secondary"
            >
              <Pencil size={14} />
              Editar
            </Link>
            <GroupDeleteButton id={g.id} nome={g.name} compact />
          </div>
        </div>
      ))}
    </div>
  );
}
