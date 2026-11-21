"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, type LucideIcon } from "lucide-react";

type BottomNavItem = { href: string; label: string; icon: LucideIcon };

// Barra inferior flutuante (celular). O item do meio fica elevado, como
// no novo design; o último botão abre o menu lateral com o resto.
export function BottomNav({
  items,
  onMenu,
}: {
  items: [BottomNavItem, BottomNavItem, BottomNavItem, BottomNavItem];
  onMenu: () => void;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Navegação principal"
      className="glass-bar fixed inset-x-3 bottom-3 z-30 flex items-end justify-between rounded-full px-3 pb-2 pt-2 md:hidden"
    >
      {items.map((item, index) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        const center = index === 2;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="flex flex-1 flex-col items-center gap-1 text-[11px] font-medium"
          >
            <span
              className={
                center
                  ? "glass-green -mt-7 flex h-14 w-14 items-center justify-center rounded-full"
                  : `flex h-9 w-9 items-center justify-center rounded-full ${active ? "text-primary" : "text-muted-foreground"}`
              }
            >
              <Icon size={center ? 24 : 21} strokeWidth={active || center ? 2.4 : 2} />
            </span>
            <span className={active ? "text-primary" : "text-muted-foreground"}>{item.label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onMenu}
        className="flex flex-1 flex-col items-center gap-1 bg-transparent text-[11px] font-medium text-muted-foreground"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full">
          <Menu size={21} />
        </span>
        Menu
      </button>
    </nav>
  );
}
