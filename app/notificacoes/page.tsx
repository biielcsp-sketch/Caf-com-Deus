import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/services/profiles.service";
import { getMyAvatarSignedUrl } from "@/lib/services/avatar.service";
import { listMyNotifications } from "@/lib/services/notifications.service";
import { getVapidPublicKey } from "@/lib/services/push.service";
import { PushOptIn } from "@/components/push-opt-in";
import { markAllNotificationsReadAction } from "@/app/actions/notifications";
import { RoleShell, homePathFor } from "@/components/role-shell";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { SecaoRetratil } from "@/components/ui/SecaoRetratil";

function quando(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Mesma rota para todos os papéis (como /meu-perfil): o Shell vem do papel.
export default async function NotificacoesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [avatarUrl, itens] = await Promise.all([getMyAvatarSignedUrl(), listMyNotifications()]);
  const home = homePathFor(profile.role);
  const naoLidas = itens.filter((n) => !n.read).length;

  return (
    <RoleShell profile={profile} avatarUrl={avatarUrl}>
      <div className="flex flex-col gap-4">
        <BackLink href={home.href} label={home.label} />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-foreground">Notificações</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {naoLidas > 0 ? `${naoLidas} não lida(s).` : "Tudo lido."}
            </p>
          </div>
          {naoLidas > 0 && (
            <form action={markAllNotificationsReadAction}>
              <button
                type="submit"
                className="btn btn-secondary"
              >
                Marcar todas como lidas
              </button>
            </form>
          )}
        </div>

        <PushOptIn publicKey={getVapidPublicKey()} />

        {itens.length === 0 && (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Nenhuma notificação por enquanto.</p>
          </Card>
        )}

        {itens.length > 0 && (
        <SecaoRetratil titulo="Notificações" contador={itens.length} abertoPorPadrao={naoLidas > 0}>
        <ul className="flex flex-col gap-2">
          {itens.map((n) => {
            const conteudo = (
              <div
                className={`rounded-xl border p-4 ${
                  n.read ? "border-border bg-card" : "border-primary/40 bg-primary/5"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">{quando(n.created_at)}</span>
                </div>
                {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
              </div>
            );
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link href={n.link} className="block hover:opacity-90">
                    {conteudo}
                  </Link>
                ) : (
                  conteudo
                )}
              </li>
            );
          })}
        </ul>
        </SecaoRetratil>
        )}
      </div>
    </RoleShell>
  );
}
