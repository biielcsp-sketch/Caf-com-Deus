-- A líder passa a poder cadastrar participante.
--
-- Até aqui o INSERT em `participants` tinha uma policy só
-- ("participants_admin_insert", with check app_is_admin()), então a líder
-- recebia 42501 do Postgres em qualquer tentativa — não existia caminho de
-- cadastro para ela nem na tela nem no banco. Quem cadastrava era a própria
-- participante (formulário público/QR Code) ou a pastora.
--
-- Regra: a líder só consegue inserir uma linha que JÁ NASCE dela. Não é uma
-- permissão de "criar participante", é "criar participante minha" — não dá
-- para cadastrar alguém apontando para outra líder, nem deixar a linha solta
-- para cair na fila de distribuição. Policies são permissivas (OR), então
-- esta convive com a de admin sem afrouxar nada do que já existia.
create policy "participants_leader_insert" on participants for insert to authenticated
  with check (
    app_current_leader_id() is not null
    and current_leader_id = app_current_leader_id()
  );

-- O vínculo precisa aparecer no histórico no mesmo instante — é ele que
-- alimenta a tela "Histórico" e a jornada da participante. Sem isto, a
-- participante cadastrada pela líder ficaria sem data de início de vínculo,
-- e "plh_admin_write" só libera admin.
create policy "plh_leader_insert" on participant_leader_history for insert to authenticated
  with check (leader_id = app_current_leader_id());
