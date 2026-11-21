// Regras de campo usadas pelos formulários (cliente) e pelos validadores
// (servidor). Sem dependência de servidor: este arquivo roda nos dois lados.

// ── Data de nascimento ─────────────────────────────────────────────────────
// No iPhone o seletor de data abre em "hoje"; tocar em OK sem escolher grava a
// data de hoje (caso real: ficha com nascimento em 19/11/2026). A idade mínima
// do cadastro é 10 anos — abaixo disso é erro de digitação ou data padrão.
const IDADE_MINIMA = 10;
const ANO_MINIMO = 1900;

/** Maior data de nascimento aceita, como "AAAA-MM-DD". */
export function maxBirthDate(base = new Date()): string {
  const d = new Date(base);
  d.setFullYear(d.getFullYear() - IDADE_MINIMA);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Mensagem de erro para a data de nascimento, ou null se estiver ok/vazia. */
export function birthDateIssue(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Data de nascimento inválida.";
  const [ano, mes, dia] = value.split("-").map(Number);
  const real = new Date(Date.UTC(ano, mes - 1, dia));
  if (real.getUTCFullYear() !== ano || real.getUTCMonth() !== mes - 1 || real.getUTCDate() !== dia) {
    return "Data de nascimento inválida.";
  }
  if (ano < ANO_MINIMO || value > maxBirthDate()) {
    return "Confira a data de nascimento: ela parece incorreta (por exemplo, a data de hoje).";
  }
  return null;
}

// ── E-mail com erro de digitação ───────────────────────────────────────────
// O e-mail é o login da participante e o contato da líder. Um erro como
// "outllok.com" passa na validação de formato e a pessoa nunca recebe nada.
const DOMINIOS_COM_ERRO: Record<string, string> = {
  "outllok.com": "outlook.com",
  "outlok.com": "outlook.com",
  "outlook.con": "outlook.com",
  "outloook.com": "outlook.com",
  "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmail.com.com": "hotmail.com",
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.com.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gnail.com": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "yahoo.com.com": "yahoo.com",
  "icoud.com": "icloud.com",
  "icloud.con": "icloud.com",
};

/** Mensagem se o domínio do e-mail é um erro de digitação conhecido, ou null. */
export function emailTypoIssue(email: string | null | undefined): string | null {
  if (!email) return null;
  const [usuario, dominio] = email.trim().toLowerCase().split("@");
  if (!usuario || !dominio) return null;
  const certo = DOMINIOS_COM_ERRO[dominio];
  return certo ? `Confira o e-mail: o domínio "${dominio}" parece errado. Você quis dizer ${usuario}@${certo}?` : null;
}

// ── CEP ────────────────────────────────────────────────────────────────────
export function onlyCepDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8);
}

export function isValidCep(value: string | null | undefined): boolean {
  return !!value && /^\d{8}$/.test(value);
}

export function formatCep(value: string | null | undefined): string {
  const d = onlyCepDigits(value ?? "");
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

// ── Igreja ─────────────────────────────────────────────────────────────────
export const CHURCH_STATUSES = ["lagoinha", "outra", "nenhuma"] as const;
export type ChurchStatus = (typeof CHURCH_STATUSES)[number];

export const CHURCH_STATUS_LABELS: Record<ChurchStatus, string> = {
  lagoinha: "Membro de Lagoinha Alphaville",
  outra: "Frequenta outra igreja",
  nenhuma: "Ainda não frequenta igreja",
};

/** Texto para mostrar na ficha, juntando os dados novos e o campo antigo. */
export function churchSummary(p: {
  church_status: string | null;
  church_name: string | null;
  is_lagoinha_member: boolean | null;
}): string {
  if (p.church_status === "outra") return p.church_name ? `Outra igreja: ${p.church_name}` : "Outra igreja";
  if (p.church_status === "lagoinha" || p.church_status === "nenhuma") {
    return CHURCH_STATUS_LABELS[p.church_status];
  }
  if (p.is_lagoinha_member === false) return "Não é de Lagoinha (outra igreja ou nenhuma, sem detalhe)";
  return "Não informado";
}
