import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/services/profiles.service";
import { getMyAvatarSignedUrl } from "@/lib/services/avatar.service";
import { isPeopleManagerRole } from "@/lib/role-labels";
import { RoleShell } from "@/components/role-shell";

// Rota fora dos route groups por papel (como /cafes e /estudos): pastora,
// desenvolvedor e Gestora de Pessoas usam as mesmas telas, cada uma dentro do
// menu do seu papel. Esta checagem é só a porta da tela — a barreira real é
// app_is_people_manager() nas policies do banco.
export default async function GestaoMembrosLayout({ children }: { children: ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!isPeopleManagerRole(profile.role)) {
    redirect(profile.role === "participante" ? "/minha-jornada" : "/inicio");
  }

  const avatarUrl = await getMyAvatarSignedUrl();

  return (
    <RoleShell profile={profile} avatarUrl={avatarUrl}>
      {children}
    </RoleShell>
  );
}
