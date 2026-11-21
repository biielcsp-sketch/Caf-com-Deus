-- Alerta de nova participante para a líder + prazo de 3 dias para o contato.
--
-- Quando uma participante é distribuída ou redistribuída para uma líder, a
-- líder recebe um aviso e precisa confirmar no app que já fez o contato. Se
-- passar de 3 dias sem confirmação, a líder recebe o aviso de novo e a
-- pastora e a Gestora de Pessoas também são avisadas.
--
-- O prazo é contado a partir do vínculo (participant_leader_history), que é
-- onde distribuição, redistribuição e devolução já registram tudo. A
-- confirmação mora na mesma linha: um vínculo novo começa sem confirmação,
-- e trocar de líder de novo recomeça o prazo com a líder nova.

-- 1. Confirmação de contato no vínculo ---------------------------------------
alter table participant_leader_history
  add column if not exists contact_confirmed_at timestamptz,
  add column if not exists contact_confirmed_by uuid references profiles(id),
  add column if not exists contact_escalated_at timestamptz;

-- Vínculos que já existiam antes desta versão não entram na regra: são
-- participantes que já estão nos cafés há dias ou semanas, e marcá-las todas
-- como "sem contato" encheria os painéis de falso alerta (foi o que aconteceu
-- com o "Sem acompanhamento recente" na v72).
update participant_leader_history
   set contact_confirmed_at = created_at
 where contact_confirmed_at is null;

create index if not exists plh_contato_pendente_idx
  on participant_leader_history (created_at)
  where end_date is null and contact_confirmed_at is null;

-- 2. Notificações dentro do app ----------------------------------------------
-- A tabela `notifications` existe desde o schema inicial (26/08) e nunca foi
-- usada (0 linhas). Reaproveitada: `type`, `title`, `body`, `read` já estão
-- lá, e as policies também (cada pessoa lê e marca as próprias; admin lê
-- todas). Entram só o link para onde o aviso leva e a participante a que ele
-- se refere — esta última para apagar o aviso quando o contato é confirmado.
alter table notifications
  add column if not exists link text,
  add column if not exists participant_id uuid references participants(id);

create index if not exists notifications_profile_recent_idx
  on notifications (profile_id, created_at desc);

-- 3. Aviso para a líder no momento do vínculo ---------------------------------
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

  -- A própria líder cadastrou, ou a pessoa se inscreveu pelo link da líder:
  -- o contato já aconteceu (foi a líder que trouxe a pessoa). Não há prazo.
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

create trigger plh_notify_new_assignment
  before insert on participant_leader_history
  for each row execute function app_notify_new_assignment();

-- 4. A líder confirma o contato -------------------------------------------------
-- Só a líder ATUAL da participante (ou pastora/desenvolvedor/gestora) confirma.
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
  get diagnostics v_linhas = row_count;

  -- Avisos de "sem contato" desta participante deixam de fazer sentido.
  if v_linhas > 0 then
    update notifications
       set read = true
     where participant_id = p_participant_id
       and type in ('nova_participante', 'contato_atrasado_lider', 'contato_atrasado_gestao');
  end if;
end;
$$;

revoke all on function app_confirm_participant_contact(uuid) from public, anon;
grant execute on function app_confirm_participant_contact(uuid) to authenticated;

-- 5. Rotina diária: passou de 3 dias sem confirmação ----------------------------
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

revoke all on function app_escalate_pending_contacts() from public, anon, authenticated;
