-- ============================================================================
-- Remoção do módulo de LGPD (decisão do usuário, 11/09/2026)
--
-- O que sai: o termo de consentimento versionado (`app_terms_versions`), a
-- fila de pedidos de exclusão (`data_erasure_requests`) e as três colunas de
-- consentimento de `participants`.
--
-- O que fica, e é a única coisa que o usuário quer manter: o registro de que
-- a pessoa que preencheu o formulário autorizou a equipe a entrar em contato.
-- Em vez de criar coluna nova e jogar fora o que já está gravado,
-- `consent_accepted_at` é RENOMEADA para `contact_authorized_at` — mesmo dado,
-- nome que diz o que ele realmente é agora.
--
-- `anonymized_at` FICA. A decisão de produto foi manter o botão "Excluir
-- participante" limpando os dados pessoais e preservando a jornada — some o
-- vocabulário de LGPD das telas, não o comportamento, que é o que protege o
-- histórico de presença dos encontros.
-- ============================================================================

-- ── participants ───────────────────────────────────────────────────────────
alter table participants rename column consent_accepted_at to contact_authorized_at;
alter table participants drop column consent_version;
alter table participants drop column consent_method;

-- ── trigger de autoatendimento ─────────────────────────────────────────────
-- Lista as colunas que a participante NÃO pode mexer. Precisa ser recriada
-- porque citava as três colunas de consentimento; `contact_authorized_at`
-- entra no lugar (ela não pode revogar nem forjar a própria autorização pela
-- tela de autoatendimento).
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

-- ── tabelas de LGPD ────────────────────────────────────────────────────────
-- As policies de RLS de cada uma vão junto no drop.
drop table if exists data_erasure_requests;
drop table if exists app_terms_versions;

-- ── rate limit da solicitação de exclusão ──────────────────────────────────
-- A fila de solicitações deixou de existir, então a função que a protegia
-- não tem mais chamador.
drop function if exists app_check_erasure_rate_limit(text);
