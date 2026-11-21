-- ============================================================================
-- Revisão v41 — itens 2.1, 2.2 e 2.6
--
-- 2.1 / 2.2: as funções SECURITY DEFINER de rate limit e de log de auth
-- estavam com EXECUTE para `anon` (e, em duas delas, via privilégio default
-- de PUBLIC, mesmo tendo sido concedidas só a `authenticated` na S4). Como
-- a chave `anon` é publicada no navegador, isso deixava qualquer pessoa da
-- internet:
--   * chamar app_check_login_rate_limit('email-da-vitima') dez vezes e
--     trancar o login daquela pessoa por 5 minutos, em loop, indefinidamente;
--   * inserir linhas arbitrárias em auth_audit_log — inclusive um
--     `login_success` forjado no nome de qualquer profile_id — destruindo a
--     confiabilidade do log que a S5 existe para criar.
--
-- A correção é tirar EXECUTE de todo mundo e deixar só `service_role`: os
-- únicos callers do app são lib/rate-limit.ts e auth-audit.service.ts, que
-- passaram a usar o client admin (server-only) nesta mesma mudança. O
-- caminho pré-autenticado continua funcionando porque quem chama é o
-- servidor, não o navegador.
--
-- 2.6: confirmDistribution fazia três escritas em sequência sem transação —
-- se a segunda falhasse depois da primeira, a participante ficava sem
-- nenhum vínculo aberto (estado que a constraint one_open_assignment não
-- detecta: ela impede dois abertos, não zero). Vira uma função, que no
-- Postgres é atômica por natureza. SECURITY INVOKER de propósito: a RLS
-- continua sendo a barreira real (só admin escreve em
-- participant_leader_history), exatamente como antes.
-- ============================================================================

-- ── 2.1 · rate limit: só service_role ──────────────────────────────────────
revoke execute on function app_check_login_rate_limit(text) from public, anon, authenticated;
revoke execute on function app_check_claim_account_rate_limit(text) from public, anon, authenticated;
revoke execute on function app_check_erasure_rate_limit(text) from public, anon, authenticated;
revoke execute on function app_check_participant_write_rate_limit(text) from public, anon, authenticated;
revoke execute on function app_check_public_enrollment_rate_limit(text) from public, anon, authenticated;

grant execute on function app_check_login_rate_limit(text) to service_role;
grant execute on function app_check_claim_account_rate_limit(text) to service_role;
grant execute on function app_check_erasure_rate_limit(text) to service_role;
grant execute on function app_check_participant_write_rate_limit(text) to service_role;
grant execute on function app_check_public_enrollment_rate_limit(text) to service_role;

-- ── 2.2 · log de auth: só service_role ─────────────────────────────────────
revoke execute on function app_log_auth_event(uuid, auth_audit_event, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function app_log_auth_event(uuid, auth_audit_event, text, text, jsonb)
  to service_role;

-- ── 2.6 · distribuição atômica ─────────────────────────────────────────────
create or replace function app_confirm_distribution(
  p_participant_id uuid,
  p_leader_id uuid,
  p_group_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Fecha o vínculo aberto anterior, se houver. Sem transferência de líder
  -- isso não acha nada e segue — é defensivo, não obrigatório.
  update participant_leader_history
     set end_date = current_date
   where participant_id = p_participant_id
     and end_date is null;

  insert into participant_leader_history (participant_id, leader_id, group_id, changed_by)
  values (p_participant_id, p_leader_id, p_group_id, auth.uid());

  insert into participant_status_history (participant_id, status, changed_by)
  values (p_participant_id, 'distribuida', auth.uid());

  update participants
     set current_leader_id = p_leader_id,
         current_group_id = p_group_id,
         status = 'distribuida',
         updated_at = now()
   where id = p_participant_id;

  -- Se a RLS bloqueou o UPDATE acima (líder tentando distribuir), nenhuma
  -- linha é afetada e o resto já teria falhado antes — mas a checagem
  -- explícita evita "sucesso" silencioso num caso não previsto.
  if not found then
    raise exception 'permission denied for table participants'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function app_confirm_distribution(uuid, uuid, uuid) from public;
grant execute on function app_confirm_distribution(uuid, uuid, uuid) to authenticated, service_role;
