import { redirect } from "next/navigation";
import { getCurrentProfile, isAdminRole } from "@/lib/services/profiles.service";
import { isLeaderRole, isHostRole, isPeopleManagerRole, adminShellPropsFor } from "@/lib/role-labels";
import { getMyAvatarSignedUrl } from "@/lib/services/avatar.service";
import { LiderShell } from "@/components/lider-shell";
import { AdminShell } from "@/components/admin-shell";

export default async function LiderLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");
  // A Gestora de Pessoas tem perfil de pastora, mas também lidera um café:
  // as telas do café dela continuam aqui, dentro do menu administrativo.
  if (profile.role === "gestora_de_pessoas") {
    const avatar = await getMyAvatarSignedUrl();
    return (
      <AdminShell userName={profile.full_name} avatarUrl={avatar} {...adminShellPropsFor(profile.role)}>
        {children}
      </AdminShell>
    );
  }
  if (isAdminRole(profile.role)) redirect("/dashboard");
  // Co-líder tem a mesma função da líder; anfitriã enxerga o café que
  // hospeda por aqui (só leitura) e a jornada dela fica em /minha-jornada.
  if (!isLeaderRole(profile.role) && !isHostRole(profile.role)) redirect("/minha-jornada");

  const avatarUrl = await getMyAvatarSignedUrl();

  return (
    <LiderShell
      userName={profile.full_name}
      avatarUrl={avatarUrl}
      canManageMembers={isPeopleManagerRole(profile.role)}
    >
      {children}
    </LiderShell>
  );
}
