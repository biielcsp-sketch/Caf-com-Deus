"use client";

import { useState } from "react";
import Image from "next/image";
import {
  LayoutDashboard,
  Users,
  UserCog,
  Coffee,
  HeartHandshake,
  ShieldCheck,
  QrCode,
  BookOpen,
  ScrollText,
  BarChart3,
  Newspaper,
  FileText,
  Menu,
  X,
  LogOut,
  Images,
  UsersRound,
  Home,
  CalendarDays,
  History,
} from "lucide-react";
import { NavLink } from "@/components/nav-link";
import { NotificationBellIcon, NotificationsNavItem } from "@/components/notification-bell";
import { SidebarIdentity } from "@/components/ui/SidebarIdentity";
import { logout } from "@/app/actions/auth";

const NAV_ITEMS = [
  { href: "/feed", label: "Feed", icon: Newspaper },
  { href: "/mural", label: "Mural", icon: Images },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/participantes", label: "Participantes", icon: Users },
  { href: "/gestao-membros", label: "Gestão de Membros", icon: UsersRound },
  { href: "/liderancas", label: "Líderes", icon: UserCog },
  { href: "/cafes", label: "Cafés", icon: Coffee },
  { href: "/acompanhamentos", label: "Acompanhamentos", icon: HeartHandshake },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/biblia", label: "Bíblia", icon: BookOpen },
  { href: "/estudos", label: "Estudo do mês", icon: FileText },
  { href: "/configuracoes/qrcodes", label: "QR Codes", icon: QrCode },
  { href: "/configuracoes/regras", label: "Regras do café", icon: ScrollText },
];

// Contas (redefinir senha, trocar e-mail, ativar/desativar) era exclusiva
// do perfil Desenvolvedor. Passou a valer também para a pastora: é ela quem
// cadastra as líderes e quem recebe o "esqueci minha senha" — depender de
// outra pessoa para isso travava o ministério. No banco os dois papéis já
// eram equivalentes (app_is_admin() cobre admin e desenvolvedor), então
// isto não abre nenhum poder novo, só a porta da tela.
const ACCOUNTS_NAV_ITEM = { href: "/contas", label: "Contas", icon: ShieldCheck };

// A Gestora de Pessoas tem o mesmo perfil da pastora (decisão de 17/10/2026)
// e, no caso da Franciele, também lidera um café. As telas do café dela são
// as mesmas da líder; ficam num bloco à parte do menu.
const MY_CAFE_NAV_ITEMS = [
  { href: "/inicio", label: "Início do meu café", icon: Home },
  { href: "/minhas-participantes", label: "Minhas participantes", icon: Users },
  { href: "/meus-encontros", label: "Meus encontros", icon: CalendarDays },
  { href: "/meus-acompanhamentos", label: "Meus acompanhamentos", icon: HeartHandshake },
  { href: "/historico", label: "Histórico do café", icon: History },
];

function MyCafeSection({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <p className="mt-4 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Meu café</p>
      {MY_CAFE_NAV_ITEMS.map((item) => (
        <NavLink key={item.href} {...item} onNavigate={onNavigate} />
      ))}
    </>
  );
}

export function AdminShell({
  userName,
  isDeveloper = false,
  avatarUrl,
  roleLabel,
  showMyCafe = false,
  children,
}: {
  userName: string;
  isDeveloper?: boolean;
  avatarUrl?: string | null;
  roleLabel?: string;
  showMyCafe?: boolean;
  children: React.ReactNode;
}) {
  const label = roleLabel ?? (isDeveloper ? "Desenvolvedor" : undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  // O AdminShell só é renderizado para admin e desenvolvedor, então a aba
  // vale para todo mundo que chega aqui.
  const navItems = [...NAV_ITEMS, ACCOUNTS_NAV_ITEM];

  return (
    <div className="flex min-h-screen flex-1">
      {/* Sidebar — desktop */}
      <aside className="glass-panel m-3 hidden w-64 shrink-0 flex-col rounded-[2rem] px-4 py-6 md:flex">
        <div className="mb-6 flex justify-center px-2">
          <Image src="/icons/logo-header.png" alt="Café com Deus Shine" width={1600} height={1011} className="h-14 w-auto" />
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          <NotificationsNavItem />
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
          {showMyCafe && <MyCafeSection />}
        </nav>
        <div className="mt-4 border-t border-border pt-4">
          <SidebarIdentity
            userName={userName}
            avatarUrl={avatarUrl}
            roleLabel={label}
          />
          <form action={logout}>
            <button
              type="submit"
              className="mt-2 flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              <LogOut size={18} />
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Drawer — mobile */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            aria-label="Fechar menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="glass-bar absolute left-0 top-0 flex h-full w-72 flex-col rounded-r-[2rem] px-4 py-6">
            <div className="mb-6 flex items-center justify-between px-2">
              <Image src="/icons/logo-header.png" alt="Café com Deus Shine" width={1600} height={1011} className="mx-auto h-12 w-auto" />
              <button aria-label="Fechar menu" onClick={() => setMenuOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1">
              <NotificationsNavItem onNavigate={() => setMenuOpen(false)} />
              {navItems.map((item) => (
                <NavLink key={item.href} {...item} onNavigate={() => setMenuOpen(false)} />
              ))}
              {showMyCafe && <MyCafeSection onNavigate={() => setMenuOpen(false)} />}
            </nav>
            <div className="mt-4 border-t border-border pt-4">
              <SidebarIdentity
                userName={userName}
                avatarUrl={avatarUrl}
                roleLabel={label}
                onNavigate={() => setMenuOpen(false)}
              />
              <form action={logout}>
                <button
                  type="submit"
                  className="mt-2 flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  <LogOut size={18} />
                  Sair
                </button>
              </form>
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — mobile */}
        <header className="glass-bar relative mx-3 mt-3 flex items-center rounded-full px-5 py-2 md:hidden">
          <button aria-label="Abrir menu" onClick={() => setMenuOpen(true)} className="relative z-10">
            <Menu size={22} />
          </button>
          <Image
            src="/icons/logo-header-mobile.png"
            alt="Café com Deus Shine"
            width={1600}
            height={1011}
            className="absolute left-1/2 h-12 w-auto -translate-x-1/2"
            priority
          />
          <div className="ml-auto">
            <NotificationBellIcon />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
