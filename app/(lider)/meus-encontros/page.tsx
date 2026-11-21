import { listMeetings } from "@/lib/services/meetings.service";
import { getMyLeaderContext } from "@/lib/services/leaders.service";
import { MeetingsList } from "@/components/encontros/meetings-list";
import { RoundAddLink } from "@/components/ui/RoundAddLink";
import { SecaoRetratil } from "@/components/ui/SecaoRetratil";
import { PageHeader } from "@/components/ui/PageHeader";
import { BackLink } from "@/components/ui/BackLink";

export default async function EncontrosPage() {
  // Filtro explícito, pelo mesmo motivo de /minhas-participantes: a tela não
  // deve depender só do RLS para decidir de quem são os encontros. Hoje a
  // policy meetings_select já restringe à própria líder (nem a gestora de
  // pessoas enxerga encontros alheios), então isto não muda nada agora — é
  // para não repetir o problema se algum papel novo ganhar leitura ampla.
  const leader = await getMyLeaderContext();
  const meetings = leader ? await listMeetings({ leaderId: leader.leaderId }) : [];

  return (
    <div>
      <BackLink href="/inicio" label="Início" />
      <PageHeader title="Encontros">
        <RoundAddLink href="/meus-encontros/novo" label="Novo encontro" />
      </PageHeader>
      <div className="mt-4">
        <SecaoRetratil titulo="Encontros" contador={meetings.length}>
          <MeetingsList meetings={meetings} basePath="/meus-encontros" />
        </SecaoRetratil>
      </div>
    </div>
  );
}
