-- Multiplicação de café.
--
-- Quando um café multiplica, uma participante dele passa a liderar um café
-- novo e parte das mulheres vai junto. Isto registra:
--   - de qual café o novo nasceu (groups.parent_group_id) e quando
--     (groups.multiplied_at) — é o que desenha a árvore na aba Multiplicação;
--   - a participante elevada a líder (linha em `leaders`, papel `lider`);
--   - a transferência de todas as que vão junto, numa operação só, com o
--     histórico de vínculo preservado (o vínculo antigo é encerrado, nunca
--     apagado).

alter table groups
  add column if not exists parent_group_id uuid references groups(id),
  add column if not exists multiplied_at date;

create index if not exists groups_parent_idx on groups (parent_group_id);

-- Quem vai junto na multiplicação já conhece a líder nova (eram do mesmo
-- café): não faz sentido cobrar o contato de 3 dias. O gatilho de vínculo
-- passa a reconhecer o motivo "Multiplicação".
create or replace function app_notify_new_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lider_profile uuid;
  v_nome text;
  v_cadastro_proprio boolean;
begin
  if new.end_date is not null or new.leader_id is null then
    return new;
  end if;

  select profile_id into v_lider_profile from leaders where id = new.leader_id;
  select coalesce(preferred_name, full_name) into v_nome from participants where id = new.participant_id;

  if coalesce(new.reason, '') like 'Multiplicação%' then
    new.contact_confirmed_at := now();
    new.contact_confirmed_by := new.changed_by;
    return new;
  end if;

  v_cadastro_proprio := (new.changed_by is not null and new.changed_by = v_lider_profile)
                        or coalesce(new.reason, '') = 'Inscrita pelo link da líder';

  if v_cadastro_proprio then
    new.contact_confirmed_at := now();
    new.contact_confirmed_by := v_lider_profile;
    if new.changed_by is distinct from v_lider_profile and v_lider_profile is not null then
      insert into notifications (profile_id, type, title, body, link, participant_id)
      values (v_lider_profile, 'nova_participante_link',
              'Nova inscrição pelo seu link',
              coalesce(v_nome, 'Uma participante') || ' se inscreveu pelo seu link e já está no seu café.',
              '/minhas-participantes/' || new.participant_id, new.participant_id);
    end if;
    return new;
  end if;

  new.contact_confirmed_at := null;

  if v_lider_profile is not null then
    insert into notifications (profile_id, type, title, body, link, participant_id)
    values (v_lider_profile, 'nova_participante',
            'Nova participante no seu café',
            coalesce(v_nome, 'Uma participante') || ' foi direcionada para você. Entre em contato em até 3 dias e confirme no app.',
            '/inicio', new.participant_id);
  end if;
  return new;
end;
$$;

