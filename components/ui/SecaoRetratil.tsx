import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// Seção retrátil — mesmo padrão do app da Consolidação: título com contador
// "(N)", seta que gira e conteúdo escondido até o toque. Começa FECHADA; só
// uma tela de leitura imediata (o Início) deixa aberta. Usa <details>, então
// funciona em página de servidor, sem JavaScript. Quando a tela filtra ou
// pagina pela URL, passe `abertoPorPadrao` para a seção não fechar sozinha.
export function SecaoRetratil({
  titulo,
  contador,
  abertoPorPadrao = false,
  nivel = "h2",
  children,
}: {
  titulo: string;
  contador?: number;
  abertoPorPadrao?: boolean;
  nivel?: "h1" | "h2";
  children: ReactNode;
}) {
  return (
    <details open={abertoPorPadrao} className="group glass-panel overflow-hidden rounded-3xl">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
        <span
          className={
            nivel === "h1"
              ? "font-display text-xl font-semibold text-primary"
              : "text-[15px] font-bold text-primary"
          }
        >
          {titulo}
          {typeof contador === "number" && (
            <span className="font-semibold text-muted-foreground"> ({contador})</span>
          )}
        </span>
        <ChevronDown
          size={18}
          aria-hidden
          className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-border/60 px-5 pb-5 pt-4">{children}</div>
    </details>
  );
}
