import { Search, SlidersHorizontal } from "lucide-react";
import { PARTICIPANT_STATUS_LABELS } from "@/lib/participant-status-labels";
import type { Enums } from "@/types/database.types";

const STATUS_CHIPS: { value: string; label: string }[] = [
  { value: "", label: "Todas" },
  ...(Object.entries(PARTICIPANT_STATUS_LABELS) as [Enums<"participant_status">, string][]).map(
    ([value, label]) => ({ value, label }),
  ),
];

const fieldLabel = "flex flex-col gap-1.5 text-xs font-semibold text-foreground";
const fieldClass = "h-12 w-full text-sm";

// Busca + chips de situação (como na prévia aprovada). Cada chip é um botão
// de envio do próprio formulário: clicar nele refaz a busca mantendo o texto
// digitado e os filtros avançados, sem JavaScript.
export function ParticipantsFilters({
  variant,
  leaders,
  groups,
  defaults,
}: {
  variant: "admin" | "lider";
  leaders?: { id: string; full_name: string }[];
  groups?: { id: string; name: string }[];
  defaults: Record<string, string | undefined>;
}) {
  const activeStatus = defaults.status ?? "";

  return (
    <form className="flex flex-col gap-3">
      <div className="relative">
        <Search
          size={19}
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          name="search"
          type="search"
          aria-label="Buscar participante"
          placeholder="Buscar por nome"
          defaultValue={defaults.search}
          className="h-12 w-full text-[15px]"
          style={{ paddingLeft: "2.75rem" }}
        />
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {STATUS_CHIPS.map((chip) => {
          const active = chip.value === activeStatus;
          return (
            <button
              key={chip.value || "todas"}
              type="submit"
              name="status"
              value={chip.value}
              aria-pressed={active}
              className={`h-10 shrink-0 rounded-full px-4 text-sm ${
                active ? "glass-green font-semibold" : "glass-inner font-medium text-foreground"
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {variant === "admin" && (
        <details className="group" open={Boolean(defaults.leaderId || defaults.groupId || defaults.region || defaults.enrolledFrom || defaults.enrolledTo)}>
          <summary className="glass-inner flex h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-full px-4 text-sm font-medium text-foreground">
            <SlidersHorizontal size={16} />
            Mais filtros
          </summary>
          <div className="glass-inner mt-3 grid grid-cols-1 gap-3 rounded-3xl p-4 sm:grid-cols-2">
            <label className={fieldLabel}>
              Líder
              <select name="leaderId" defaultValue={defaults.leaderId ?? ""} className={fieldClass}>
                <option value="">Todas as líderes</option>
                {leaders?.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className={fieldLabel}>
              Grupo
              <select name="groupId" defaultValue={defaults.groupId ?? ""} className={fieldClass}>
                <option value="">Todos os grupos</option>
                {groups?.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={fieldLabel}>
              Cidade ou bairro
              <input name="region" defaultValue={defaults.region} className={fieldClass} />
            </label>
            <span aria-hidden className="hidden sm:block" />
            <label className={fieldLabel}>
              Inscrita a partir de
              <input name="enrolledFrom" type="date" defaultValue={defaults.enrolledFrom} className={fieldClass} />
            </label>
            <label className={fieldLabel}>
              Inscrita até
              <input name="enrolledTo" type="date" defaultValue={defaults.enrolledTo} className={fieldClass} />
            </label>
            <button type="submit" className="glass-green h-12 rounded-full px-5 text-sm font-semibold sm:col-span-2">
              Aplicar filtros
            </button>
          </div>
        </details>
      )}
    </form>
  );
}
