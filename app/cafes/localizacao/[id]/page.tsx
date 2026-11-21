import { adminShellPropsFor } from "@/lib/role-labels";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile, isAdminRole } from "@/lib/services/profiles.service";
import { getGroup } from "@/lib/services/groups.service";
import { getMyLeaderContext } from "@/lib/services/leaders.service";
import { getMyAvatarSignedUrl } from "@/lib/services/avatar.service";
import { AdminShell } from "@/components/admin-shell";
import { LiderShell } from "@/components/lider-shell";
import { GroupLocationEditor } from "@/components/grupos/group-location-editor-loader";
import { PageHeader } from "@/components/ui/PageHeader";
import { BackLink } from "@/components/ui/BackLink";

export default async function GrupoLocalizacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "participante") redirect("/minha-jornada");

  const { id } = await params;
  const [group, avatarUrl, meuContexto] = await Promise.all([
    getGroup(id),
    getMyAvatarSignedUrl(),
    getMyLeaderContext(),
  ]);
  if (!group) notFound();

  // A liderança enxerga todos os cafés, mas só edita o próprio. Sem isto a
  // tela ofereceria "Salvar localização" no café de outra líder, e o clique
  // morreria na RLS.
  const podeEditar = isAdminRole(profile.role) || group.leader_id === meuContexto?.leaderId;

  const content = (
    <div className="flex flex-col gap-6">
      <BackLink href="/cafes/localizacao" label="Localização" />
      <PageHeader
        title={group.name}
        description={podeEditar ? "Defina onde este café se encontra." : "Onde este café acontece."}
      />
      <GroupLocationEditor
        groupId={group.id}
        initialLatitude={group.latitude}
        initialLongitude={group.longitude}
        address={[group.address, group.region].filter(Boolean).join(", ")}
        editAddressHref={isAdminRole(profile.role) ? `/grupos/${group.id}` : undefined}
        readOnly={!podeEditar}
      />
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
