import Link from "next/link";
import { Plus } from "lucide-react";
import { listMeetings } from "@/lib/services/meetings.service";
import { getMyLeaderContext } from "@/lib/services/leaders.service";
import { MeetingsList } from "@/components/encontros/meetings-list";
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
        <Link
          href="/meus-encontros/novo"
          className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          <Plus size={16} />
          Novo encontro
        </Link>
      </PageHeader>
      <div className="mt-4">
        <MeetingsList meetings={meetings} basePath="/meus-encontros" />
      </div>
    </div>
  );
}
