import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { dispatchPush } from "@/lib/services/push.service";

// Chamado pelo banco (pg_net) a cada notificação nova e pela varredura de 5 em
// 5 minutos. Não tem sessão de usuária: a autorização é o segredo no
// cabeçalho, o mesmo guardado no Vault do Supabase (push_dispatch_secret) e no
// Netlify (PUSH_DISPATCH_SECRET).
function segredoConfere(recebido: string | null) {
  const esperado = process.env.PUSH_DISPATCH_SECRET;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!segredoConfere(request.headers.get("x-push-secret"))) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  let ids: string[] = [];
  try {
    const body = (await request.json()) as { ids?: unknown };
    if (Array.isArray(body.ids)) {
      ids = body.ids.filter((v): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v)).slice(0, 200);
    }
  } catch {
    // corpo vazio = varredura
  }

  try {
    const resultado = await dispatchPush(ids);
    return NextResponse.json(resultado);
  } catch (e) {
    console.error("[api.push.dispatch]", e);
    return NextResponse.json({ error: "falha no envio" }, { status: 500 });
  }
}
