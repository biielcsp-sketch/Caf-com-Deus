// Os encontros que o Feed lista em "Próximos encontros".
//
// Antes o Feed cortava em 4. Com 4 encontros no dia de hoje, os 8 do sábado
// seguinte (inclusive confirmados) sumiam da lista, e parecia que o sistema
// não mostrava os encontros confirmados. Agora a função devolve todos os
// próximos e a tela mostra 10 com o botão "Ver mais" para o resto.

type EncontroDoFeed = { date: string; time: string | null; status: string };

export function proximosEncontros<T extends EncontroDoFeed>(
  encontros: T[],
  hoje: string,
  limite = Infinity,
): { itens: T[]; total: number } {
  const futuros = encontros
    .filter((m) => m.date >= hoje && m.status !== "cancelado")
    // Data e, no mesmo dia, horário; sem horário vai para o fim do dia.
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
  return { itens: futuros.slice(0, limite), total: futuros.length };
}
