import { redirect } from "next/navigation";
import { getCurrentProfile, isAdminRole } from "@/lib/services/profiles.service";
import { listAllAccounts } from "@/lib/services/accounts.service";
import { RoundAddLink } from "@/components/ui/RoundAddLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { BackLink } from "@/components/ui/BackLink";
import { AccountsGrouped } from "@/components/accounts/accounts-grouped";

export default async function ContasPage() {
  const profile = await getCurrentProfile();
  if (!isAdminRole(profile?.role)) redirect("/dashboard");

  const accounts = await listAllAccounts();

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/dashboard" label="Dashboard" />
      <PageHeader
        title="Contas"
        description="Todas as contas do sistema: redefina a senha, altere o e-mail, ative ou desative qualquer uma."
      >
        <RoundAddLink href="/contas/nova" label="Criar conta direta" />
      </PageHeader>
      <AccountsGrouped accounts={accounts} />
    </div>
  );
}
