-- Rollback de 20261121120000_v76_visitante_contato_igreja_cep.
-- ATENÇÃO: apaga a igreja e o CEP já preenchidos. As colunas e triggers de visitante
-- pertencem à migration 20261030150516_visitante e NÃO são mexidas aqui.
-- A limpeza única de contatos pendentes (última parte da migration) não é desfeita.

drop trigger if exists participants_confirm_contact_on_status on participants;
drop function if exists app_confirm_contact_on_status_change();
drop function if exists app_confirm_visitor_contact(uuid);

-- Guard de autoatendimento: versão anterior (sem igreja/CEP).
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
    then
      raise exception 'Participante só pode atualizar telefone, whatsapp, endereço e disponibilidade.';
    end if;
  end if;
  return new;
end;
$$;

-- Contato: versões anteriores (sem baixa das notificações em qualquer caso e sem pular inativa).
create or replace function app_confirm_participant_contact(p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linhas int;
begin
  if not (
    app_is_people_manager()
    or exists (select 1 from participants where id = p_participant_id and current_leader_id = app_current_leader_id())
  ) then
    raise exception 'Sem permissão para confirmar o contato desta participante.' using errcode = '42501';
  end if;

  update participant_leader_history
     set contact_confirmed_at = now(), contact_confirmed_by = auth.uid()
   where participant_id = p_participant_id and end_date is null and contact_confirmed_at is null;
  get diagnostics v_linhas = row_count;

  if v_linhas > 0 then
    update notifications set read = true
     where participant_id = p_participant_id
       and type in ('nova_participante', 'contato_atrasado_lider', 'contato_atrasado_gestao');
  end if;
end;
$$;

create or replace function app_escalate_pending_contacts()
returns integer
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
  loop
    if r.lider_profile is not null then
      insert into notifications (profile_id, type, title, body, link, participant_id)
      values (r.lider_profile, 'contato_atrasado_lider', 'Contato pendente há mais de 3 dias',
              r.participante || ' ainda está sem contato confirmado. Fale com ela e confirme no app.',
              '/inicio', r.participant_id);
    end if;

    insert into notifications (profile_id, type, title, body, link, participant_id)
    select pr.id, 'contato_atrasado_gestao', 'Participante sem contato da líder',
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
revoke all on function app_guard_participant_self_update() from public, anon, authenticated;
revoke all on function app_confirm_participant_contact(uuid) from public, anon;
grant execute on function app_confirm_participant_contact(uuid) to authenticated;
revoke all on function app_escalate_pending_contacts() from public, anon, authenticated;

alter table participants drop constraint if exists participants_church_status_check;
alter table participants
  drop column if exists church_status,
  drop column if exists church_name,
  drop column if exists cep;
