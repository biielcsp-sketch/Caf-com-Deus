import type { Enums } from "@/types/database.types";

// Ponto único de verdade dos rótulos de papel — antes cada tela tinha a
// própria cópia deste mapa, o que fez os três lugares quebrarem juntos ao
// entrar um papel novo no enum.
export const ROLE_LABELS: Record<Enums<"user_role">, string> = {
  admin: "Admin",
  desenvolvedor: "Desenvolvedor",
  lider: "Líder",
  co_lider: "Co-líder",
  anfitria: "Anfitriã",
  gestora_de_pessoas: "Gestora de Pessoas",
  participante: "Participante",
};

export const ROLE_ORDER: Enums<"user_role">[] = [
  "desenvolvedor",
  "admin",
  "lider",
  "co_lider",
  "gestora_de_pessoas",
  "anfitria",
  "participante",
];

// Plural usado nos agrupamentos de contas (o "s" simples não serve para
// "Gestora de Pessoas").
export const ROLE_PLURALS: Partial<Record<Enums<"user_role">, string>> = {
  gestora_de_pessoas: "Gestoras de Pessoas",
};

// Co-líder tem exatamente a mesma função da líder — muda só o nome. Toda
// checagem de "é liderança?" no app passa por aqui, nunca compara com
// "lider" direto, senão a co-líder fica de fora sem querer.
//
// A Gestora de Pessoas entra aqui de propósito: ela usa o painel de líder (a
// Franciele, por exemplo, também lidera um café) e ganha a aba "Gestão de
// Membros" por cima. Quem decide o que cada linha enxerga é a RLS pela tabela
// `leaders`, não o papel — uma gestora sem café simplesmente vê as listas de
// líder vazias.
export function isLeaderRole(role: Enums<"user_role"> | undefined | null) {
  return role === "lider" || role === "co_lider" || role === "gestora_de_pessoas";
}

// Quem pode usar a área "Gestão de Membros" (novas inscrições, fila de
// distribuição, redistribuição): pastora, desenvolvedor e a Gestora de
// Pessoas. Só controla a porta da tela — a barreira real é app_is_people_manager()
// no banco.
// Props do AdminShell que dependem do papel — num lugar só, porque o shell é
// montado por cinco telas diferentes.
export function adminShellPropsFor(role: Enums<"user_role"> | undefined | null) {
  return {
    isDeveloper: role === "desenvolvedor",
    roleLabel:
      role === "desenvolvedor" ? "Desenvolvedor" : role === "gestora_de_pessoas" ? "Gestora de Pessoas" : undefined,
    showMyCafe: role === "gestora_de_pessoas",
  };
}

export function isPeopleManagerRole(role: Enums<"user_role"> | undefined | null) {
  return role === "admin" || role === "desenvolvedor" || role === "gestora_de_pessoas";
}

// Anfitriã: enxerga o café que hospeda como a líder enxerga (somente
// leitura) e também tem o próprio cadastro de participante.
export function isHostRole(role: Enums<"user_role"> | undefined | null) {
  return role === "anfitria";
}
