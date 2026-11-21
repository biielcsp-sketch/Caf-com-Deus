import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { BackLink } from "@/components/ui/BackLink";
import { getGroup } from "@/lib/services/groups.service";
import { listHostsForSelect } from "@/lib/services/leaders.service";
import { listActiveLeadersForSelect, listParticipants } from "@/lib/services/participants.service";
import { GroupForm } from "@/components/grupos/group-form";
import { GroupDeleteButton } from "@/components/grupos/group-delete-button";
import { ParticipantsTable } from "@/components/participantes/participants-table";

export default async function GrupoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [group, leaders, participants, hosts] = await Promise.all([
    getGroup(id),
    listActiveLeadersForSelect(),
    listParticipants({ groupId: id }),
    listHostsForSelect(),
  ]);
  if (!group) notFound();

  return (
    <div>
      <BackLink href="/cafes?tab=grupos" label="Cafés" />
      <div className="mt-3 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground">{group.name}</h1>
        <GroupDeleteButton id={group.id} nome={group.name} redirectTo="/cafes?tab=grupos" />
      </div>

      {group.leader_id === null && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
          <div className="text-sm text-foreground">
            <p className="font-medium text-danger">Este café está sem líder responsável.</p>
            <p className="mt-1 text-muted-foreground">
              As participantes, os encontros e as fotos continuam aqui. O que fica parado é o que
              depende de uma responsável: ele não recebe participantes na distribuição automática e
              não dá para agendar encontro. Escolha a líder no campo abaixo e salve.
            </p>
          </div>
        </div>
      )}
      <Card className="mt-4 p-6">
        <GroupForm group={group} leaders={leaders} hosts={hosts} />
      </Card>

      <div className="mt-6">
        <p className="mb-3 text-sm font-semibold text-foreground">
          Participantes do grupo ({participants.length})
        </p>
        <ParticipantsTable participants={participants} basePath="/participantes" />
      </div>
    </div>
  );
}
