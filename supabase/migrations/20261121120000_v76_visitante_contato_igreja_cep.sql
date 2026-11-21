-- v76 refeita + correções de 21/11/2026.
--
-- 1. Visitante (tag, fora do fluxo da jornada) com lembrete de contato.
-- 2. Mudar a situação da participante (distribuída -> ativa, acompanhamento
--    ou inativa) confirma o contato pendente e baixa os avisos. Antes só o
--    botão "Já fiz contato" fazia isso, e os avisos ficavam presos.
-- 3. Participante inativa não gera cobrança de contato.
-- 4. Igreja (Lagoinha / outra / nenhuma) e CEP na ficha.

-- 1. Colunas ------------------------------------------------------------------
alter table participants
  add column if not exists is_visitor boolean not null default false,
  add column if not exists visitor_marked_at timestamptz,
  add column if not exists visitor_contact_confirmed_at timestamptz,
  add column if not exists visitor_reminded_at timestamptz,
  add column if not exists church_status text,
  add column if not exists church_name text,
  add column if not exists cep text;

alter table participants
  drop constraint if exists participants_church_status_check;
alter table participants
  add constraint participants_church_status_check
  check (church_status is null or church_status in ('lagoinha', 'outra', 'nenhuma'));

-- Quem já disse que é de Lagoinha passa a constar. Quem disse "não" fica sem
-- detalhe (não sabemos se é de outra igreja ou de nenhuma): a tela mostra
-- "Não é de Lagoinha" até alguém preencher.
update participants set church_status = 'lagoinha'
 where is_lagoinha_member is true and church_status is null;

create index if not exists participants_visitor_idx
  on participants (visitor_marked_at)
  where is_visitor and visitor_contact_confirmed_at is null;

-- 2. Autoatendimento: a participante não mexe nas colunas novas --------------
create or replace function app_guard_participant_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from profiles where id = auth.uid() and role = 'participante') then
    if new.full_name is distinct from old.full_name
      or new.preferred_name is distinct from old.preferred_name
      or new.email is distinct from old.email
      or new.birth_date is distinct from old.birth_date
      or new.city is distinct from old.city
      or new.neighborhood is distinct from old.neighborhood
      or new.geo_lat is distinct from old.geo_lat
      or new.geo_lng is distinct from old.geo_lng
      or new.other_notes is distinct from old.other_notes
      or new.status is distinct from old.status
      or new.contact_status is distinct from old.contact_status
      or new.current_leader_id is distinct from old.current_leader_id
      or new.current_group_id is distinct from old.current_group_id
      or new.enrollment_date is distinct from old.enrollment_date
      or new.enrollment_source is distinct from old.enrollment_source
      or new.admin_notes is distinct from old.admin_notes
      or new.deleted_at is distinct from old.deleted_at
      or new.contact_authorized_at is distinct from old.contact_authorized_at
      or new.anonymized_at is distinct from old.anonymized_at
      or new.profile_id is distinct from old.profile_id
      or new.is_visitor is distinct from old.is_visitor
      or new.visitor_marked_at is distinct from old.visitor_marked_at
      or new.visitor_contact_confirmed_at is distinct from old.visitor_contact_confirmed_at
      or new.visitor_reminded_at is distinct from old.visitor_reminded_at
      or new.church_status is distinct from old.church_status
      or new.church_name is distinct from old.church_name
      or new.cep is distinct from old.cep
    then
      raise exception 'Participante só pode atualizar telefone, whatsapp, endereço e disponibilidade.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function app_guard_participant_self_update() from public, anon, authenticated;

-- 3. Visitante: carimbos e aviso para a líder ---------------------------------
create or replace function app_visitor_stamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_visitor and not old.is_visitor then
    new.visitor_marked_at := now();
    new.visitor_contact_confirmed_at := null;
    new.visitor_reminded_at := null;
  elsif not new.is_visitor and old.is_visitor then
    new.visitor_marked_at := null;
    new.visitor_contact_confirmed_at := null;
    new.visitor_reminded_at := null;
  end if;
  return new;
