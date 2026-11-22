"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

// Botão "Excluir" das fichas de líder e de participante. O texto da
// confirmação vem de fora porque as duas exclusões têm consequências
// diferentes — e a pastora precisa ler qual é a dela antes de confirmar,
// não depois.
// IMPORTANTE: a Server Action por trás de `onDelete` tem que DEVOLVER o
// erro, nunca lançá-lo. Exceção lançada dentro de Server Action não
// atravessa a fronteira servidor→cliente em produção: o React troca a
// mensagem real por "Minified React error #441" (texto genérico, de
// propósito, para não vazar detalhe de servidor). Foi exatamente o que a
// pastora via ao tentar excluir uma líder que tinha café vinculado, no
// lugar da explicação de por que não dava. O `catch` continua aqui só como
// rede de segurança para falha inesperada de rede.
export function DeleteButton({
  confirmacao,
  onDelete,
  redirectTo,
  compact = false,
}: {
  confirmacao: string;
  onDelete: () => Promise<{ error?: string } | void>;
  redirectTo?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function handleClick() {
    if (!window.confirm(confirmacao)) return;
    setErro(null);
    startTransition(async () => {
      try {
        const resultado = await onDelete();
        // A mensagem do servidor explica o que está travando (participantes
        // vinculadas, histórico de encontros). Fica na tela, e não só num
        // alerta que some, para a pastora poder reler o que precisa fazer.
        if (resultado?.error) {
          setErro(resultado.error);
          return;
        }
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      } catch {
        setErro("Não foi possível excluir. Verifique a conexão e tente de novo.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="btn btn-danger shrink-0"
      >
        <Trash2 size={14} />
        {isPending ? "Excluindo..." : "Excluir"}
      </button>
      {erro && <p className="max-w-xs text-right text-xs text-danger">{erro}</p>}
    </div>
  );
}
