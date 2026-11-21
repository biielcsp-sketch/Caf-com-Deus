"use client";

import { useState } from "react";
import { lookupCepAction } from "@/app/actions/cep";
import { formatCep, isValidCep, onlyCepDigits } from "@/lib/field-rules";

// Estado onde o ministério atua. CEP de outro estado ganha um aviso para a
// líder conferir (caso real: participante de MG que não foi reconhecida pelo
// bairro).
const UF_DO_MINISTERIO = "SP";

// Escreve num campo não controlado (defaultValue) e avisa o React.
function preencher(id: string, valor: string) {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (!el || !valor) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(el, valor);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

export function CepField({
  defaultValue,
  inputClass,
  labelClass,
  cityId = "city",
  neighborhoodId = "neighborhood",
}: {
  defaultValue?: string | null;
  inputClass: string;
  labelClass: string;
  cityId?: string;
  neighborhoodId?: string;
}) {
  const [valor, setValor] = useState(formatCep(defaultValue));
  const [aviso, setAviso] = useState<{ tipo: "ok" | "alerta" | "erro"; texto: string } | null>(null);
  const [buscando, setBuscando] = useState(false);

  async function buscar(texto: string) {
    const digits = onlyCepDigits(texto);
    if (!isValidCep(digits)) {
      setAviso(digits.length > 0 ? { tipo: "erro", texto: "Informe os 8 dígitos do CEP." } : null);
      return;
    }
    setBuscando(true);
    const r = await lookupCepAction(digits);
    setBuscando(false);
    if (!r.ok) {
      setAviso({ tipo: "erro", texto: r.error });
      return;
    }
    preencher(cityId, r.city);
    preencher(neighborhoodId, r.neighborhood);
    if (r.uf && r.uf !== UF_DO_MINISTERIO) {
      setAviso({
        tipo: "alerta",
        texto: `Este CEP é de ${r.city}/${r.uf}, fora de ${UF_DO_MINISTERIO}. Confira com a participante.`,
      });
    } else {
      setAviso({ tipo: "ok", texto: `${r.city}${r.uf ? `/${r.uf}` : ""} — cidade e bairro preenchidos pelo CEP.` });
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className={labelClass} htmlFor="cep">
        CEP
      </label>
      <input
        id="cep"
        name="cep"
        inputMode="numeric"
        autoComplete="postal-code"
        placeholder="00000-000"
        maxLength={9}
        value={valor}
        onChange={(e) => {
          const formatado = formatCep(e.target.value);
          setValor(formatado);
          if (onlyCepDigits(formatado).length === 8) void buscar(formatado);
          else setAviso(null);
        }}
        className={inputClass}
      />
      {buscando && <p className="text-xs text-muted-foreground">Buscando o CEP...</p>}
      {!buscando && aviso && (
        <p
          className={`text-xs ${
            aviso.tipo === "erro" ? "text-danger" : aviso.tipo === "alerta" ? "font-medium text-danger" : "text-muted-foreground"
          }`}
        >
          {aviso.texto}
        </p>
      )}
    </div>
  );
}
