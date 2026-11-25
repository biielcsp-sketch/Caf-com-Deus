import { describe, expect, it } from "vitest";
import { estudoVisivelNoFeed } from "@/lib/study-materials";

const ATUAL = "2026-11";
const PROXIMO = "2026-12";

describe("estudoVisivelNoFeed", () => {
  it("todas veem o estudo do mês vigente", () => {
    for (const papel of ["participante", "anfitria", "lider", "co_lider", "admin"]) {
      expect(estudoVisivelNoFeed(papel, "2026-11-01", ATUAL, PROXIMO)).toBe(true);
    }
  });

  it("líder, co-líder e gestão veem o mês seguinte (Já disponível)", () => {
    for (const papel of ["lider", "co_lider", "admin", "desenvolvedor", "gestora_de_pessoas"]) {
      expect(estudoVisivelNoFeed(papel, "2026-12-01", ATUAL, PROXIMO)).toBe(true);
    }
  });

  it("participante e anfitriã não veem o mês seguinte", () => {
    for (const papel of ["participante", "anfitria"]) {
      expect(estudoVisivelNoFeed(papel, "2026-12-01", ATUAL, PROXIMO)).toBe(false);
    }
  });

  it("meses antigos ou distantes nunca aparecem no Feed", () => {
    expect(estudoVisivelNoFeed("lider", "2026-10-01", ATUAL, PROXIMO)).toBe(false);
    expect(estudoVisivelNoFeed("lider", "2027-01-01", ATUAL, PROXIMO)).toBe(false);
  });
});
