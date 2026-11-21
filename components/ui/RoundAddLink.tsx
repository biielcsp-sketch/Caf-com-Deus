import Link from "next/link";
import { Plus } from "lucide-react";

// Botão "+" redondo do cabeçalho das telas de lista (como na prévia).
export function RoundAddLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="glass-green flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
    >
      <Plus size={22} strokeWidth={2.2} />
    </Link>
  );
}
