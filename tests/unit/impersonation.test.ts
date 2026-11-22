import { describe, expect, it } from "vitest";
import {
  IMPERSONATION_MAX_AGE_SECONDS,
  impersonationCutoff,
  isImpersonationExpired,
} from "@/lib/impersonation";

describe("validade do 'Ver como esta pessoa'", () => {
  const agora = new Date("2026-11-21T12:00:00Z");
  const haHoras = (h: number) => new Date(agora.getTime() - h * 3600 * 1000);

  it("dura 8 horas", () => {
    expect(IMPERSONATION_MAX_AGE_SECONDS).toBe(8 * 60 * 60);
  });

  it("visita recente ainda vale", () => {
    expect(isImpersonationExpired(haHoras(1), agora)).toBe(false);
    expect(isImpersonationExpired(haHoras(7.9), agora)).toBe(false);
  });

  it("visita com 8 horas ou mais venceu", () => {
    expect(isImpersonationExpired(haHoras(8), agora)).toBe(true);
    expect(isImpersonationExpired(haHoras(30), agora)).toBe(true);
  });

  it("aceita data em texto e o corte é 8h antes de agora", () => {
    expect(isImpersonationExpired(haHoras(2).toISOString(), agora)).toBe(false);
    expect(impersonationCutoff(agora).toISOString()).toBe("2026-11-21T04:00:00.000Z");
  });
});
