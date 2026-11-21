-- Roda de hora em hora a escalada dos contatos pendentes (prazo de 3 dias).
-- De hora em hora, e não uma vez por dia, para o aviso sair perto do momento
-- em que o prazo vence. A função é idempotente: cada vínculo escala uma vez só
-- (participant_leader_history.contact_escalated_at).
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
select cron.schedule('escalar-contatos-pendentes', '0 * * * *', $$select public.app_escalate_pending_contacts()$$);
