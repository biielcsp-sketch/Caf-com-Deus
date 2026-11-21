-- Líder devolve a participante para a fila de distribuição ("Precisa de outro café").
-- Caso: o café mudou de dia/horário, a participante não consegue mais e a pastora
-- precisa redirecioná-la. Antes não havia como a líder avisar pelo app.

alter table participants
  add column if not exists returned_by_leader_id uuid, -- sem FK de propósito: um 2º vínculo participants→leaders tornaria ambíguos os embeds do PostgREST
  add column if not exists return_reason text,
  add column if not exists returned_at timestamptz;

-- SECURITY DEFINER porque a líder não escreve em participant_leader_history
-- (só admin). A autorização é conferida aqui dentro: admin/desenvolvedor, ou a
-- líder ATUAL da participante.
create or replace function public.app_return_participant_to_queue(
  p_participant_id uuid,
  p_reason text
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_leader uuid;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_motivo text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if auth.uid() is null then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select current_leader_id into v_leader
    from participants
   where id = p_participant_id and deleted_at is null;

  if not found then
    raise exception 'participante não encontrada' using errcode = 'P0002';
  end if;
  if v_leader is null then
    raise exception 'participante não está vinculada a uma líder' using errcode = 'P0001';
  end if;
  if not (app_is_admin() or v_leader = app_current_leader_id()) then
    raise exception 'permission denied for table participants' using errcode = '42501';
  end if;

  update participant_leader_history
     set end_date = v_hoje,
         reason = 'Devolvida pela líder: ' || coalesce(v_motivo, 'precisa de outro café')
   where participant_id = p_participant_id
     and end_date is null;

  update participants
     set current_leader_id = null,
         current_group_id = null,
         status = 'aguardando_distribuicao',
         returned_by_leader_id = v_leader,
         return_reason = v_motivo,
         returned_at = now(),
         updated_at = now()
   where id = p_participant_id;

  insert into participant_status_history (participant_id, status, changed_by, note)
  values (p_participant_id, 'aguardando_distribuicao', auth.uid(),
          'Devolvida pela líder para nova distribuição: ' || coalesce(v_motivo, 'precisa de outro café'));
end;
$$;

revoke all on function public.app_return_participant_to_queue(uuid, text) from public, anon;
grant execute on function public.app_return_participant_to_queue(uuid, text) to authenticated, service_role;

-- Ao sair da fila (distribuída/transferida/etc.), limpa a marca de "devolvida".
create or replace function public.app_clear_return_marker()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if old.status = 'aguardando_distribuicao' and new.status <> 'aguardando_distribuicao' then
    new.returned_by_leader_id := null;
    new.return_reason := null;
    new.returned_at := null;
  end if;
  return new;
end;
$$;

revoke all on function public.app_clear_return_marker() from public, anon, authenticated;

drop trigger if exists trg_participants_clear_return_marker on participants;
create trigger trg_participants_clear_return_marker
  before update on participants
  for each row execute function public.app_clear_return_marker();
