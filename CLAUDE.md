# Café com Deus Shine — Diretrizes do projeto

> Este `CLAUDE.md` vale **apenas para o que está dentro de `/cafe-com-deus-shine`**. O
> restante do repositório (`Apps`) contém um app não relacionado (SutoData) com suas
> próprias regras — não misture as duas coisas.

Você vai construir o sistema "Café com Deus Shine" em Next.js (App Router) + TypeScript +
Supabase (Postgres + Auth + RLS). O documento `arquitetura-tecnica-cafe-com-deus-shine.md`,
nesta mesma pasta, é a fonte de verdade de schema, permissões e estrutura de pastas — leia
ele por completo antes de qualquer ação e siga-o literalmente, sem improvisar estrutura
alternativa. `cafe-com-deus-shine-especificacao-mvp.md` é a especificação de produto original.

## Projeto Supabase

- Projeto dedicado: `cafe-com-deus-shine` (ref `gqwobpovsdjrzwqnsunt`, org
  `doqapnutnficekukcxrv`, região `us-east-1`), plano gratuito.
- **Não é** o mesmo projeto do "GC Manager - Lagoinha Alphaville" (ref
  `kacglxgdlmcaziirdsvd`) — aquele é um sistema diferente, em produção, de outra base de
  usuários. Ele só serve como referência de lógica de negócio (regra de rotação, cálculo de
  ausência consecutiva), nunca como banco a escrever.
- Recuperação de senha usa o e-mail padrão embutido do Supabase Auth (decisão do usuário —
  sem SMTP customizado no MVP).
- Convite de líder usa `supabase.auth.admin.inviteUserByEmail` via `SUPABASE_SERVICE_ROLE_KEY`
  (server-only, nunca no cliente) — ver `lib/supabase/admin.ts`.

## Decisões travadas (não reabra estas discussões, não peça confirmação sobre elas)
- Projeto é single-tenant: uma comunidade só, sem isolamento multi-igreja.
- Motor de distribuição usa os 5 critérios do item 7 da especificação original, como score
  ponderado (pesos decrescentes somados, não prioridade lexicográfica estrita), com pesos
  configuráveis em `app_config.distribution_weights`. Detalhamento completo na seção 5 do
  `arquitetura-tecnica-cafe-com-deus-shine.md` — siga a fórmula exatamente como descrita lá,
  não invente pesos ou fórmula alternativa.
- Acompanhamento pastoral (`follow_ups.observation`): visível apenas para a própria líder
  responsável (atual ou histórica, via `participant_leader_history`) e para admin. Sem
  camada extra de restrição por tipo no MVP.
- **O módulo de LGPD foi removido (decisão do usuário, 11/09/2026).** Não existe mais termo
  de consentimento versionado (`app_terms_versions`), fila de solicitações de exclusão
  (`data_erasure_requests`) nem as colunas `consent_version`/`consent_method`. Não recrie
  nada disso, e não volte a usar o vocabulário de LGPD nas telas.
- O que sobrou de consentimento é uma coisa só: `participants.contact_authorized_at`,
  preenchido quando a própria pessoa marca, no formulário público, que autoriza a equipe a
  entrar em contato. O cadastro feito pela equipe não pede autorização nenhuma — quem
  preenche já falou com a pessoa.
- "Excluir participante" continua sendo limpeza dos campos pessoais + `anonymized_at`, nunca
  DELETE da linha (ver `lib/services/erasure.service.ts`). Isso não é mais uma exigência
  legal, é o que impede a contagem de presença dos encontros de mudar retroativamente.
  Nunca implemente DELETE de `participants`, `attendance`, `follow_ups` ou `meetings`.
- Arquivo grande nunca trafega dentro de Server Action (limite de 1MB por padrão, e o da
  função serverless por cima). Envio do estudo do mês vai do navegador direto para o
  Supabase Storage; o mural vai direto para o Google Drive. A Server Action só grava a
  linha depois, e reconfere tamanho, tipo e magic bytes lendo o objeto já gravado.
- Toda regra de autorização vive em Row Level Security no Postgres. Checagem de papel no
  frontend é só UX (esconder botão) — nunca é a barreira de segurança real.
- Nenhum componente de página do Next.js chama o Supabase diretamente. Toda leitura/escrita
  passa por funções em `/lib/services`.

## Antes de qualquer deploy
`npm run check` (TypeScript + ESLint + testes) e depois `npm run build`. O `next dev` compila com
Turbopack e NÃO checa tipos — quem checa é o build. Já aconteceu de um erro de tipo só
aparecer no Netlify, gastando um deploy por tentativa. Setup local completo em
`DESENVOLVIMENTO.md`.

## Regra fixa: consultar o app de referência antes de implementar
Sempre que o usuário pedir uma funcionalidade nova (ou pedir para corrigir/estender uma já
existente), antes de desenhar a solução do zero, consulte o app de referência
**Consolidação — Lagoinha Alphaville**. Se a funcionalidade já existe pronta lá, **copie a
lógica e adapte** ao schema/stack daqui — não desenhe uma solução paralela do zero quando já
existe uma pronta. Ajustes (nomes de tabela, tipos, papéis, integração com o resto do
projeto) são esperados; o que não deve acontecer é redesenhar algo que já está pronto lá,
mesmo que sua própria ideia pareça mais simples.

