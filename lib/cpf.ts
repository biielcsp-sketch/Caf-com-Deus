// Utilitários de CPF. Sem `server-only` de propósito: a mesma máscara é usada
// no formulário (cliente) e a validação roda de novo no servidor.

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

// Dígitos verificadores do CPF. Recusa sequências repetidas (111.111.111-11),
// que passam na conta mas não existem.
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digit = (base: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (factor - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return (
    digit(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    digit(cpf.slice(0, 10), 11) === Number(cpf[10])
  );
}

// 12345678901 -> 123.456.789-01 (aceita entrada parcial, para máscara ao digitar).
export function formatCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// Para telas que só mostram o CPF: ***.456.789-**
export function maskCpf(value: string | null | undefined): string {
  const d = onlyDigits(value ?? "");
  if (d.length !== 11) return "";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}
