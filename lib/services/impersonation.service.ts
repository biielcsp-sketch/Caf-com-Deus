import "server-only";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/services/profiles.service";
import { AppError, dbError } from "@/lib/errors";
import {
  IMPERSONATION_COOKIE,
  IMPERSONATION_MAX_AGE_SECONDS,
  IMPERSONATION_NAME_COOKIE,
  impersonationCutoff,
} from "@/lib/impersonation";

// "Ver como esta pessoa" (só Desenvolvedor). Espelha o "usuário espião" do app
// Consolidação: a troca de sessão é real, o servidor emite uma sessão de verdade
// da conta visitada. A diferença é onde fica a sessão original: lá ela vai para o
// sessionStorage do navegador; aqui o navegador nunca recebe token do
// desenvolvedor. Ele guarda só o id opaco de uma linha em impersonation_sessions
// (cookie httpOnly) e, no "Voltar", o servidor emite uma sessão nova para o
// desenvolvedor registrado naquela linha, depois de conferir que ele continua
// ativo e continua Desenvolvedor.

type Meta = { ip: string | null; userAgent: string | null };

async function requestMeta(): Promise<Meta> {
  const h = await headers();
  return {
    ip: h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for") ?? null,
    userAgent: h.get("user-agent"),
  };
}

// Pede ao Auth um link de acesso para o e-mail e devolve só o hash do token.
// generateLink NÃO envia e-mail nenhum: o hash é consumido logo em seguida,
// pelo próprio servidor, em verifyOtp.
async function issueTokenHash(email: string, context: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    console.error("[impersonation:%s]", context, error ?? "link sem hashed_token");
    return null;
  }
  return tokenHash;
}

function clearImpersonationCookies(store: Awaited<ReturnType<typeof cookies>>) {
  store.delete(IMPERSONATION_COOKIE);
  store.delete(IMPERSONATION_NAME_COOKIE);
}

// Nome da pessoa visitada, para a faixa. Null quando não há visita em curso.
// É só texto de tela: quem decide se o "Voltar" funciona é o banco.
export async function getImpersonationBanner(): Promise<{ targetName: string } | null> {
  const store = await cookies();
  if (!store.get(IMPERSONATION_COOKIE)?.value) return null;
  return { targetName: store.get(IMPERSONATION_NAME_COOKIE)?.value || "outra pessoa" };
}

export async function startImpersonation(targetId: string) {
  const store = await cookies();
  if (store.get(IMPERSONATION_COOKIE)) {
    throw new AppError("Você já está vendo como outra pessoa. Volte para a sua conta antes de trocar.");
  }

  const me = await getCurrentProfile();
  if (me?.role !== "desenvolvedor") {
    throw new AppError("Só o perfil Desenvolvedor pode ver o sistema como outra pessoa.");
  }
  if (targetId === me.id) throw new AppError("Esta já é a sua conta.");

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("id, full_name, email, active")
    .eq("id", targetId)
    .maybeSingle();
  if (targetError) dbError(targetError, "impersonation.target");
  if (!target) throw new AppError("Conta não encontrada.");
  if (!target.active) throw new AppError("Esta conta está desativada. Reative antes de ver como ela.");
  if (!target.email) throw new AppError("Esta conta não tem e-mail de acesso.");

  const tokenHash = await issueTokenHash(target.email, "start");
  if (!tokenHash) throw new AppError("Não foi possível abrir a conta dessa pessoa. Tente de novo.");

  // O registro vem ANTES da troca de sessão: se a gravação falhar, nada mudou.
  const { ip, userAgent } = await requestMeta();
  const { data: row, error: insertError } = await admin
    .from("impersonation_sessions")
    .insert({
      developer_id: me.id,
      target_id: target.id,
      target_name: target.full_name,
      ip_address: ip,
      user_agent: userAgent,
    })
    .select("id")
    .single();
  if (insertError) dbError(insertError, "impersonation.insert");

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (verifyError) {
    console.error("[impersonation:start] verifyOtp falhou", verifyError);
    await admin.from("impersonation_sessions").update({ ended_at: new Date().toISOString() }).eq("id", row.id);
    throw new AppError("Não foi possível abrir a conta dessa pessoa. Tente de novo.");
  }

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: IMPERSONATION_MAX_AGE_SECONDS,
  };
  store.set(IMPERSONATION_COOKIE, row.id, cookieOptions);
  store.set(IMPERSONATION_NAME_COOKIE, target.full_name, cookieOptions);
}

// Devolve true quando a sessão do desenvolvedor foi reassumida. Em qualquer
// falha derruba a sessão da conta visitada e devolve false: quem chama manda
// para o login, sem deixar ninguém preso na conta de outra pessoa.
export async function stopImpersonation(): Promise<boolean> {
  const store = await cookies();
  const sessionId = store.get(IMPERSONATION_COOKIE)?.value;
  const supabase = await createClient();

  const fail = async () => {
    clearImpersonationCookies(store);
    // scope "local": derruba só ESTA sessão. O padrão (global) deslogaria a
    // pessoa visitada em todos os aparelhos dela.
    await supabase.auth.signOut({ scope: "local" });
    return false;
  };

  if (!sessionId) return fail();

  const admin = createAdminClient();
  // Reivindica a linha de forma atômica: cada visita só volta uma vez, e uma
  // visita vencida não volta.
  const { data: claimed, error: claimError } = await admin
    .from("impersonation_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .is("ended_at", null)
    .gt("started_at", impersonationCutoff().toISOString())
    .select("developer_id")
    .maybeSingle();
  if (claimError) console.error("[impersonation:stop] reivindicar", claimError);
  if (!claimed) return fail();

  const { data: dev, error: devError } = await admin
    .from("profiles")
    .select("email, role, active")
    .eq("id", claimed.developer_id)
    .maybeSingle();
  if (devError) console.error("[impersonation:stop] desenvolvedor", devError);
  if (!dev || !dev.active || dev.role !== "desenvolvedor" || !dev.email) return fail();

  const tokenHash = await issueTokenHash(dev.email, "stop");
  if (!tokenHash) return fail();

  await supabase.auth.signOut({ scope: "local" });
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (verifyError) {
    console.error("[impersonation:stop] verifyOtp falhou", verifyError);
    return fail();
  }

  clearImpersonationCookies(store);
  return true;
}
