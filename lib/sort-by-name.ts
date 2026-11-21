// Ordem alfabética das listas de pessoas (chamada, vincular participante ao
// encontro). `localeCompare` em pt-BR com sensitivity "base" ignora acento e
// maiúscula: "Ágata" fica junto de "Agatha", e não no fim da lista.
const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

export function compareNames(a: string | null | undefined, b: string | null | undefined) {
  return collator.compare((a ?? "").trim(), (b ?? "").trim());
}

export function sortByName<T>(items: T[], getName: (item: T) => string | null | undefined): T[] {
  return [...items].sort((x, y) => compareNames(getName(x), getName(y)));
}
