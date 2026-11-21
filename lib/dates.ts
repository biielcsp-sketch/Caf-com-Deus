// Datas do app são sempre do ponto de vista de quem está aqui, não do
// servidor. O servidor do Netlify roda em UTC, então `new Date().toISOString()`
// devolve a data de AMANHÃ das 21h à meia-noite no horário de Brasília — o
// bastante para o encontro de amanhã virar "último encontro" no painel da
// líder, para "encontros deste mês" começar no dia 31 do mês anterior e para
// uma transferência feita à noite ser registrada com a data do dia seguinte.
//
// `en-CA` é usado só porque é o locale que formata como AAAA-MM-DD, que é o
// formato das colunas `date` do Postgres e dos <input type="date">.
const FUSO = "America/Sao_Paulo";

const formatador = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Hoje em Brasília, como "AAAA-MM-DD". */
export function hojeEmSaoPaulo(base = new Date()): string {
  return formatador.format(base);
}

/** Primeiro dia do mês corrente em Brasília, como "AAAA-MM-DD". */
export function primeiroDiaDoMesEmSaoPaulo(base = new Date()): string {
  return `${hojeEmSaoPaulo(base).slice(0, 7)}-01`;
}

/** Primeiro dia do mês seguinte em Brasília, como "AAAA-MM-DD". */
export function primeiroDiaDoProximoMesEmSaoPaulo(base = new Date()): string {
  const [ano, mes] = hojeEmSaoPaulo(base).split("-").map(Number);
  const proximoAno = mes === 12 ? ano + 1 : ano;
  const proximoMes = mes === 12 ? 1 : mes + 1;
  return `${proximoAno}-${String(proximoMes).padStart(2, "0")}-01`;
}

/** Mês corrente em Brasília, como "AAAA-MM" (para o estudo do mês). */
export function mesAtualEmSaoPaulo(base = new Date()): string {
  return hojeEmSaoPaulo(base).slice(0, 7);
}
