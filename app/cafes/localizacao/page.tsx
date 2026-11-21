import { adminShellPropsFor } from "@/lib/role-labels";
import { redirect } from "next/navigation";
import { getCurrentProfile, isAdminRole } from "@/lib/services/profiles.service";
import { listGroups } from "@/lib/services/groups.service";
import { getMyLeaderContext } from "@/lib/services/leaders.service";
import { getMyAvatarSignedUrl } from "@/lib/services/avatar.service";
import { AdminShell } from "@/components/admin-shell";
import { LiderShell } from "@/components/lider-shell";
import { GroupsLocationView } from "@/components/grupos/groups-location-view";
import { PageHeader } from "@/components/ui/PageHeader";
import { BackLink } from "@/components/ui/BackLink";

// Rota fora dos route groups por papel — igual /meu-perfil, admin,
// desenvolvedor e líder acessam a mesma tela, então o Shell certo é
// escolhido aqui manualmente.
//
// Desde a policy `groups_lideranca_select`, a líder também enxerga todos os
// cafés aqui — é uma tela de consulta do ministério inteiro (para indicar
// outro café a quem mudou de bairro, ou visitar uma colega). Editar o ponto
// no mapa continua restrito ao café dela: quem decide isso é a tela de
// detalhe, e a RLS de UPDATE é a barreira real.
export default async function GruposLocalizacaoPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "participante") redirect("/minha-jornada");

  const [groups, avatarUrl, meuContexto] = await Promise.all([
    listGroups(),
    getMyAvatarSignedUrl(),
    getMyLeaderContext(),
  ]);

  const content = (
    <div className="flex flex-col gap-6">
      <BackLink href={isAdminRole(profile.role) ? "/dashboard" : "/inicio"} label={isAdminRole(profile.role) ? "Dashboard" : "Início"} />
      <PageHeader
        title="Localização dos Cafés"
        description={
          isAdminRole(profile.role)
            ? "Insira e consulte onde cada café acontece."
            : "Onde cada café do ministério acontece. Você edita o ponto do seu; os outros ficam para consulta."
        }
      />
      <GroupsLocationView groups={groups} myLeaderId={meuContexto?.leaderId ?? null} />
    </div>
  );

  if (isAdminRole(profile.role)) {
    return (
      <AdminShell
        userName={profile.full_name}
        {...adminShellPropsFor(profile.role)}
        avatarUrl={avatarUrl}
      >
        {content}
      </AdminShell>
    );
  }

  return (
    <LiderShell userName={profile.full_name} avatarUrl={avatarUrl}>
      {content}
    </LiderShell>
  );
}
