import { getCafeRules } from "@/lib/services/cafe-rules.service";
import { SecaoRetratil } from "@/components/ui/SecaoRetratil";
import { CafeRulesForm } from "@/components/configuracoes/cafe-rules-form";
import { PageHeader } from "@/components/ui/PageHeader";
import { BackLink } from "@/components/ui/BackLink";

export default async function RegrasDoCafePage() {
  const rules = await getCafeRules();

  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/dashboard" label="Dashboard" />
      <PageHeader
        title="Regras do café"
        description="O combinado que toda participante lê ao se inscrever."
      />
      <SecaoRetratil titulo="Texto das regras" abertoPorPadrao>
        <CafeRulesForm initialText={rules} />
      </SecaoRetratil>
    </div>
  );
}
