// Texto único sobre o que significa "acompanhamento" no sistema.
//
// Contexto (09/10/2026): as líderes não sabiam para que servia o recurso e a
// pastora leu "277 precisam de acompanhamento" como se a base inteira estivesse
// em crise. Metade do problema era cálculo (corrigido em followup.service.ts);
// a outra metade é que o sistema nunca explicou nada. Todo texto que explica
// acompanhamento sai daqui, para as telas não divergirem entre si.

export const ACOMPANHAMENTO_O_QUE_E =
  "Acompanhamento é para casos graves ou urgentes, em que a participante precisa de cuidado próximo da liderança ou da pastoral — crise familiar, saúde, luto, afastamento súbito. Não é o contato comum do dia a dia.";

export const ACOMPANHAMENTO_O_QUE_ACONTECE = [
  "A participante passa a aparecer na lista de acompanhamento da pastora, não só na sua.",
  "A ficha dela fica destacada em vermelho para quem tem acesso.",
  "A situação continua valendo até alguém voltar a marcar como Ativa.",
] as const;

export const ACOMPANHAMENTO_NAO_USE_PARA =
  "Não use para registrar que você conversou com ela, que ela faltou a um encontro ou que está sumida. Para isso existe o registro de acompanhamento abaixo, que fica só com você e com a pastoral.";

// Os avisos automáticos da lista de participantes.
//
// São dois, e os dois vêm de falta a encontro. Não existe aviso cobrando
// registro de contato: as participantes recebem os avisos dos cafés e a líder
// não precisa manter contato periódico — o acompanhamento é para situação
// especial (decisão de produto, 09/10/2026).
export const AVISOS_AUTOMATICOS: { titulo: string; texto: string }[] = [
  {
    titulo: "Precisa de contato",
    texto: "Faltou ao último encontro. Vale uma mensagem.",
  },
  {
    titulo: "Acompanhamento necessário",
    texto: "Faltou a dois encontros seguidos.",
  },
];

export const AVISOS_AUTOMATICOS_NOTA =
  "Esses dois avisos são calculados pelo próprio sistema a partir da presença nos encontros. Ninguém marca nem desmarca eles na mão.";
