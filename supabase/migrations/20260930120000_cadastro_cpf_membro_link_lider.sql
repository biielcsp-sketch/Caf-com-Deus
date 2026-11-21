-- v68 — Cadastro com CPF, pergunta de membro e link de inscrição da líder.
--
-- 1) participants ganha `cpf` (só dígitos, único entre cadastros não excluídos)
--    e `is_lagoinha_member` (resposta da pergunta "Você é membro de Lagoinha
--    Alphaville?"). Ambos nulos para quem já estava cadastrada: a tela de
--    atualização de cadastro (futura) é quem vai preencher o CPF das antigas.
-- 2) enrollment_sources ganha `leader_id` e `group_id`: um link de inscrição
--    pode pertencer a uma líder e ao café dela. Quem se inscreve por ele entra
--    direto nesse café, sem passar pela distribuição da pastora.
-- 3) A líder pode criar o PRÓPRIO link (e só o dela).
-- 4) app_enroll_participant_via_leader_link: grava participante + histórico de
--    líder numa transação só, para o cadastro público pelo link da líder.

alter table public.participants
  add column if not exists cpf text,
  add column if not exists is_lagoinha_member boolean;

alter table public.participants
  drop constraint if exists participants_cpf_format;
alter table public.participants
  add constraint participants_cpf_format check (cpf is null or cpf ~ '^[0-9]{11}$');

create unique index if not exists participants_cpf_unique
  on public.participants (cpf)
  where cpf is not null and deleted_at is null;

alter table public.enrollment_sources
  add column if not exists leader_id uuid references public.leaders(id) on delete cascade,
  add column if not exists group_id uuid references public.groups(id) on delete set null;

create index if not exists enrollment_sources_leader_idx
  on public.enrollment_sources (leader_id);

drop policy if exists enrollment_sources_leader_insert on public.enrollment_sources;
create policy enrollment_sources_leader_insert
  on public.enrollment_sources
  for insert
  to authenticated
  with check (
    leader_id is not null
    and leader_id = app_current_leader_id()
    and created_by = auth.uid()
  );

-- Colunas listadas uma a uma (mesmo motivo de app_create_participant_by_leader:
-- NULL explícito não recebe o default da tabela).
create or replace function public.app_enroll_participant_via_leader_link(
  p_payload jsonb,
  p_leader_id uuid,
  p_group_id uuid
) returns participants
language plpgsql
set search_path to 'public'
as $$
declare
  v_participante participants;
begin
  insert into participants (
    full_name, preferred_name, phone, whatsapp, email, birth_date,
    city, neighborhood, address, availability_days, availability_period,
    location_preference, home_meeting_ok, other_notes,
    cpf, is_lagoinha_member, profile_id, contact_authorized_at,
    current_leader_id, current_group_id, status, enrollment_source
  )
  select
    e.full_name, e.preferred_name, e.phone, e.whatsapp, e.email, e.birth_date,
    e.city, e.neighborhood, e.address, e.availability_days, e.availability_period,
    e.location_preference, e.home_meeting_ok, e.other_notes,
    e.cpf, e.is_lagoinha_member, e.profile_id, e.contact_authorized_at,
    p_leader_id, p_group_id, 'ativa', coalesce(e.enrollment_source, 'Link da líder')
  from jsonb_populate_record(null::participants, p_payload) e
  returning * into v_participante;

  insert into participant_leader_history (participant_id, leader_id, group_id, start_date, changed_by, reason)
  values (
    v_participante.id,
    p_leader_id,
    p_group_id,
    (now() at time zone 'America/Sao_Paulo')::date,
    null,
    'Inscrita pelo link da líder'
  );

  return v_participante;
end;
$$;

-- Só o servidor (service_role) chama: o cadastro público não tem sessão.
revoke all on function public.app_enroll_participant_via_leader_link(jsonb, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.app_enroll_participant_via_leader_link(jsonb, uuid, uuid)
  to service_role;
