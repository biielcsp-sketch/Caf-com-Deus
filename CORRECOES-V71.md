# v71 — Gestão de Membros + papel "Gestora de Pessoas"

## Banco (supabase/migrations)
- `20261007120000_gestora_de_pessoas_enum.sql` — valor `gestora_de_pessoas` em `user_role` (JÁ APLICADA).
- `20261007120100_gestora_de_pessoas_policies.sql` — `app_is_people_manager()` + policies aditivas (JÁ APLICADA).
  `app_is_admin()` NÃO foi alterado. A gestora lê/atualiza `participants`, lê/insere/atualiza
  `participant_leader_history`, lê/insere `participant_status_history`, lê `leaders`, `groups` e os
  perfis que são de líderes. Não vê contas, auditoria nem configuração; não apaga nada.
- `20261001120000_lider_devolve_participante_para_fila.sql` (v70) — PENDENTE de aplicar.
  O código já lê `returned_at`/`return_reason`; sem ela a fila "Aguardando distribuição" falha.

## App
- Nova área `/gestao-membros` (painel, novas-inscricoes, aguardando-distribuicao[/id], redistribuicao),
  fora dos route groups, com layout próprio (`isPeopleManagerRole`) dentro do menu de cada papel.
- Saíram de `/participantes`: links de novas inscrições/fila e o formulário de transferência da ficha
  (agora só aponta para a Redistribuição). URLs antigas redirecionam (next.config.ts).
- Actions de distribuição/revisão passam a aceitar admin, desenvolvedor e gestora.
- Gestora usa o painel de líder (`isLeaderRole` inclui o papel) + aba "Gestão de Membros"; login cai em /gestao-membros.
- Contas: opção "Gestora de Pessoas" na edição; plural "Gestoras de Pessoas" na lista.

## Ativar a Franciele
`update profiles set role = 'gestora_de_pessoas' where id = '4f8ea963-a45d-4df4-8d13-39d45a6d01e8';`
(só DEPOIS do deploy da v71 — antes disso o app v70 não conhece o papel e a mandaria para /minha-jornada).

## Ajustes pedidos pela Franciele (líder) — 07/10/2026
1. **Presença "não aparece"**: o banco gravava normalmente; os 4 encontros dela estavam "Realizado" com 0 chamadas — marcar Realizado não cria presença (só o botão Chamada). Agora: aviso "Chamada pendente (x/y)" na lista de encontros; no formulário de encontro "Realizado" explica e linka a Chamada; no Início, "Último encontro" é o último REALIZADO, mostra "chamada ainda não foi feita" em vez de 0/0 e traz botão "Fazer chamada (x/y)", além de "justificaram".
2. **Status na ficha**: card "Situação na jornada" na ficha da líder (Ativa / Acompanhamento / Inativa). Aguardando distribuição fica no "Precisa de outro café"; Nova inscrição/Distribuída são da pastora/gestora. Migration `20261007130000_lider_registra_status_participante.sql` (policy `psh_leader_insert`; JÁ APLICADA) — sem ela a líder não conseguia gravar o histórico.

## v73 — fila unificada
"Aguardando distribuição" deixou de ser tela/cartão próprio: virou seção da tela "Novas inscrições e distribuição" (aprovadas manualmente + devolvidas por líderes), um passo a menos. Hub com 2 cartões (essa tela e Redistribuição). `/gestao-membros/aguardando-distribuicao` só redireciona; `/[id]` (escolher líder) continua.