end;
$$;
revoke all on function app_visitor_stamp() from public, anon, authenticated;

drop trigger if exists participants_visitor_stamp on participants;
create trigger participants_visitor_stamp
  before update of is_visitor on participants
  for each row execute function app_visitor_stamp();

create or replace function app_visitor_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lider_profile uuid;
begin
  if new.is_visitor and not old.is_visitor then
    select l.profile_id into v_lider_profile from leaders l where l.id = new.current_leader_id;
    if v_lider_profile is not null then
      insert into notifications (profile_id, type, title, body, link, participant_id)
      values (v_lider_profile, 'visitante_contato',
              'Visitante para contatar',
              coalesce(new.preferred_name, new.full_name) || ' foi marcada como visitante. Entre em contato e confirme no app.',
              '/minhas-participantes/' || new.id, new.id);
    end if;
  elsif not new.is_visitor and old.is_visitor then
    update notifications set read = true
     where participant_id = new.id and type in ('visitante_contato', 'visitante_lembrete');
  end if;
  return new;
end;
$$;
revoke all on function app_visitor_notify() from public, anon, authenticated;

drop trigger if exists participants_visitor_notify on participants;
create trigger participants_visitor_notify
  after update of is_visitor on participants
  for each row execute function app_visitor_notify();

-- Confirmar o contato com a visitante.
create or replace function app_confirm_visitor_contact(p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    app_is_people_manager()
    or exists (
      select 1 from participants
       where id = p_participant_id
         and current_leader_id = app_current_leader_id()
    )
  ) then
    raise exception 'Sem permissão para confirmar o contato desta visitante.'
      using errcode = '42501';
  end if;

  update participants
     set visitor_contact_confirmed_at = now()
   where id = p_participant_id
     and is_visitor
     and visitor_contact_confirmed_at is null;

  update notifications set read = true
   where participant_id = p_participant_id
     and type in ('visitante_contato', 'visitante_lembrete');
end;
$$;
revoke all on function app_confirm_visitor_contact(uuid) from public, anon;
grant execute on function app_confirm_visitor_contact(uuid) to authenticated;

-- Lembrete: passou de 3 dias sem contato confirmado. Uma vez só por marcação.
create or replace function app_remind_visitor_contacts()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_total int := 0;
begin
  for r in
    select p.id, coalesce(p.preferred_name, p.full_name) as nome, l.profile_id as lider_profile
      from participants p
      join leaders l on l.id = p.current_leader_id
     where p.is_visitor
       and p.visitor_contact_confirmed_at is null
       and p.visitor_reminded_at is null
       and p.visitor_marked_at <= now() - interval '3 days'
       and p.deleted_at is null
       and p.anonymized_at is null
       and l.profile_id is not null
  loop
    insert into notifications (profile_id, type, title, body, link, participant_id)
    values (r.lider_profile, 'visitante_lembrete',
            'Visitante sem contato há mais de 3 dias',
            r.nome || ' ainda não foi contatada. Fale com ela e confirme no app.',
            '/minhas-participantes/' || r.id, r.id);
    update participants set visitor_reminded_at = now() where id = r.id;
    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$$;
revoke all on function app_remind_visitor_contacts() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('lembrar-contato-visitantes', '5 * * * *', $$select public.app_remind_visitor_contacts()$$);

-- 4. Mudou a situação -> o contato pendente é baixado --------------------------
create or replace function app_confirm_contact_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linhas int;
begin
  if new.status is distinct from old.status
     and new.status in ('ativa', 'acompanhamento', 'inativa') then
    update participant_leader_history
       set contact_confirmed_at = now(),
           contact_confirmed_by = auth.uid()
     where participant_id = new.id
       and end_date is null
       and contact_confirmed_at is null;
    get diagnostics v_linhas = row_count;
    if v_linhas > 0 then
      update notifications set read = true
       where participant_id = new.id
         and type in ('nova_participante', 'contato_atrasado_lider', 'contato_atrasado_gestao');
    end if;
  end if;
  return new;
