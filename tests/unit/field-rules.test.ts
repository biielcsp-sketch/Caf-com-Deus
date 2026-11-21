import { describe, expect, it } from "vitest";
import {
  birthDateIssue,
  churchSummary,
  emailTypoIssue,
  formatCep,
  isValidCep,
  maxBirthDate,
  onlyCepDigits,
} from "@/lib/field-rules";

describe("data de nascimento", () => {
  // Regressão (19/11/2026): o seletor do iPhone abre em "hoje" e a ficha da
  // participante foi salva com nascimento na data de hoje.
  it("recusa a data de hoje", () => {
    const hoje = new Date().toISOString().slice(0, 10);
    expect(birthDateIssue(hoje)).not.toBeNull();
  });

  it("recusa data futura e criança de 5 anos", () => {
    expect(birthDateIssue("2999-01-01")).not.toBeNull();
    const cincoAnos = new Date();
    cincoAnos.setFullYear(cincoAnos.getFullYear() - 5);
    expect(birthDateIssue(cincoAnos.toISOString().slice(0, 10))).not.toBeNull();
  });

  it("recusa data impossível e ano antigo demais", () => {
    expect(birthDateIssue("2000-02-30")).not.toBeNull();
    expect(birthDateIssue("1850-01-01")).not.toBeNull();
    expect(birthDateIssue("10/05/1990")).not.toBeNull();
  });

  it("aceita data comum e campo vazio", () => {
    expect(birthDateIssue("1990-05-10")).toBeNull();
    expect(birthDateIssue("")).toBeNull();
    expect(birthDateIssue(null)).toBeNull();
  });

  it("o limite do formulário (max) é aceito pela validação", () => {
    expect(birthDateIssue(maxBirthDate())).toBeNull();
  });
});

describe("e-mail com erro de digitação", () => {
  // Regressão: "outllok.com" passava na validação de formato.
  it("aponta domínios errados conhecidos e sugere o certo", () => {
    expect(emailTypoIssue("ana@outllok.com")).toContain("ana@outlook.com");
    expect(emailTypoIssue("ana@gmial.com")).toContain("gmail.com");
    expect(emailTypoIssue("ANA@Hotmial.com")).toContain("hotmail.com");
  });

  it("não atrapalha e-mails corretos nem vazios", () => {
    expect(emailTypoIssue("ana@outlook.com")).toBeNull();
    expect(emailTypoIssue("ana@gmail.com")).toBeNull();
    expect(emailTypoIssue("ana@empresa.com.br")).toBeNull();
    expect(emailTypoIssue("")).toBeNull();
    expect(emailTypoIssue(undefined)).toBeNull();
  });
});

describe("CEP", () => {
  it("normaliza e formata", () => {
    expect(onlyCepDigits("06.700-000 ")).toBe("06700000");
    expect(onlyCepDigits("123456789012")).toBe("12345678");
    expect(formatCep("06700000")).toBe("06700-000");
    expect(formatCep("067")).toBe("067");
  });

  it("valida só 8 dígitos", () => {
    expect(isValidCep("06700000")).toBe(true);
    expect(isValidCep("0670000")).toBe(false);
    expect(isValidCep("06700-000")).toBe(false);
    expect(isValidCep(null)).toBe(false);
  });
});

describe("resumo da igreja", () => {
  it("usa o campo novo", () => {
    expect(churchSummary({ church_status: "lagoinha", church_name: null, is_lagoinha_member: true })).toContain(
      "Lagoinha",
    );
    expect(churchSummary({ church_status: "outra", church_name: "Batista", is_lagoinha_member: false })).toBe(
      "Outra igreja: Batista",
    );
    expect(churchSummary({ church_status: "nenhuma", church_name: null, is_lagoinha_member: false })).toContain(
      "Ainda não frequenta",
    );
  });

  it("cai no campo antigo quando o novo não foi preenchido", () => {
    expect(churchSummary({ church_status: null, church_name: null, is_lagoinha_member: false })).toContain(
      "Não é de Lagoinha",
    );
    expect(churchSummary({ church_status: null, church_name: null, is_lagoinha_member: null })).toBe("Não informado");
  });
});
