import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile, isAdminRole } from "@/lib/services/profiles.service";
import { getMyAvatarSignedUrl } from "@/lib/services/avatar.service";
import { listCafeMedia, listGroupsICanPostTo } from "@/lib/services/cafe-media.service";
import { driveConfigStatus, isDriveConfigured } from "@/lib/google-drive";
import { detalhesDoErro } from "@/lib/errors";
import { RoleShell } from "@/components/role-shell";
import { MediaUpload } from "@/components/mural/media-upload";
import { MediaCard } from "@/components/mural/media-card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { SecaoRetratil } from "@/components/ui/SecaoRetratil";

// Mural: feed com as fotos e vídeos de TODOS os cafés. Todas veem; publicam a líder, a
// co-líder e a admin. Os arquivos ficam no Google Drive — aqui só passa
// o que descreve a publicação.
export default async function MuralPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  // O `.catch(() => [])` que estava aqui transformava QUALQUER falha de
  // leitura em "o mural ainda está vazio" — a tela ficava idêntica à de um
  // mural sem publicação nenhuma, e não havia como saber que tinha dado
  // erro sem ir no log da hospedagem. Foi assim que uma foto gravada no
  // banco passou por "não apareceu no mural" sem deixar pista.
  //
  // Agora a falha é dita na tela. Para a admin, com a mensagem do servidor
  // junto; para as demais, só o aviso de que algo falhou.
  const [avatarUrl, mediaResult, postableGroups] = await Promise.all([
    getMyAvatarSignedUrl(),
    listCafeMedia().then(
      (lista) => ({ lista, erro: null as string | null }),
      (e: unknown) => ({
        lista: [] as Awaited<ReturnType<typeof listCafeMedia>>,
        // `detalhesDoErro` desce até o erro original do PostgREST, que
        // `dbError()` guarda em `cause` — a mensagem de fora é genérica de
        // propósito e não diria nada útil aqui.
        erro: detalhesDoErro(e, "Falha ao carregar as publicações."),
      }),
    ),
    listGroupsICanPostTo().catch(() => []),
  ]);
  const media = mediaResult.lista;

  const isAdmin = isAdminRole(profile.role);
  const postableIds = new Set(postableGroups.map((g) => g.id));

  // Quem, pelo papel, deveria ter o formulário de publicar na tela. Serve
  // para distinguir "não pode publicar" de "pode, mas falta alguma coisa"
  // — antes as duas situações davam a mesma tela em branco.
  const deveriaPublicar =
    isAdmin || profile.role === "lider" || profile.role === "co_lider" || profile.role === "gestora_de_pessoas";

  const driveFaltando = driveConfigStatus()
    .filter((v) => !v.presente)
    .map((v) => v.nome);

  return (
    <RoleShell profile={profile} avatarUrl={avatarUrl}>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Mural de fotos"
          description="As fotos e os vídeos de todos os cafés, num lugar só."
        />

        {/* O aviso de configuração vem antes do formulário: sem as
            credenciais do Drive, publicar falha no último passo, e é
            melhor dizer isso de cara do que depois do upload. */}
        {deveriaPublicar && !isDriveConfigured() && (
          <Card className="flex flex-col gap-2 p-5">
            <p className="text-sm font-semibold text-foreground">
              O envio para o Google Drive ainda não está ligado
            </p>
            {isAdmin ? (
              <>
                <p className="text-sm text-muted-foreground">
                  O sistema guarda as fotos e os vídeos no Google Drive, e para isso precisa
                  das credenciais da conta. Estas o servidor não está enxergando:
                </p>
                {/* Só o nome e o fato de faltar — o valor nunca chega à tela. */}
                <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                  {driveFaltando.map((nome) => (
                    <li key={nome} className="ml-5 list-disc">
                      <code className="font-mono text-xs">{nome}</code>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                O sistema guarda as fotos e os vídeos no Google Drive, e as credenciais dessa
                conta ainda não foram configuradas. Avise quem cuida do sistema — é ajuste da
                hospedagem, não dá para resolver por aqui.
              </p>
            )}
            {isAdmin && (
              <p className="text-sm text-muted-foreground">
                No Netlify, em <strong>Site configuration → Environment variables</strong>:
                confira o nome exato, deixe o escopo em <strong>All scopes</strong> e o
                contexto em <strong>All deploy contexts</strong>, e publique um novo deploy
                depois de salvar — variável criada depois do último deploy só passa a valer
                no seguinte.
              </p>
            )}
          </Card>
        )}

        {postableGroups.length > 0 ? (
          <SecaoRetratil titulo="Publicar no mural">
            <MediaUpload postableGroups={postableGroups} />
          </SecaoRetratil>
        ) : (
          deveriaPublicar && (
            <Card className="flex flex-col gap-2 p-5">
              <p className="text-sm font-semibold text-foreground">
                Ainda não dá para publicar
              </p>
              {isAdmin ? (
                <p className="text-sm text-muted-foreground">
                  Toda publicação do mural pertence a um café, e ainda não há nenhum
                  cadastrado. Cadastre o primeiro em{" "}
                  <Link href="/cafes" className="font-medium text-primary hover:underline">
                    Cafés
                  </Link>{" "}
                  e o formulário aparece aqui.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Toda publicação do mural pertence a um café, e você ainda não está
                  vinculada a nenhum. Assim que a administração te vincular, o formulário
                  aparece aqui.
                </p>
              )}
            </Card>
          )
        )}

        {mediaResult.erro ? (
          <Card className="flex flex-col gap-2 p-8 text-center">
            <p className="text-sm font-semibold text-danger">
              Não foi possível carregar as publicações
            </p>
            <p className="text-sm text-muted-foreground">
              Isso é falha de leitura, não mural vazio — o que já foi publicado continua
              guardado. Tente recarregar a página.
            </p>
            {isAdmin && (
              <p className="font-mono text-xs text-muted-foreground">{mediaResult.erro}</p>
            )}
          </Card>
        ) : media.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              O mural ainda está vazio. Assim que alguém publicar uma foto ou um vídeo, ele
              aparece aqui.
            </p>
          </Card>
        ) : (
          <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
            {media.map((item) => (
              <MediaCard
                key={item.id}
                media={item}
                // O botão só aparece para quem a RLS vai deixar apagar de
                // fato — o servidor confere de novo de qualquer forma.
                canDelete={
                  isAdmin || item.authorId === profile.id || postableIds.has(item.groupId)
                }
                currentProfileId={profile.id}
              />
            ))}
          </div>
        )}
      </div>
    </RoleShell>
  );
}
