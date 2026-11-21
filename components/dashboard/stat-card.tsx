import Link from "next/link";
import { Card } from "@/components/ui/Card";

export function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href?: string;
}) {
  const corpo = (
    <Card className="min-w-0 p-3.5">
      <p className="font-display text-2xl font-semibold leading-none text-foreground">{value}</p>
      <p className="mt-2 break-words text-[10.5px] leading-tight text-muted-foreground">{label}</p>
    </Card>
  );
  if (!href) return corpo;
  return (
    <Link href={href} className="block rounded-3xl transition-transform active:scale-[0.98]">
      {corpo}
    </Link>
  );
}
