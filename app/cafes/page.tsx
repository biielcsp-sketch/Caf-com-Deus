import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentProfile, isAdminRole } from "@/lib/services/profiles.service";
import { listGroups } from "@/lib/services/groups.service";
import { listMeetings } from "@/lib/services/meetings.service";
import { listActiveLeadersForSelect, listGroupsForSelect } from "@/lib/services/participants.service";
import { getMyAvatarSignedUrl } from "@/lib/services/avatar.service";
import { getMultiplicationTree } from "@/lib/services/multiplication.service";
import { isPeopleManagerRole, adminShellPropsFor } from "@/lib/role-labels";
import { AdminShell } from "@/components/admin-shell";
import { CafesTabs } from "@/components/grupos/cafes-tabs";
import { PageHeader } from "@/components/ui/PageHeader";
import { BackLink } from "@/components/ui/BackLink";

// Rota fora dos route groups por papel, como /meu-perfil e
// /cafes/localizacao — só admin/desenvolvedor usam esta tela (a líder
// continua com o link direto "Localização" no próprio menu, sem Grupos
// e Encontros administrativos).
export default async function CafesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!isAdminRole(profile.role)) redirect(profile.role === "participante" ? "/minha-jornada" : "/inicio");

  const [groups, meetings, leaders, groupsForSelect, avatarUrl, tree] = await Promise.all([
    listGroups(),
    listMeetings(),
    listActiveLeadersForSelect(),
    listGroupsForSelect(),
    getMyAvatarSignedUrl(),
    getMultiplicationTree(),
  ]);

  return (
    <AdminShell
      userName={profile.full_name}
      {...adminShellPropsFor(profile.role)}
      avatarUrl={avatarUrl}
    >
      <div className="flex flex-col gap-6">
        <BackLink href="/dashboard" label="Dashboard" />
        <PageHeader title="Cafés" description="Grupos, encontros, localização e a árvore de multiplicação em um só lugar." />
        <Suspense>
          <CafesTabs
            groups={groups}
            meetings={meetings}
            leaders={leaders}
            groupsForSelect={groupsForSelect}
            tree={tree}
            canEditTree={isPeopleManagerRole(profile.role)}
          />
        </Suspense>
      </div>
    </AdminShell>
  );
}
