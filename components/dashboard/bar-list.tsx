export function BarList({ items }: { items: { label: string; count: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem dados ainda.</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="min-w-0 truncate text-foreground">{item.label}</span>
            <span className="shrink-0 text-muted-foreground">{item.count}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#eadfd4] shadow-[inset_0_1px_2px_rgba(58,46,40,0.18)]">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,#1a8a10,#0d5b06)]" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
