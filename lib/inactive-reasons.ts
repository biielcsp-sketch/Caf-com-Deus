// Motivo de a participante ter ficado Inativa — o que o PPT chamou de
// "regularidade". Decisão de 17/10/2026: um campo só. Marcar Inativa pede o
// motivo; voltar para Ativa limpa. Assim a situação e o motivo nunca se
// contradizem ("Ativa" com "Saiu da igreja").
export const INACTIVE_REASONS = [
  "saiu_do_cafe",
  "saiu_da_igreja",
  "foi_para_outro_cafe",
  "multiplicou_o_cafe",
  "sem_disponibilidade",
  "outra_lagoinha",
] as const;

export type InactiveReason = (typeof INACTIVE_REASONS)[number];

export const INACTIVE_REASON_LABELS: Record<InactiveReason, string> = {
  saiu_do_cafe: "Saiu do café",
  saiu_da_igreja: "Saiu da igreja",
  foi_para_outro_cafe: "Foi para outro café",
  multiplicou_o_cafe: "Multiplicou o café",
  sem_disponibilidade: "Sem disponibilidade",
  outra_lagoinha: "É de outra Lagoinha",
};

export function isInactiveReason(v: unknown): v is InactiveReason {
  return typeof v === "string" && (INACTIVE_REASONS as readonly string[]).includes(v);
}
