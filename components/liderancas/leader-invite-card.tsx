"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";

// Link de inscrição da líder. Qualquer pessoa com o link pode se inscrever —
// membra do café dela ou nova — e já entra direto no café dela.
export function LeaderInviteCard({
  code,
  groupName,
}: {
  code: string;
  groupName: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const path = `/cadastro?origem=${code}`;

  function fullUrl() {
    return `${window.location.origin}${path}`;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Sem permissão da área de transferência: o botão do WhatsApp segue valendo.
    }
  }

  function shareOnWhatsApp() {
    const text = `Oi! Se inscreva no Café com Deus Shine${groupName ? ` (${groupName})` : ""} por este link: ${fullUrl()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <p className="text-sm font-semibold text-foreground">Seu link de inscrição</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Envie para as mulheres do seu café e para quem quiser participar. Quem se inscrever por
          ele entra direto no seu café{groupName ? ` (${groupName})` : ""}.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- gerado dinamicamente pelo Route Handler */}
        <img
          src={`/api/qrcodes/${code}`}
          alt="QR Code do seu link de inscrição"
          width={176}
          height={176}
          className="rounded-lg border border-border bg-white p-3"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {copied ? "Link copiado!" : "Copiar link"}
        </button>
        <button
          type="button"
          onClick={shareOnWhatsApp}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Enviar pelo WhatsApp
        </button>
      </div>
    </Card>
  );
}
