"use server";

import { isValidCep, onlyCepDigits } from "@/lib/field-rules";

export type CepLookupResult =
  | { ok: true; city: string; neighborhood: string; uf: string }
  | { ok: false; error: string };

// Consulta o CEP no ViaCEP pelo servidor (e não pelo navegador): a política de
// segurança do app só libera conexões para o próprio site e o Supabase, e
// assim ela não precisa mudar. Serve também ao cadastro público (sem login);
// só aceita 8 dígitos e devolve três campos, nada além disso.
export async function lookupCepAction(cep: string): Promise<CepLookupResult> {
  const digits = onlyCepDigits(cep ?? "");
  if (!isValidCep(digits)) return { ok: false, error: "CEP inválido: informe os 8 dígitos." };

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: "Não foi possível consultar o CEP agora. Preencha a cidade e o bairro." };
    const data = (await res.json()) as { erro?: boolean | string; localidade?: string; bairro?: string; uf?: string };
    if (data.erro || !data.localidade) return { ok: false, error: "CEP não encontrado. Confira os números." };
    return {
      ok: true,
      city: data.localidade,
      neighborhood: data.bairro ?? "",
      uf: data.uf ?? "",
    };
  } catch {
    return { ok: false, error: "Não foi possível consultar o CEP agora. Preencha a cidade e o bairro." };
  }
}
