"use client";

import { useState } from "react";
import Image from "next/image";
import { Sparkles, BookOpen, Newspaper, Images, X, LogOut } from "lucide-react";
import { NavLink } from "@/components/nav-link";
import { BottomNav } from "@/components/bottom-nav";
import { SidebarIdentity } from "@/components/ui/SidebarIdentity";
import { logout } from "@/app/actions/auth";

const NAV_ITEMS = [
  { href: "/feed", label: "Feed", icon: Newspaper },
  { href: "/mural", label: "Mural", icon: Images },
  { href: "/minha-jornada", label: "Minha Jornada", icon: Sparkles },
  { href: "/biblia", label: "Bíblia", icon: BookOpen },
];

export function ParticipanteShell({
  userName,
  avatarUrl,
  children,
}: {
  userName: string;
  avatarUrl?: string | null;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-1">
      {/* Sidebar — desktop */}
      <aside className="glass-panel m-3 hidden w-64 shrink-0 flex-col rounded-[2rem] px-4 py-6 md:flex">
        <div className="mb-6 flex justify-center px-2">
          <Image src="/icons/logo-header.png" alt="Café com Deus Shine" width={1600} height={1011} className="h-14 w-auto" />
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
        <div className="mt-4 border-t border-border pt-4">
          <SidebarIdentity userName={userName} avatarUrl={avatarUrl} />
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
            <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.href} {...item} onNavigate={() => setMenuOpen(false)} />
              ))}
            </nav>
            <div className="mt-4 shrink-0 border-t border-border pt-4">
              <SidebarIdentity userName={userName} avatarUrl={avatarUrl} onNavigate={() => setMenuOpen(false)} />
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
        <header className="relative mx-4 mt-3 flex h-12 items-center md:hidden">
          <Image
            src="/icons/logo-header-mobile.png"
            alt="Café com Deus Shine"
            width={1600}
            height={1011}
            className="absolute left-1/2 h-11 w-auto -translate-x-1/2"
            priority
          />
        </header>

        <main className="flex-1 p-4 pb-28 md:p-8">{children}</main>

        <BottomNav
          // Feed no botão verde do centro (3º lugar); Minha Jornada vai para o 1º, com
          // rótulo curto para caber numa linha só (no menu lateral segue por extenso).
          items={[{ ...NAV_ITEMS[2], label: "Jornada" }, NAV_ITEMS[1], NAV_ITEMS[0], NAV_ITEMS[3]]}
          onMenu={() => setMenuOpen(true)}
        />
      </div>
    </div>
  );
}
