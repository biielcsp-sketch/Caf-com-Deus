import Link from "next/link";
import { ClipboardList, Shuffle, ChevronRight, UsersRound, GitBranch } from "lucide-react";
import { getMemberManagementCounts } from "@/lib/services/member-management.service";
import { listPendingContacts } from "@/lib/services/contact-alerts.service";
import { PendingContactsCard } from "@/components/acompanhamento/pending-contacts-card";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function GestaoMembrosPage() {
  const [counts, semContato] = await Promise.all([
    getMemberManagementCounts(),
    listPendingContacts({ somenteAtrasados: true }).catch(() => []),
  ]);

  const sections = [
    {
      href: "/gestao-membros/novas-inscricoes",
      icon: ClipboardList,
      title: "Novas inscrições e distribuição",
      description:
        "Aprovar e distribuir quem acabou de se inscrever, e tratar as devolvidas por líderes.",
      count: (counts.novasInscricoes + counts.aguardandoDistribuicao) as number | null,
      countLabel: `para tratar (${counts.novasInscricoes} novas, ${counts.aguardandoDistribuicao} na fila)`,
    },
    {
      href: "/gestao-membros/integradas",
      icon: UsersRound,
      title: "Participantes Integradas",
      description: "Quem já está nos cafés, com os dados de cada uma, da líder e do café.",
      count: counts.integradas as number | null,
      countLabel: "nos cafés",
    },
    {
      href: "/gestao-membros/redistribuicao",
      icon: Shuffle,
      title: "Redistribuição",
      description: "Trocar uma participante de líder e de café, mantendo o histórico.",
      count: null,
      countLabel: "",
    },
    {
      href: "/gestao-membros/multiplicacao",
      icon: GitBranch,
      title: "Multiplicar café",
      description: "Elevar uma participante a líder de um café novo e transferir as que vão junto.",
      count: null,
      countLabel: "",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Gestão de Membros"
        description="Distribuição e redistribuição"
      />

      <PendingContactsCard contacts={semContato} mode="gestao" />

      <div className="flex flex-col gap-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="glass-panel flex min-h-16 items-center gap-3 rounded-3xl px-5 py-3"
          >
            <s.icon size={22} className="shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground">
              {s.title}
            </span>
            {s.count !== null && (
              <span className="font-display shrink-0 text-xl font-semibold text-primary">{s.count}</span>
            )}
            <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
