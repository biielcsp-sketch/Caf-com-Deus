import { describe, it, expect } from "vitest";
import { proximosEncontros } from "@/lib/proximos-encontros";

const m = (date: string, time: string | null, status = "planejado") => ({ date, time, status });

describe("proximosEncontros", () => {
  it("não deixa 4 encontros de hoje esconderem os confirmados do dia seguinte", () => {
    const lista = [
      m("2026-11-27", "17:30"),
      m("2026-11-27", "15:00"),
      m("2026-11-27", "10:00"),
      m("2026-11-27", "09:30"),
      m("2026-11-28", "10:00", "confirmado"),
    ];
    const { itens, total } = proximosEncontros(lista, "2026-11-27");
    expect(total).toBe(5);
    expect(itens.some((e) => e.date === "2026-11-28" && e.status === "confirmado")).toBe(true);
  });

  it("ordena por data e horário crescentes, sem horário no fim do dia", () => {
    const { itens } = proximosEncontros(
      [m("2026-11-28", null), m("2026-11-28", "09:00"), m("2026-11-27", "17:00")],
      "2026-11-27",
    );
    expect(itens.map((e) => `${e.date} ${e.time}`)).toEqual([
      "2026-11-27 17:00",
      "2026-11-28 09:00",
      "2026-11-28 null",
    ]);
  });

  it("ignora cancelados e passados, e informa o total quando passa do limite", () => {
    const lista = [
      m("2026-11-26", "10:00"),
      m("2026-11-28", "10:00", "cancelado"),
      m("2026-11-28", "11:00"),
      m("2026-11-29", "11:00"),
      m("2026-11-30", "11:00"),
    ];
    const { itens, total } = proximosEncontros(lista, "2026-11-27", 2);
    expect(total).toBe(3);
    expect(itens).toHaveLength(2);
  });
});
