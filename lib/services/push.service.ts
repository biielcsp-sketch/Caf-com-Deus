import "server-only";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, dbError } from "@/lib/errors";

// Notificação no celular (Web Push). As notificações nascem no banco
// (gatilhos e rotinas); o banco chama /api/push/dispatch pelo pg_net e esta
// camada entrega nos aparelhos inscritos. Migration 20261018170000.
//
// Variáveis no Netlify (opcionais — sem elas o push fica desligado e o resto
// do app segue normal):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...),
//   PUSH_DISPATCH_SECRET (o mesmo valor guardado no Vault do Supabase).

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

function configurarVapid() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:cafecomdeus.shine@gmail.com";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  return true;
}

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string | null;
};

// Grava o aparelho da pessoa logada. Usa service_role para o upsert porque o
// mesmo navegador pode ter sido usado antes por outra conta (o endpoint é
// único): o aparelho passa a ser de quem está logada agora. O dono é sempre
// resolvido pela sessão, nunca pelo que vem do navegador.
export async function savePushSubscription(input: PushSubscriptionInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AppError("Sessão expirada. Entre de novo.");
  if (!/^https:\/\//.test(input.endpoint)) throw new AppError("Inscrição de notificação inválida.");

  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert(
      {
        profile_id: user.id,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        user_agent: input.userAgent?.slice(0, 300) ?? null,
      },
      { onConflict: "endpoint" },
    );
  if (error) dbError(error, "push.save", "Não foi possível ativar as notificações neste aparelho.");
}

export async function removePushSubscription(endpoint: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) dbError(error, "push.remove");
}

export async function countMyPushDevices() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count } = await supabase
    .from("push_subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", user.id);
  return count ?? 0;
}

const MAX_TENTATIVAS = 5;

// Envia o push das notificações pedidas (ou, sem ids, de tudo que ficou para
// trás nas últimas 24h). Chamado só pela rota /api/push/dispatch, que já
// conferiu o segredo.
export async function dispatchPush(ids: string[]) {
  if (!configurarVapid()) return { enviados: 0, motivo: "VAPID não configurado" };
  const admin = createAdminClient();

  let query = admin
    .from("notifications")
    .select("id, profile_id, title, body, link, push_attempts")
    .is("pushed_at", null)
    .lt("push_attempts", MAX_TENTATIVAS);
  if (ids.length > 0) query = query.in("id", ids);
  else query = query.gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const { data: pendentes, error } = await query.limit(200);
  if (error) dbError(error, "push.pending");
  if (!pendentes || pendentes.length === 0) return { enviados: 0 };

  const perfis = [...new Set(pendentes.map((n) => n.profile_id))];
  const { data: subs, error: subsError } = await admin
    .from("push_subscriptions")
    .select("id, profile_id, endpoint, p256dh, auth")
    .in("profile_id", perfis);
  if (subsError) dbError(subsError, "push.subscriptions");

  let enviados = 0;
  const mortas = new Set<string>();
  for (const n of pendentes) {
    const aparelhos = (subs ?? []).filter((s) => s.profile_id === n.profile_id && !mortas.has(s.id));
    let algumOk = false;
    let falhaTemporaria = false;
    for (const s of aparelhos) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: n.title, body: n.body ?? "", url: n.link ?? "/notificacoes", tag: n.id }),
          { TTL: 60 * 60 * 24 },
        );
        algumOk = true;
        enviados++;
        await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", s.id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410: o aparelho cancelou a inscrição ou o app foi desinstalado.
        if (status === 404 || status === 410) {
          mortas.add(s.id);
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          falhaTemporaria = true;
          console.error("[push.send]", status, (e as Error).message);
        }
      }
    }
    // Sem aparelho inscrito, ou entregue em algum: não tenta de novo. Só a
    // falha temporária (rede, serviço de push fora) fica para a varredura.
    const concluido = algumOk || aparelhos.length === 0 || !falhaTemporaria;
    await admin
      .from("notifications")
      .update({
        push_attempts: n.push_attempts + 1,
        ...(concluido ? { pushed_at: new Date().toISOString() } : {}),
      })
      .eq("id", n.id);
  }
  return { enviados };
}
