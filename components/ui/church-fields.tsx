"use client";

import { useState } from "react";
import { CHURCH_STATUSES, CHURCH_STATUS_LABELS, type ChurchStatus } from "@/lib/field-rules";

// Igreja da participante: Lagoinha Alphaville, outra (com o nome) ou nenhuma.
export function ChurchFields({
  defaultStatus,
  defaultName,
  required,
  inputClass,
  labelClass,
}: {
  defaultStatus?: string | null;
  defaultName?: string | null;
  required?: boolean;
  inputClass: string;
  labelClass: string;
}) {
  const inicial = (CHURCH_STATUSES as readonly string[]).includes(defaultStatus ?? "")
    ? (defaultStatus as ChurchStatus)
    : null;
  const [status, setStatus] = useState<ChurchStatus | null>(inicial);

  return (
    <fieldset className="flex flex-col gap-2 sm:col-span-2">
      <legend className={labelClass}>Igreja</legend>
      <div className="flex flex-col gap-2">
        {CHURCH_STATUSES.map((value) => (
          <label key={value} className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="radio"
              name="church_status"
              value={value}
              required={required}
              checked={status === value}
              onChange={() => setStatus(value)}
              className="h-4 w-4"
            />
            {CHURCH_STATUS_LABELS[value]}
          </label>
        ))}
      </div>
      {status === "outra" && (
        <input
          name="church_name"
          required
          placeholder="Nome da igreja"
          defaultValue={defaultName ?? ""}
          className={inputClass}
        />
      )}
    </fieldset>
  );
}
