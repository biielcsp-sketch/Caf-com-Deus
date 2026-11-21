-- Gestora de Pessoas: acesso RESTRITO ao que a distribuição precisa.
--
-- De propósito NÃO se alarga app_is_admin(): ele é o portão de ~20 tabelas
-- (contas/profiles, audit_log, app_config, estudos, mural, acompanhamentos...)
-- e a gestora não deve ter nada disso. Em vez disso, um portão novo, usado só
-- nas policies abaixo (acrescentadas ao lado das existentes; nenhuma policy
-- de admin é alterada).
create or replace function public.app_is_people_manager()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from profiles
     where id = auth.uid()
       and role in ('admin', 'desenvolvedor', 'gestora_de_pessoas')
  );
$$;

revoke all on function public.app_is_people_manager() from public, anon;
grant execute on function public.app_is_people_manager() to authenticated, service_role;

comment on function public.app_is_people_manager() is
  'Portão da área Gestão de Membros: admin, desenvolvedor ou gestora_de_pessoas. Cobre só participantes, vínculos/histórico e a leitura de líderes e cafés — nunca contas, auditoria ou configuração.';

-- Participantes: ler e atualizar (distribuir/transferir muda líder, café e status).
-- Nunca DELETE nem INSERT (cadastro continua com a administração e as líderes).
create policy participants_people_manager_select on participants
  for select to authenticated using (app_is_people_manager());
create policy participants_people_manager_update on participants
  for update to authenticated
  using (app_is_people_manager()) with check (app_is_people_manager());

-- Vínculos com líder: fechar o vínculo aberto e abrir o novo.
create policy plh_people_manager_select on participant_leader_history
  for select to authenticated using (app_is_people_manager());
create policy plh_people_manager_insert on participant_leader_history
  for insert to authenticated with check (app_is_people_manager());
create policy plh_people_manager_update on participant_leader_history
  for update to authenticated
  using (app_is_people_manager()) with check (app_is_people_manager());

-- Histórico de status: registrar a transição.
create policy psh_people_manager_select on participant_status_history
  for select to authenticated using (app_is_people_manager());
create policy psh_people_manager_insert on participant_status_history
  for insert to authenticated with check (app_is_people_manager());

-- Leitura de líderes e cafés (o motor de distribuição e os seletores precisam).
create policy leaders_people_manager_select on leaders
  for select to authenticated using (app_is_people_manager());
create policy groups_people_manager_select on groups
  for select to authenticated using (app_is_people_manager());

-- Nome das líderes: só os perfis que SÃO líderes, não a tabela inteira.
create policy profiles_people_manager_select_leaders on profiles
  for select to authenticated
  using (
    app_is_people_manager()
    and exists (select 1 from leaders l where l.profile_id = profiles.id)
  );
