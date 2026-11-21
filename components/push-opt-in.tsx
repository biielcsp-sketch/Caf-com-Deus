"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { removePushSubscriptionAction, savePushSubscriptionAction } from "@/app/actions/push";

type Estado = "carregando" | "sem-suporte" | "ios-instalar" | "negado" | "desligado" | "ligado";

function base64ToUint8(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// Liga e desliga o push neste aparelho. Cada aparelho se inscreve por conta
// própria: ligar no celular não liga no computador.
// `somenteConvite`: nos dashboards, aparece só enquanto não está ligado neste
// aparelho (e some quando não há nada a fazer).
export function PushOptIn({ publicKey, somenteConvite = false }: { publicKey: string | null; somenteConvite?: boolean }) {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const suporta = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      let novo: Estado;
      if (!suporta) {
        // No iPhone o push só existe com o app instalado na tela de início.
        novo = isIos() && !isStandalone() ? "ios-instalar" : "sem-suporte";
      } else if (Notification.permission === "denied") {
        novo = "negado";
      } else {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        novo = sub ? "ligado" : "desligado";
      }
      if (vivo) setEstado(novo);
    })().catch(() => vivo && setEstado("sem-suporte"));
    return () => {
      vivo = false;
    };
  }, []);

  if (!publicKey || estado === "carregando") return null;
  if (somenteConvite && estado !== "desligado" && estado !== "ios-instalar") return null;

  async function ligar() {
    setErro(null);
    setOcupado(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setEstado(permissao === "denied" ? "negado" : "desligado");
        return;
      }
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToUint8(publicKey!) }));
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("inscrição incompleta");
      const r = await savePushSubscriptionAction({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: navigator.userAgent,
      });
      if (r.error) throw new Error(r.error);
      setEstado("ligado");
    } catch (e) {
      setErro((e as Error).message || "Não foi possível ativar.");
    } finally {
      setOcupado(false);
    }
  }

  async function desligar() {
    setErro(null);
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setEstado("desligado");
    } finally {
      setOcupado(false);
    }
  }

  const textos: Record<Exclude<Estado, "carregando">, string> = {
    "sem-suporte": "Este navegador não recebe notificações no aparelho. Os avisos continuam aqui no app.",
    "ios-instalar":
      "No iPhone, as notificações só chegam com o app instalado: toque em Compartilhar → “Adicionar à Tela de Início”, abra o app por lá e volte aqui.",
    negado:
      "As notificações estão bloqueadas para este site. Libere nas configurações do navegador (permissões do site) e volte aqui.",
    desligado: "Receba no celular os avisos de nova participante e de contato pendente, mesmo com o app fechado.",
    ligado: "Notificações ligadas neste aparelho.",
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <BellRing size={20} className="mt-0.5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold text-foreground">Notificações no celular</p>
          <p className="text-xs text-muted-foreground">{textos[estado]}</p>
          {erro && <p className="mt-1 text-xs text-danger">{erro}</p>}
        </div>
      </div>
      {estado === "desligado" && (
        <button
          type="button"
          onClick={ligar}
          disabled={ocupado}
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {ocupado ? "Ativando..." : "Ativar neste aparelho"}
        </button>
      )}
      {estado === "ligado" && (
        <button
          type="button"
          onClick={desligar}
          disabled={ocupado}
          className="shrink-0 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
        >
          {ocupado ? "..." : "Desativar"}
        </button>
      )}
    </section>
  );
}