-- Executa a multiplicação inteira numa transação: ou tudo, ou nada.
--
-- p_new_leader_profile_id: o login da nova líder. Quando a participante não
-- tinha login, o app cria antes (service_role, Auth) e passa o id aqui.
-- p_cafe: { name, address, region, available_days[], meeting_time, capacity }
-- p_participant_ids: quem vai junto (todas precisam estar hoje no café de origem).
create or replace function app_multiply_cafe(
  p_origin_group_id uuid,
  p_new_leader_participant_id uuid,
  p_new_leader_profile_id uuid,
  p_cafe jsonb,
  p_participant_ids uuid[],
  p_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data date := coalesce(p_date, (now() at time zone 'America/Sao_Paulo')::date);
  v_origem groups%rowtype;
  v_leader_id uuid;
  v_group_id uuid;
  v_fora int;
  v_pid uuid;
begin
  if not app_is_people_manager() then
    raise exception 'Apenas a pastora ou a gestora de pessoas podem registrar uma multiplicação.'
      using errcode = '42501';
  end if;

  select * into v_origem from groups where id = p_origin_group_id;
  if not found then
    raise exception 'Café de origem não encontrado.';
  end if;

  if coalesce(trim(p_cafe->>'name'), '') = '' then
    raise exception 'Informe o nome do novo café.';
  end if;

  -- A nova líder precisa ser do café que está multiplicando.
  if not exists (
    select 1 from participants
     where id = p_new_leader_participant_id
       and current_group_id = p_origin_group_id
       and deleted_at is null
  ) then
    raise exception 'A nova líder precisa ser participante do café de origem.';
  end if;

  if p_new_leader_participant_id = any(coalesce(p_participant_ids, '{}')) then
    raise exception 'A nova líder não entra na lista de participantes transferidas.';
  end if;

  select count(*) into v_fora
    from unnest(coalesce(p_participant_ids, '{}')) as x(id)
   where not exists (
     select 1 from participants p
      where p.id = x.id and p.current_group_id = p_origin_group_id and p.deleted_at is null
   );
  if v_fora > 0 then
    raise exception 'Há participantes selecionadas que não estão no café de origem.';
  end if;

  -- 1. Nova líder: papel e linha em `leaders` (reaproveita se já existir).
  update profiles set role = 'lider', updated_at = now()
   where id = p_new_leader_profile_id and role = 'participante';

  select id into v_leader_id from leaders where profile_id = p_new_leader_profile_id;
  if v_leader_id is null then
    insert into leaders (profile_id, city, neighborhood, region, meeting_address, max_capacity, status, joined_at)
    select p_new_leader_profile_id, p.city, p.neighborhood,
           coalesce(nullif(p_cafe->>'region', ''), v_origem.region),
           nullif(p_cafe->>'address', ''),
           coalesce((p_cafe->>'capacity')::int, v_origem.capacity, 12),
           'ativa', v_data
      from participants p where p.id = p_new_leader_participant_id
    returning id into v_leader_id;
  else
    update leaders set status = 'ativa', updated_at = now() where id = v_leader_id;
  end if;

  -- O cadastro de participante dela fica ligado ao login (histórico) e sai do
  -- café de origem: ela agora lidera.
  update participants set profile_id = coalesce(profile_id, p_new_leader_profile_id)
   where id = p_new_leader_participant_id;

  -- 2. Novo café, filho do café de origem.
  insert into groups (name, leader_id, address, region, available_days, meeting_time, capacity, status,
                      parent_group_id, multiplied_at)
  values (
    trim(p_cafe->>'name'),
    v_leader_id,
    nullif(p_cafe->>'address', ''),
    coalesce(nullif(p_cafe->>'region', ''), v_origem.region),
    case when jsonb_typeof(p_cafe->'available_days') = 'array' and jsonb_array_length(p_cafe->'available_days') > 0
         then array(select jsonb_array_elements_text(p_cafe->'available_days'))
         else v_origem.available_days end,
    coalesce(nullif(p_cafe->>'meeting_time', '')::time, v_origem.meeting_time),
    coalesce((p_cafe->>'capacity')::int, v_origem.capacity),
    'ativo',
    p_origin_group_id,
    v_data
  )
  returning id into v_group_id;

  -- 3. A nova líder deixa de ser participante do café de origem.
  update participant_leader_history
     set end_date = v_data,
         reason = coalesce(reason || ' · ', '') || 'Passou a liderar o café ' || trim(p_cafe->>'name')
   where participant_id = p_new_leader_participant_id and end_date is null;

  update participants
     set current_leader_id = null, current_group_id = null, status = 'inativa', updated_at = now()
   where id = p_new_leader_participant_id;

  insert into participant_status_history (participant_id, status, changed_by, note)
  values (p_new_leader_participant_id, 'inativa', auth.uid(),
          'Multiplicou o café ' || v_origem.name || ': passou a liderar o café ' || trim(p_cafe->>'name'));

  -- 4. Quem vai junto.
  foreach v_pid in array coalesce(p_participant_ids, '{}') loop
    update participant_leader_history
       set end_date = v_data,
           reason = coalesce(reason || ' · ', '') || 'Foi para o café ' || trim(p_cafe->>'name') || ' (multiplicação)'
     where participant_id = v_pid and end_date is null;

    insert into participant_leader_history (participant_id, leader_id, group_id, start_date, changed_by, reason)
    values (v_pid, v_leader_id, v_group_id, v_data, auth.uid(),
            'Multiplicação do café ' || v_origem.name);

    update participants
       set current_leader_id = v_leader_id, current_group_id = v_group_id, updated_at = now()
     where id = v_pid;
  end loop;

  return v_group_id;
end;
$$;

revoke all on function app_multiply_cafe(uuid, uuid, uuid, jsonb, uuid[], date) from public, anon;
grant execute on function app_multiply_cafe(uuid, uuid, uuid, jsonb, uuid[], date) to authenticated;

-- Registrar multiplicações que aconteceram antes do sistema: apontar o café
-- de origem de um café que já existe. Recusa ciclo (um café não pode ser
-- "neto" dele mesmo).
create or replace function app_set_cafe_origin(p_group_id uuid, p_parent_group_id uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not app_is_people_manager() then
    raise exception 'Apenas a pastora ou a gestora de pessoas podem registrar uma multiplicação.'
      using errcode = '42501';
  end if;

  if p_parent_group_id is not null then
    if p_parent_group_id = p_group_id or exists (
      with recursive acima(id) as (
        select parent_group_id from groups where id = p_parent_group_id
        union
        select g.parent_group_id from groups g join acima a on g.id = a.id where g.parent_group_id is not null
      )
      select 1 from acima where id = p_group_id
    ) then
      raise exception 'Esse vínculo criaria um ciclo na árvore de multiplicação.';
    end if;
  end if;

  update groups
     set parent_group_id = p_parent_group_id,
         multiplied_at = case when p_parent_group_id is null then null else p_date end,
         updated_at = now()
   where id = p_group_id;
end;
$$;

revoke all on function app_set_cafe_origin(uuid, uuid, date) from public, anon;
grant execute on function app_set_cafe_origin(uuid, uuid, date) to authenticated;
