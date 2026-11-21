import { listLeaders } from "@/lib/services/leaders.service";
import { LeadersList } from "@/components/liderancas/leaders-list";
import { RoundAddLink } from "@/components/ui/RoundAddLink";
import { SecaoRetratil } from "@/components/ui/SecaoRetratil";
import { PageHeader } from "@/components/ui/PageHeader";
import { BackLink } from "@/components/ui/BackLink";

export default async function LiderancasPage() {
  const leaders = await listLeaders();

  return (
    <div>
      <BackLink href="/dashboard" label="Dashboard" />
      <PageHeader title="Líderes">
        <RoundAddLink href="/liderancas/nova" label="Nova líder" />
      </PageHeader>
      <div className="mt-4">
        <SecaoRetratil titulo="Líderes" contador={leaders.length}>
          <LeadersList leaders={leaders} />
        </SecaoRetratil>
      </div>
    </div>
  );
}
