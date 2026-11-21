-- Transferência e cadastro pela líder viram operações atômicas.
--
-- Motivo: as duas faziam várias escritas soltas, uma chamada por vez, sem
-- transação. Na transferência, se a inserção do vínculo novo falhasse depois
-- de o antigo ter sido fechado, a participante ficava sem NENHUM vínculo
-- aberto — estado inválido que a constraint `one_open_assignment` não detecta
-- (ela impede dois abertos, não zero). No cadastro pela líder, a participante
-- entrava e o histórico podia não entrar, e aí uma transferência futura
-- fechava zero vínculos, como se ela nunca tivesse sido da primeira líder.
--
-- É o mesmo remédio da v41 para a distribuição (app_confirm_distribution).
-- SECURITY INVOKER (padrão): a RLS continua sendo a barreira real.

create or replace function public.app_transfer_participant(
  p_participant_id uuid,
  p_leader_id uuid,
  p_group_id uuid,
  p_reason text
) returns void
language plpgsql
set search_path to 'public'
as $$
declare
  -- `current_date` segue o timezone do banco (UTC no Supabase): uma
  -- transferência feita das 21h à meia-noite em Brasília era datada com o dia
  -- seguinte no histórico.
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  update participant_leader_history
     set end_date = v_hoje,
         reason = p_reason
   where participant_id = p_participant_id
     and end_date is null;

  insert into participant_leader_history (participant_id, leader_id, group_id, start_date, changed_by)
  values (p_participant_id, p_leader_id, p_group_id, v_hoje, auth.uid());

  update participants
     set current_leader_id = p_leader_id,
         current_group_id = p_group_id,
         updated_at = now()
   where id = p_participant_id;

  -- RLS negando UPDATE não devolve erro, devolve zero linhas.
  if not found then
    raise exception 'permission denied for table participants'
      using errcode = '42501';
  end if;
end;
$$;

-- Colunas listadas uma a uma de propósito: `insert into participants select *
-- from jsonb_populate_record(null::participants, ...)` gravaria NULL explícito
-- em toda coluna ausente do payload, e coluna com NULL explícito NÃO recebe o
-- default da tabela — id, created_at, enrollment_date, contact_status e status
-- entrariam nulos.
create or replace function public.app_create_participant_by_leader(
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
    current_leader_id, current_group_id, status, enrollment_source
  )
  select
    e.full_name, e.preferred_name, e.phone, e.whatsapp, e.email, e.birth_date,
    e.city, e.neighborhood, e.address, e.availability_days, e.availability_period,
    e.location_preference, e.home_meeting_ok, e.other_notes,
    p_leader_id, p_group_id,
    coalesce(e.status, 'ativa'), coalesce(e.enrollment_source, 'Cadastro da líder')
  from jsonb_populate_record(null::participants, p_payload) e
  returning * into v_participante;

  insert into participant_leader_history (participant_id, leader_id, group_id, start_date, changed_by, reason)
  values (
    v_participante.id,
    p_leader_id,
    p_group_id,
    (now() at time zone 'America/Sao_Paulo')::date,
    auth.uid(),
    'Cadastrada diretamente pela líder'
  );

  return v_participante;
end;
$$;

-- A distribuição já era atômica, mas datava o vínculo com `current_date`
-- (UTC): à noite registrava o dia seguinte.
create or replace function public.app_confirm_distribution(
  p_participant_id uuid,
  p_leader_id uuid,
  p_group_id uuid
) returns void
language plpgsql
set search_path to 'public'
as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  update participant_leader_history
     set end_date = v_hoje
   where participant_id = p_participant_id
     and end_date is null;

  insert into participant_leader_history (participant_id, leader_id, group_id, start_date, changed_by)
  values (p_participant_id, p_leader_id, p_group_id, v_hoje, auth.uid());

  insert into participant_status_history (participant_id, status, changed_by)
  values (p_participant_id, 'distribuida', auth.uid());

  update participants
     set current_leader_id = p_leader_id,
         current_group_id = p_group_id,
         status = 'distribuida',
         updated_at = now()
   where id = p_participant_id;

  if not found then
    raise exception 'permission denied for table participants'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.app_transfer_participant(uuid, uuid, uuid, text) from public;
revoke all on function public.app_create_participant_by_leader(jsonb, uuid, uuid) from public;
grant execute on function public.app_transfer_participant(uuid, uuid, uuid, text) to authenticated, service_role;
grant execute on function public.app_create_participant_by_leader(jsonb, uuid, uuid) to authenticated, service_role;
