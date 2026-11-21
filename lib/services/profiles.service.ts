import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { AppError, dbError } from "@/lib/errors";
import type { Tables } from "@/types/database.types";
import type { MyProfileInput } from "@/lib/validators/my-profile.schema";

export type CurrentProfile = Tables<"profiles">;

// Único ponto de verdade para "nível administrativo": admin, desenvolvedor e
// Gestora de Pessoas têm acesso idêntico (RLS via app_is_admin() trata os três
// como um só portão) — toda checagem redundante de papel em Server Action
// deve usar isto em vez de comparar com "admin" diretamente, senão um dos
// papéis fica bloqueado em ações que a RLS já libera para ele.
//
// Gestora de Pessoas entrou aqui em 17/10/2026 (v74): decisão do Gabriel de
// dar a ela o mesmo perfil da pastora, mudando só o nome do papel.
export function isAdminRole(role: CurrentProfile["role"] | undefined | null) {
  return role === "admin" || role === "desenvolvedor" || role === "gestora_de_pessoas";
}

// `cache()` do React: memoriza o resultado DENTRO de uma requisição. Sem ele,
// abrir uma tela custava de duas a três validações de sessão no Supabase Auth
// (~250ms cada, medido): uma no middleware, uma no layout e outra na própria
// página — todas idênticas, uma depois da outra, antes de qualquer dado
// aparecer. Agora a primeira chamada paga a viagem e as demais reaproveitam.
// O cache vale só para aquela requisição: a requisição seguinte revalida do
// zero, então continua valendo o mesmo para conta desativada e troca de papel.
export const getCurrentProfile = cache(async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) return null;
  // Conta desativada é tratada como sessão inválida em todo o app — todo
  // layout (admin/líder/participante) já chama getCurrentProfile() e
  // redireciona pra /login quando isso retorna null, então desativar aqui
  // é o único ponto necessário pra derrubar o acesso de imediato, mesmo
  // numa sessão já aberta (não precisa esperar o token expirar).
  if (!data.active) return null;
  return data;
});

// Autoatendimento: qualquer usuária autenticada atualiza os PRÓPRIOS
// nome/telefone/whatsapp — nunca aceita um id de outra pessoa, o alvo é
// sempre resolvido pela sessão.
export async function updateMyProfile(input: MyProfileInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AppError("Sessão expirada. Faça login novamente.");

  // RLS negando UPDATE não devolve erro, devolve zero linhas — sem checar, a
  // tela dizia "Perfil atualizado" e o nome voltava ao antigo ao recarregar.
  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: input.full_name,
      phone: input.phone || null,
      whatsapp: input.whatsapp || null,
    })
    .eq("id", user.id)
    .select("id");

  if (error) dbError(error, "profiles.updateMy");
  if (!data || data.length === 0) {
    throw new AppError("Não foi possível salvar seu perfil. Faça login novamente e tente de novo.");
  }
}
