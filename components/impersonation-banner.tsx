import { Eye } from "lucide-react";
import { getImpersonationBanner } from "@/lib/services/impersonation.service";
import { stopImpersonationAction } from "@/app/actions/impersonation";

// Faixa fixa no topo enquanto o Desenvolvedor está vendo o sistema como outra
// pessoa. Fica acima de qualquer tela (z-50) e vai em todos os três layouts
// (admin, líder e participante). Sem visita em curso, não renderiza nada.
export async function ImpersonationBanner() {
  const visita = await getImpersonationBanner();
  if (!visita) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-foreground px-4 py-2 text-sm text-background">
      <Eye size={16} aria-hidden className="shrink-0" />
      <span className="min-w-0 truncate">
        Você está vendo como <b>{visita.targetName}</b>
      </span>
      <form action={stopImpersonationAction}>
        <button
          type="submit"
          className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-foreground"
        >
          Voltar
        </button>
      </form>
    </div>
  );
}