end;
$$;
revoke all on function app_confirm_contact_on_status_change() from public, anon, authenticated;

drop trigger if exists participants_confirm_contact_on_status on participants;
create trigger participants_confirm_contact_on_status
  after update of status on participants
  for each row execute function app_confirm_contact_on_status_change();

-- O botão "Já fiz contato" baixava os avisos só quando ainda havia vínculo
-- pendente; se o vínculo já estivesse confirmado por outro caminho, os avisos
-- ficavam não lidos para sempre. Agora baixa sempre.
create or replace function app_confirm_participant_contact(p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    app_is_people_manager()
    or exists (
      select 1 from participants
       where id = p_participant_id
         and current_leader_id = app_current_leader_id()
    )
  ) then
    raise exception 'Sem permissão para confirmar o contato desta participante.'
      using errcode = '42501';
  end if;

  update participant_leader_history
     set contact_confirmed_at = now(),
         contact_confirmed_by = auth.uid()
   where participant_id = p_participant_id
     and end_date is null
     and contact_confirmed_at is null;

  update notifications
     set read = true
   where participant_id = p_participant_id
     and type in ('nova_participante', 'contato_atrasado_lider', 'contato_atrasado_gestao');
end;
$$;
revoke all on function app_confirm_participant_contact(uuid) from public, anon;
grant execute on function app_confirm_participant_contact(uuid) to authenticated;

-- 5. Inativa não é cobrada na escalada de contato -----------------------------
create or replace function app_escalate_pending_contacts()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_total int := 0;
begin
  for r in
    select plh.id, plh.participant_id, plh.created_at, l.profile_id as lider_profile,
           coalesce(lp.full_name, 'a líder') as lider_nome,
           coalesce(p.preferred_name, p.full_name) as participante
      from participant_leader_history plh
      join participants p on p.id = plh.participant_id
      left join leaders l on l.id = plh.leader_id
      left join profiles lp on lp.id = l.profile_id
     where plh.end_date is null
       and plh.contact_confirmed_at is null
       and plh.contact_escalated_at is null
       and plh.created_at <= now() - interval '3 days'
       and p.deleted_at is null
       and p.anonymized_at is null
       and p.status <> 'inativa'
  loop
    if r.lider_profile is not null then
      insert into notifications (profile_id, type, title, body, link, participant_id)
      values (r.lider_profile, 'contato_atrasado_lider',
              'Contato pendente há mais de 3 dias',
              r.participante || ' ainda está sem contato confirmado. Fale com ela e confirme no app.',
              '/inicio', r.participant_id);
    end if;

    insert into notifications (profile_id, type, title, body, link, participant_id)
    select pr.id, 'contato_atrasado_gestao',
           'Participante sem contato da líder',
           r.participante || ' foi distribuída para ' || r.lider_nome || ' há mais de 3 dias e o contato não foi confirmado.',
           '/gestao-membros', r.participant_id
      from profiles pr
     where pr.active and pr.role in ('admin', 'gestora_de_pessoas');

    update participant_leader_history set contact_escalated_at = now() where id = r.id;
    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$$;


-- 6. Limpeza única -----------------------------------------------------------
-- Participantes que já passaram para ativa, acompanhamento ou inativa mas
-- ficaram com contato "pendente" (o caso das distribuídas manualmente que a
-- Gestora de Pessoas atualizou em 11/11).
update participant_leader_history plh
   set contact_confirmed_at = now()
  from participants p
 where p.id = plh.participant_id
   and plh.end_date is null
   and plh.contact_confirmed_at is null
   and p.status in ('ativa', 'acompanhamento', 'inativa');

update notifications n
   set read = true
  from participants p
 where p.id = n.participant_id
   and n.read = false
   and n.type in ('nova_participante', 'contato_atrasado_lider', 'contato_atrasado_gestao')
   and p.status in ('ativa', 'acompanhamento', 'inativa');
