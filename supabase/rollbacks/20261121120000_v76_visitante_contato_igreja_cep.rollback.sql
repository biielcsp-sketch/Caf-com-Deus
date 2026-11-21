-- Rollback de 20261121120000_v76_visitante_contato_igreja_cep.
-- ATENÇÃO: apaga as marcações de visitante, a igreja e o CEP já preenchidos.
-- A limpeza única de contatos pendentes (parte 6 da migration) NÃO é desfeita.
select cron.unschedule('lembrar-contato-visitantes');

drop trigger if exists participants_confirm_contact_on_status on participants;
drop trigger if exists participants_visitor_notify on participants;
drop trigger if exists participants_visitor_stamp on participants;
drop function if exists app_confirm_contact_on_status_change();
drop function if exists app_visitor_notify();
drop function if exists app_visitor_stamp();
drop function if exists app_remind_visitor_contacts();
drop function if exists app_confirm_visitor_contact(uuid);

-- Volta o guard de autoatendimento à versão de 20260911180000 (sem as colunas novas).
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
    then
      raise exception 'Participante só pode atualizar telefone, whatsapp, endereço e disponibilidade.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function app_guard_participant_self_update() from public, anon, authenticated;

alter table participants drop constraint if exists participants_church_status_check;
drop index if exists participants_visitor_idx;
alter table participants
  drop column if exists is_visitor,
  drop column if exists visitor_marked_at,
  drop column if exists visitor_contact_confirmed_at,
  drop column if exists visitor_reminded_at,
  drop column if exists church_status,
  drop column if exists church_name,
  drop column if exists cep;

-- As versões anteriores de app_confirm_participant_contact e
-- app_escalate_pending_contacts estão em 20261018120000_alerta_contato_nova_participante.sql:
-- reaplique esses dois `create or replace function` se precisar do comportamento antigo.
