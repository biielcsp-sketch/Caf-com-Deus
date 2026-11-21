import { Card } from "@/components/ui/Card";
import { MeetingForm } from "@/components/encontros/meeting-form";
import { listGroups } from "@/lib/services/groups.service";
import { getMyLeaderContext } from "@/lib/services/leaders.service";
import { BackLink } from "@/components/ui/BackLink";

export default async function NovoEncontroPage() {
  // Filtra pelo café da própria líder. Desde que a liderança passou a
  // enxergar todos os cafés (policy groups_lideranca_select), um
  // `listGroups()` sem filtro traria o ministério inteiro para este select —
  // e escolher o café de outra líder só levaria a uma recusa da RLS de
  // `meetings` na hora de salvar.
  const contexto = await getMyLeaderContext();
  const groups = contexto ? await listGroups({ leaderId: contexto.leaderId }) : [];

  return (
    <div>
      <BackLink href="/meus-encontros" label="Encontros" />
      <h1 className="mt-3 text-2xl font-semibold text-foreground">Novo encontro</h1>
      <Card className="mt-4 p-6">
        <MeetingForm groups={groups} basePath="/meus-encontros" />
      </Card>
    </div>
  );
}
