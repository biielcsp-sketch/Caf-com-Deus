import Link from "next/link";
import { ClipboardList, Shuffle, ChevronRight, UsersRound, GitBranch } from "lucide-react";
import { getMemberManagementCounts } from "@/lib/services/member-management.service";
import { listPendingContacts } from "@/lib/services/contact-alerts.service";
import { PendingContactsCard } from "@/components/acompanhamento/pending-contacts-card";
import { Card } from "@/components/ui/Card";
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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Gestão de Membros"
        description="Distribuição das novas participantes e redistribuição das membras."
      />

      <PendingContactsCard contacts={semContato} mode="gestao" />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} className="block">
            <Card className="flex h-full flex-col gap-3 p-5 hover:bg-muted">
              <div className="flex items-center justify-between">
                <s.icon size={22} className="text-primary" />
                <ChevronRight size={18} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{s.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
              </div>
              {s.count !== null && (
                <p className="mt-auto text-sm text-foreground">
                  <span className="text-2xl font-semibold">{s.count}</span>{" "}
                  <span className="text-xs text-muted-foreground">{s.countLabel}</span>
                </p>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