Onde consultar (12/09/2026 — não existe clone local, a instrução anterior estava
desatualizada):
- **Índice do código:** documento `claude/referencia-consolidacao-indice.md` no projeto do
  Claude. Comece sempre por ele: diz em que faixa de linhas está cada assunto.
- **Código:** documento `index.html` no mesmo projeto (app de arquivo único, ~14,7 mil
  linhas). Abra só o trecho indicado pelo índice — o arquivo inteiro não cabe em contexto.
  Fonte original: `consolidacao-deploy-v376.zip` no Drive do usuário.
- **App rodando:** https://consolidacaolagoinhaalphaville.netlify.app/ — o usuário tem um
  login com acesso de gestão e fornece as credenciais quando necessário.

Atenção à diferença de arquitetura: lá é um HTML único com funções globais, RPCs do
Postgres e Edge Functions; aqui é Next.js + TypeScript com camada de serviços em
`/lib/services` e RLS. Copie a **regra de negócio**, nunca a forma.

## Cuidado com o scaffold do Next.js
`next dev`/`next build` re-escreve `AGENTS.md` automaticamente (bloco entre marcadores) e,
se `AGENTS.md` não existir ou não tiver o bloco, também sobrescreve este `CLAUDE.md` para
`@AGENTS.md`. Como `AGENTS.md` já existe e hospeda o bloco, isso não deve mais acontecer —
mas se este arquivo algum dia virar `@AGENTS.md` sozinho, restaure este conteúdo a partir do
histórico do git, não aceite a versão gerada.

## Regras gerais para todas as fases
- Você NUNCA implementa uma fase inteira sem que o usuário tenha aprovado a fase anterior.
- Faça apenas as alterações pedidas no prompt da fase atual. Não adicione funcionalidade,
  não refatore código fora do escopo da fase, não "aproveite para melhorar" algo não pedido.
- Nunca instale dependências que não estejam listadas explicitamente no prompt da fase.
- Nunca rode migrations destrutivas (DROP, TRUNCATE, DELETE em massa) sem mostrar o SQL
  antes e esperar aprovação explícita.
- Nunca faça commit ou push para git sem o usuário pedir.
- Ao final de cada fase, liste todos os arquivos criados/alterados e um resumo do que cada
  um faz — não assuma que o usuário vai ler o diff inteiro sem esse resumo.
- Se encontrar qualquer contradição entre este documento e a arquitetura técnica, pare e
  pergunte antes de decidir sozinho qual prevalece.

## Fluxo de trabalho (GitHub + CI)
- Nada vai direto para `main`: cada mudança vira branch (`feat/...`, `fix/...`) e Pull Request.
- O PR só pode ser mesclado com o CI verde (`qualidade`, `seguranca`). O job `banco` é
  informativo até passar 2 vezes seguidas; depois vira obrigatório.
- Migration nova: arquivo em `supabase/migrations` (`AAAAMMDDHHMMSS_nome.sql`), rollback em
  `supabase/rollbacks/<mesmo-nome>.rollback.sql`, aplicada no SQL Editor do Supabase ANTES
  do deploy. Não usar `supabase db push` (os timestamps do histórico remoto divergem).
- Deploy: Netlify publica a partir de `main`. Mesclar = publicar.
- Commit e push só quando o Gabriel pedir.

## Qualidade e segurança automatizadas
- `npm run check` = tipos + lint + testes. Rode antes de abrir o PR.
- `tests/unit/seguranca-estatica.test.ts` reprova: `dangerouslySetInnerHTML`, `eval`,
  `auth.getSession()`, chave mestra do Supabase fora de `lib/env.ts` e `lib/supabase/admin.ts`,
  Client Component importando serviço/admin, função `security definer` sem `search_path`,
  tabela sem RLS, função liberada para `anon` fora da lista permitida.
- `.semgrep/cafe.yml` repete essas regras no CI e proíbe `delete` em participantes, presenças,
  acompanhamentos e encontros (anonimizar ou usar `deleted_at`).
- `supabase/tests/database/*.test.sql` (pgTAP) conferem RLS e funções no banco.
- CI também roda Gitleaks (segredos no histórico) e `npm audit` (alta/crítica em produção).
- `dast-producao.yml`: varredura passiva do OWASP ZAP no site publicado, toda segunda.
- Dependabot semanal, com 7 dias de espera para pacote novo.
- Teste novo para todo bug corrigido (regressão), em `tests/unit`.

## Agentes (`.claude/agents`)
`frontend` (telas/componentes), `banco` (migrations, RLS, pgTAP), `revisor` (revisão final
de segurança e regra de negócio, somente leitura). Fluxo completo: `/fluxo <tarefa>`.
