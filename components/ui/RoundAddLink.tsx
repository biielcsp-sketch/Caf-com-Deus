import Link from "next/link";
import { Plus } from "lucide-react";

// Botão "+" do cabeçalho das telas de lista: o mesmo botão padrão, só ícone.
export function RoundAddLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={label} title={label} className="btn btn-primary btn-icon shrink-0">
      <Plus size={18} strokeWidth={2.2} />
    </Link>
  );
}
