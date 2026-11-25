import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { getCurrentProfile } from "@/lib/services/profiles.service";
import { getMyAvatarSignedUrl } from "@/lib/services/avatar.service";
import { getDailyVerse } from "@/lib/services/bible.service";
import { listStudyMaterials } from "@/lib/services/study-materials.service";
import { getLatestCafeMedia } from "@/lib/services/cafe-media.service";
import { listMeetings } from "@/lib/services/meetings.service";
import { RoleShell } from "@/components/role-shell";
import { LatestMedia } from "@/components/feed/latest-media";
import { StudyMaterialsPanel } from "@/components/estudos/study-materials-panel";
import { Card } from "@/components/ui/Card";
import { SecaoRetratil } from "@/components/ui/SecaoRetratil";
import { PageHeader } from "@/components/ui/PageHeader";
import { estudoVisivelNoFeed } from "@/lib/study-materials";
import { hojeEmSaoPaulo, primeiroDiaDoProximoMesEmSaoPaulo } from "@/lib/dates";

// Feed: a tela onde a comunidade acompanha o que está acontecendo —
// versículo do dia, próximos encontros, o tema do mês (só leitura; quem
// publica é a pastora, em /estudos) e a última publicação do mural, com
// atalho para a aba Mural.
export default async function FeedPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  // Fallback mantido (o Feed é composto; um bloco quebrado não deve derrubar
  // os outros), mas a falha agora vai para o log do servidor em vez de
  // desaparecer — um erro de leitura era indistinguível de "não há nada".
  function aoFalhar<T>(bloco: string, fallback: T) {
    return (e: unknown): T => {
      console.error("[feed] %s:", bloco, e);
      return fallback;
    };
  }

  const [avatarUrl, verse, materials, latestMedia, meetings] = await Promise.all([
    getMyAvatarSignedUrl(),
    getDailyVerse(),
    listStudyMaterials().catch(aoFalhar("Estudo do mês", [] as Awaited<ReturnType<typeof listStudyMaterials>>)),
    // Só a última publicação: o mural inteiro tem aba própria.
    getLatestCafeMedia().catch(aoFalhar("Última publicação do mural", null)),
    listMeetings({}).catch(aoFalhar("Encontros", [] as Awaited<ReturnType<typeof listMeetings>>)),
  ]);

  const today = hojeEmSaoPaulo();
  const upcoming = meetings
    .filter((m) => m.date >= today && m.status !== "cancelado")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  // Só o material do mês corrente aparece no Feed; o histórico completo
  // fica em /estudos, para quem tem acesso.
  const currentMonth = today.slice(0, 7);
  //
  // Exceção: líder e co-líder (e a gestão) também veem o estudo do mês
  // seguinte assim que a pastora publica, marcado "Já disponível", para se
  // prepararem antes do dia 1º. As demais participantes só veem o mês vigente.
  const nextMonth = primeiroDiaDoProximoMesEmSaoPaulo().slice(0, 7);
  const monthMaterials = materials.filter((m) =>
    estudoVisivelNoFeed(profile.role, m.reference_month, currentMonth, nextMonth),
  );
  const veProximoMes = estudoVisivelNoFeed(profile.role, nextMonth, currentMonth, nextMonth);

  return (
    <RoleShell profile={profile} avatarUrl={avatarUrl}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={`Olá, ${profile.full_name.split(" ")[0]}`}
          description="O que está acontecendo no Café com Deus Shine."
        />

        {verse && (
          <Card className="bg-logo-panel p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">
              Versículo do dia
            </p>
            <p className="text-base leading-relaxed text-foreground">{verse.text}</p>
            <p className="mt-3 text-sm font-medium text-primary">
              {verse.bookName} {verse.chapter}:{verse.verse}
            </p>
            <Link
              href="/biblia"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary"
            >
              <BookOpen size={15} />
              Abrir a Bíblia
            </Link>
          </Card>
        )}

        <SecaoRetratil titulo="Próximos encontros" contador={upcoming.length} abertoPorPadrao>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum encontro agendado no momento.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {upcoming.map((meeting) => (
                <div key={meeting.id} className="rounded-xl border border-border p-3">
                  <p className="text-sm font-medium text-foreground">{meeting.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(`${meeting.date}T00:00:00`).toLocaleDateString("pt-BR")}
                    {meeting.time ? ` — ${meeting.time.slice(0, 5)}` : ""}
                    {meeting.group?.name ? ` · ${meeting.group.name}` : ""}
                  </p>
                  {meeting.ministered_by && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Palavra: {meeting.ministered_by}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </SecaoRetratil>

        <SecaoRetratil titulo="Tema do mês">
          {monthMaterials.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              O material deste mês ainda não foi publicado.
            </p>
          ) : (
            // canManage=false: no Feed o tema é só leitura — publicar é na
            // aba Estudo do mês, exclusiva da pastora.
            <StudyMaterialsPanel
              materials={monthMaterials}
              canManage={false}
              upcomingMonth={veProximoMes ? nextMonth : undefined}
            />
          )}
        </SecaoRetratil>

        <LatestMedia media={latestMedia} currentProfileId={profile.id} />
      </div>
    </RoleShell>
  );
}
