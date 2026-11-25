"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicEnrollmentSchema } from "@/lib/validators/public-enrollment.schema";
import { submitPublicEnrollment } from "@/lib/services/public-enrollment.service";
import { toUserMessage } from "@/lib/errors";

export type PublicEnrollmentActionState =
  // Cadastro concluído sem redirecionar só acontece no honeypot (resposta
  // genérica de propósito). No caminho normal a pessoa já sai logada, direto
  // para o app (redirect abaixo).
  | { status: "success" }
  // Já existe cadastro com esse CPF ou telefone: nenhuma conta é criada.
  | { status: "duplicate" }
  | { status: "error"; error: string }
  | undefined;

function readOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function readArray(formData: FormData, key: string) {
  return formData.getAll(key).map(String).filter(Boolean);
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

// Mesmo padrão de captura de IP do auth-audit.service.ts (S5) — usado aqui
// só para a chave do rate limit por IP, nunca gravado como identificador
// de participante.
async function clientIp() {
  const h = await headers();
  return h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function submitPublicEnrollmentAction(
  _state: PublicEnrollmentActionState,
  formData: FormData,
): Promise<PublicEnrollmentActionState> {
  const validated = PublicEnrollmentSchema.safeParse({
    full_name: formData.get("full_name"),
    preferred_name: readOptionalString(formData, "preferred_name"),
    phone: formData.get("phone"),
    whatsapp: readOptionalString(formData, "whatsapp"),
    email: readString(formData, "email"),
    cpf: readString(formData, "cpf"),
    church_status: readOptionalString(formData, "church_status") ?? undefined,
    church_name: readOptionalString(formData, "church_name"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    birth_date: readOptionalString(formData, "birth_date"),
    cep: readOptionalString(formData, "cep"),
    city: readOptionalString(formData, "city"),
    neighborhood: readOptionalString(formData, "neighborhood"),
    address: readString(formData, "address"),
    availability_days: readArray(formData, "availability_days"),
    availability_period: readArray(formData, "availability_period"),
    location_preference: readString(formData, "location_preference"),
    home_meeting_ok: formData.get("home_meeting_ok") === "on",
    other_notes: readOptionalString(formData, "other_notes"),
    contact_authorized: formData.get("contact_authorized") === "on",
    code: formData.get("code"),
    website: readOptionalString(formData, "website"),
  });

  if (!validated.success) {
    return { status: "error", error: validated.error.issues[0]?.message ?? "Verifique os campos do formulário." };
  }

  let result: Awaited<ReturnType<typeof submitPublicEnrollment>>;
  try {
    result = await submitPublicEnrollment(validated.data, await clientIp());
  } catch (e) {
    return {
      status: "error",
      error: toUserMessage(e, "actions.publicEnrollment.submit", "Não foi possível enviar sua inscrição. Tente novamente."),
    };
  }

  if (result === "duplicate") return { status: "duplicate" };
  // "discarded" (honeypot) responde como sucesso genérico de propósito —
  // nunca ensina o bot a se adaptar revelando que foi descartado.
  if (result === "discarded") return { status: "success" };

  // Cadastro e usuário criados: já entra no app. `redirect` lança uma
  // exceção especial do Next, por isso fica fora do try/catch.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: validated.data.email.trim().toLowerCase(),
    password: validated.data.password,
  });
  if (signInError) redirect("/login");

  redirect("/feed");
}
