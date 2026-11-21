import { describe, expect, it } from "vitest";
import { normalizarCidade } from "@/lib/cidade";

describe("normalizarCidade", () => {
  it("junta grafias da mesma cidade", () => {
    for (const v of ["Carapicuiba", "CARAPICUIBA", "carapicuíba", " Carapicuíba "]) {
      expect(normalizarCidade(v)).toBe("Carapicuíba");
    }
    for (const v of ["Santana de Parnaiba", "Santana De Parnaíba", "santana de parnaíba"]) {
      expect(normalizarCidade(v)).toBe("Santana de Parnaíba");
    }
  });

  it("troca sigla por nome e tira o estado do fim", () => {
    expect(normalizarCidade("SP")).toBe("São Paulo");
    expect(normalizarCidade("Sao paulo")).toBe("São Paulo");
    expect(normalizarCidade("SÃo Paulo")).toBe("São Paulo");
    expect(normalizarCidade("Jandira sp")).toBe("Jandira");
    expect(normalizarCidade("Barueri - SP")).toBe("Barueri");
  });

  it("deixa em Título as cidades que não conhece", () => {
    expect(normalizarCidade("campo limpo paulista")).toBe("Campo Limpo Paulista");
    expect(normalizarCidade("rio claro")).toBe("Rio Claro");
  });

  it("trata vazio e número como sem cidade", () => {
    expect(normalizarCidade("")).toBe("");
    expect(normalizarCidade(null)).toBe("");
    expect(normalizarCidade("56")).toBe("");
  });
});
