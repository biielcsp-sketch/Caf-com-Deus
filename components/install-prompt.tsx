"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X, Download, Share, SquarePlus, EllipsisVertical } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "android" | "ios";

const DISMISSED_KEY = "ccd-install-dismissed-at";
const SNOOZE_DAYS = 7;
const SHOW_DELAY_MS = 3000;

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* navegador sem storage: segue sem lembrar */
  }
}

function recentlyDismissed(): boolean {
  const raw = safeGet(DISMISSED_KEY);
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at)) return false;
  return Date.now() - at < SNOOZE_DAYS * 24 * 60 * 60 * 1000;
}

function detectPlatform(): Platform | null {
  const ua = navigator.userAgent;
  const isIPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iphone|ipad|ipod/i.test(ua) || isIPadOS) return "ios";
  if (/android/i.test(ua)) return "android";
  return null; // desktop: não mostra
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

export function InstallPrompt() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    const detected = detectPlatform();
    if (!detected || isStandalone() || recentlyDismissed()) return;

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setVisible(false);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    // Espera a splash passar; no Android o evento nativo costuma chegar nesse intervalo.
    const timer = window.setTimeout(() => {
      setPlatform(detected);
      setVisible(true);
    }, SHOW_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (!visible || !platform) return null;

  function handleDismiss() {
    safeSet(DISMISSED_KEY, String(Date.now()));
    setShowSteps(false);
    setVisible(false);
  }

  async function handleInstall() {
    // Android com instalação em 1 toque
    if (platform === "android" && deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        await deferredPrompt.userChoice;
      } finally {
        setDeferredPrompt(null);
        setVisible(false);
      }
      return;
    }
    // iPhone, ou Android sem o prompt nativo: mostra o passo a passo
    setShowSteps(true);
  }

  return (
    <>
      {!showSteps && (
        <div
          role="dialog"
          aria-label="Instalar o aplicativo"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-2xl border border-border bg-card p-4 shadow-lg"
        >
          <button
            onClick={handleDismiss}
            aria-label="Fechar"
            className="absolute right-3 top-3 text-muted-foreground"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-3 pr-6">
            <Image
              src="/icons/icon-192.png"
              alt="Café com Deus"
              width={48}
              height={48}
              className="rounded-xl"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Instalar Café com Deus</p>
              <p className="text-xs text-muted-foreground">
                Adicione à tela inicial para abrir rápido, como um app.
              </p>
            </div>
          </div>
          <button
            onClick={handleInstall}
            className="btn btn-primary mt-3 w-full"
          >
            <Download size={16} />
            Instalar app
          </button>
        </div>
      )}

      {showSteps && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={handleDismiss}
        >
          <div
            role="dialog"
            aria-label="Como instalar o aplicativo"
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-foreground">Adicionar à tela inicial</h2>
            {platform === "ios" ? (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  No iPhone, siga estes passos no Safari:
                </p>
                <ol className="mt-3 space-y-3 text-sm text-foreground">
                  <li className="flex items-start gap-2">
                    <Share size={18} className="mt-0.5 shrink-0 text-primary" />
                    <span>
                      Toque em <b>Compartilhar</b> (o quadrado com a seta ↑) na barra do Safari.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <SquarePlus size={18} className="mt-0.5 shrink-0 text-primary" />
                    <span>
                      Role a lista e toque em <b>&quot;Adicionar à Tela de Início&quot;</b>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Download size={18} className="mt-0.5 shrink-0 text-primary" />
                    <span>
                      Toque em <b>Adicionar</b> e abra o app pelo ícone que aparecer.
                    </span>
                  </li>
                </ol>
                <p className="mt-3 text-xs text-muted-foreground">
                  Se não aparecer a opção, abra este endereço direto no Safari (não dentro de outro app).
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted-foreground">Para instalar o app no Android:</p>
                <ol className="mt-3 space-y-3 text-sm text-foreground">
                  <li className="flex items-start gap-2">
                    <EllipsisVertical size={18} className="mt-0.5 shrink-0 text-primary" />
                    <span>
                      Toque no menu do navegador (<b>três pontinhos ⋮</b>, no canto superior).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <SquarePlus size={18} className="mt-0.5 shrink-0 text-primary" />
                    <span>
                      Toque em <b>&quot;Instalar app&quot;</b> ou <b>&quot;Adicionar à tela inicial&quot;</b>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Download size={18} className="mt-0.5 shrink-0 text-primary" />
                    <span>Confirme. O ícone aparece na sua tela inicial.</span>
                  </li>
                </ol>
              </>
            )}
            <button
              onClick={handleDismiss}
              className="btn btn-primary mt-4 w-full"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
