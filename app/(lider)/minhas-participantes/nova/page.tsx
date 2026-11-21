import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { BackLink } from "@/components/ui/BackLink";
import { getCurrentProfile } from "@/lib/services/profiles.service";
import { getMyLeaderContext } from "@/lib/services/leaders.service";
import { isLeaderRole } from "@/lib/role-labels";
import { LeaderParticipantCreateForm } from "@/components/participantes/leader-participant-create-form";

export default async function NovaParticipanteLiderPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!isLeaderRole(profile.role)) redirect("/feed");

  const contexto = await getMyLeaderContext();

  return (
    <div>
      <BackLink href="/minhas-participantes" label="Minhas participantes" />
      <h1 className="mt-3 text-2xl font-semibold text-foreground">Nova participante</h1>

      <Card className="mt-4 p-6">
        {contexto ? (
          <LeaderParticipantCreateForm groupName={contexto.groupName} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Seu cadastro de líder ainda não está completo, então não dá para cadastrar
            participante por aqui. Fale com a pastora.
          </p>
        )}
      </Card>
    </div>
  );
}
