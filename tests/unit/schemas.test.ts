import { describe, expect, it } from "vitest";
import { ParticipantPersonalSchema } from "@/lib/validators/participant.schema";
import { PublicEnrollmentSchema } from "@/lib/validators/public-enrollment.schema";

const base = { full_name: "Ana Maria" };

describe("ParticipantPersonalSchema", () => {
  it("recusa nascimento igual a hoje (regressão 19/11/2026)", () => {
    const hoje = new Date().toISOString().slice(0, 10);
    expect(ParticipantPersonalSchema.safeParse({ ...base, birth_date: hoje }).success).toBe(false);
  });

  it("recusa e-mail com domínio errado (regressão outllok.com)", () => {
    const r = ParticipantPersonalSchema.safeParse({ ...base, email: "a@outllok.com" });
    expect(r.success).toBe(false);
  });

  it("aceita e-mail vazio e nulo", () => {
    expect(ParticipantPersonalSchema.safeParse({ ...base, email: "" }).success).toBe(true);
    expect(ParticipantPersonalSchema.safeParse({ ...base, email: null }).success).toBe(true);
  });

  it("guarda o CEP só com dígitos e recusa CEP incompleto", () => {
    const ok = ParticipantPersonalSchema.safeParse({ ...base, cep: "06700-000" });
    expect(ok.success && ok.data.cep).toBe("06700000");
    expect(ParticipantPersonalSchema.safeParse({ ...base, cep: "0670" }).success).toBe(false);
    const vazio = ParticipantPersonalSchema.safeParse({ ...base, cep: "" });
    expect(vazio.success && vazio.data.cep).toBeNull();
  });

  it("só aceita as três respostas de igreja", () => {
    for (const v of ["lagoinha", "outra", "nenhuma"]) {
      expect(ParticipantPersonalSchema.safeParse({ ...base, church_status: v }).success).toBe(true);
    }
    expect(ParticipantPersonalSchema.safeParse({ ...base, church_status: "talvez" }).success).toBe(false);
  });
});

describe("PublicEnrollmentSchema", () => {
  const valido = {
    full_name: "Ana Maria",
    phone: "11999998888",
    email: "ana@gmail.com",
    cpf: "529.982.247-25",
    church_status: "lagoinha",
    password: "segredo1",
    confirmPassword: "segredo1",
    address: "Rua A, 10",
    availability_days: ["segunda"],
    availability_period: ["manha"],
    location_preference: "Perto de casa",
    contact_authorized: true,
    code: "cafecomdeus",
  };

  it("aceita um cadastro completo", () => {
    expect(PublicEnrollmentSchema.safeParse(valido).success).toBe(true);
  });

  it("exige a resposta sobre igreja", () => {
    const { church_status: _omitido, ...semIgreja } = valido;
    void _omitido;
    expect(PublicEnrollmentSchema.safeParse(semIgreja).success).toBe(false);
  });

  it("pede o nome quando a igreja é outra", () => {
    expect(PublicEnrollmentSchema.safeParse({ ...valido, church_status: "outra" }).success).toBe(false);
    expect(
      PublicEnrollmentSchema.safeParse({ ...valido, church_status: "outra", church_name: "Batista" }).success,
    ).toBe(true);
  });

  it("recusa e-mail com erro de digitação, nascimento de hoje e CEP curto", () => {
    expect(PublicEnrollmentSchema.safeParse({ ...valido, email: "ana@outllok.com" }).success).toBe(false);
    const hoje = new Date().toISOString().slice(0, 10);
    expect(PublicEnrollmentSchema.safeParse({ ...valido, birth_date: hoje }).success).toBe(false);
    expect(PublicEnrollmentSchema.safeParse({ ...valido, cep: "123" }).success).toBe(false);
  });

  it("exige a autorização de contato e senhas iguais", () => {
    expect(PublicEnrollmentSchema.safeParse({ ...valido, contact_authorized: false }).success).toBe(false);
    expect(PublicEnrollmentSchema.safeParse({ ...valido, confirmPassword: "outra" }).success).toBe(false);
  });
});
