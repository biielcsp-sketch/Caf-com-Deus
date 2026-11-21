"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { getUnreadNotificationsCountAction, openNotificationsPanelAction } from "@/app/actions/notifications";

// Sino dos menus. Tocar abre um painel com as últimas notificações e o link
// "Ver todas" para a tela completa. O número de não lidas é buscado a cada
// troca de tela — nenhum layout precisa carregar isso no servidor.

type Item = Awaited<ReturnType<typeof openNotificationsPanelAction>>["itens"][number];

function quando(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 1) return "agora";
  if (diff < 60) return `há ${Math.floor(diff)} min`;
  if (diff < 60 * 24) return `há ${Math.floor(diff / 60)} h`;
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
}

function useNotifications() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [itens, setItens] = useState<Item[] | null>(null);

  useEffect(() => {
    let vivo = true;
    getUnreadNotificationsCountAction().then((n) => vivo && setCount(n));
    return () => {
      vivo = false;
    };
  }, [pathname]);

  // Fecha o painel ao trocar de tela.
  const ultimoPath = useRef(pathname);
  useEffect(() => {
    if (ultimoPath.current !== pathname) {
      ultimoPath.current = pathname;
      setOpen(false);
    }
  }, [pathname]);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setItens(null);
    const r = await openNotificationsPanelAction();
    setItens(r.itens);
    setCount(0);
  }

  return { count, open, setOpen, itens, toggle };
}

function Badge({ count, small }: { count: number; small?: boolean }) {
  if (count <= 0) return null;
  return small ? (
    <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-semibold leading-4 text-white">
      {count > 9 ? "9+" : count}
    </span>
  ) : (
    <span className="min-w-5 rounded-full bg-danger px-1.5 text-center text-[11px] font-semibold leading-5 text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function Panel({
  itens,
  onClose,
  className,
}: {
  itens: Item[] | null;
  onClose: () => void;
  className: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    // Espera o clique que abriu terminar antes de ouvir cliques "fora".
    const t = setTimeout(() => document.addEventListener("mousedown", fora), 0);
    window.addEventListener("keydown", esc);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", fora);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  return (
    <div ref={ref} className={`z-50 flex flex-col rounded-2xl border border-border bg-background shadow-xl ${className}`}>
      <p className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">Notificações</p>
      <div className="max-h-[60vh] overflow-y-auto">
        {itens === null && <p className="px-4 py-4 text-sm text-muted-foreground">Carregando...</p>}
        {itens?.length === 0 && <p className="px-4 py-4 text-sm text-muted-foreground">Nenhuma notificação por enquanto.</p>}
        {itens?.map((n) => {
          const conteudo = (
            <div className={`border-b border-border/60 px-4 py-3 last:border-0 ${n.read ? "" : "bg-primary/5"}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-foreground">
                  {!n.read && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-primary align-middle" />}
                  {n.title}
                </p>
                <span className="shrink-0 text-[11px] text-muted-foreground">{quando(n.created_at)}</span>
              </div>
              {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
            </div>
          );
          return n.link ? (
            <Link key={n.id} href={n.link} onClick={onClose} className="block hover:bg-muted">
              {conteudo}
            </Link>
          ) : (
            <div key={n.id}>{conteudo}</div>
          );
        })}
      </div>
      <Link
        href="/notificacoes"
        onClick={onClose}
        className="border-t border-border px-4 py-3 text-center text-sm font-medium text-primary hover:bg-muted"
      >
        Ver todas
      </Link>
    </div>
  );
}

// Item do menu lateral, no mesmo formato do NavLink. O painel abre ao lado.
export function NotificationsNavItem({ onNavigate }: { onNavigate?: () => void }) {
  const { count, open, setOpen, itens, toggle } = useNotifications();
  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        <Bell size={18} />
        <span className="flex-1 text-left">Notificações</span>
        <Badge count={count} />
      </button>
      {open && (
        <Panel
          itens={itens}
          onClose={() => {
            setOpen(false);
            onNavigate?.();
          }}
          className="absolute left-0 top-full mt-1 w-[min(22rem,calc(100vw-2rem))] md:left-full md:top-0 md:ml-2 md:mt-0"
        />
      )}
    </div>
  );
}

// Ícone da barra do topo no celular.
export function NotificationBellIcon() {
  const { count, open, setOpen, itens, toggle } = useNotifications();
  return (
    <div className="relative z-10">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={`Notificações${count ? ` (${count} novas)` : ""}`}
        className="relative block"
      >
        <Bell size={22} />
        <Badge count={count} small />
      </button>
      {open && (
        <Panel itens={itens} onClose={() => setOpen(false)} className="fixed left-4 right-4 top-[4.75rem]" />
      )}
    </div>
  );
}
