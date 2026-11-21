// Normaliza o nome da cidade digitado à mão: o mesmo lugar aparecia como
// "Carapicuiba", "CARAPICUIBA", "SP", "Sao paulo", "Jandira sp"... e o
// Dashboard contava cada grafia como uma região diferente.

const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e"]);

// Cidades da região (e as que já apareceram) com a grafia correta.
const CONHECIDAS = [
  "São Paulo",
  "Barueri",
  "Osasco",
  "Carapicuíba",
  "Jandira",
  "Itapevi",
  "Cotia",
  "Cajamar",
  "Santana de Parnaíba",
  "Taboão da Serra",
  "São Caetano do Sul",
  "São Bernardo do Campo",
  "São Vicente",
  "Itapecerica da Serra",
  "Embu das Artes",
  "Jundiaí",
  "Uberlândia",
  "Campinas",
  "Guarulhos",
  "Campo Limpo Paulista",
  "Vargem Grande Paulista",
  "Pirapora do Bom Jesus",
  "Santos",
];

const ALIAS: Record<string, string> = {
  sp: "São Paulo",
  "s paulo": "São Paulo",
  parnaiba: "Santana de Parnaíba",
  "s parnaiba": "Santana de Parnaíba",
};

export function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// "Jandira sp", "Jandira - SP", "Jandira/SP" → "Jandira".
function semSufixoDeEstado(s: string): string {
  return s.replace(/\s*[-/,]?\s*\bsp\b\.?$/i, "").trim() || s;
}

function chave(s: string): string {
  return semAcento(s).toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

const POR_CHAVE = new Map(CONHECIDAS.map((c) => [chave(c), c]));

function tituloCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

// Devolve o nome padronizado, ou "" quando não for um nome de cidade
// (vazio ou só números).
export function normalizarCidade(texto: string | null | undefined): string {
  const bruto = (texto ?? "").trim();
  if (!bruto || /^[\d\s.\-/]+$/.test(bruto)) return "";
  const k = chave(bruto);
  const direto = ALIAS[k] ?? POR_CHAVE.get(k);
  if (direto) return direto;
  const semUf = semSufixoDeEstado(bruto);
  const k2 = chave(semUf);
  return ALIAS[k2] ?? POR_CHAVE.get(k2) ?? tituloCase(semUf);
}
