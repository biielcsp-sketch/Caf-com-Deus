-- Notificação no celular (Web Push).
--
-- Fluxo: toda linha nova em `notifications` dispara, pelo pg_net, um POST para
-- /api/push/dispatch no app (Netlify). A rota confere o segredo, busca os
-- aparelhos de quem deve receber (push_subscriptions) e envia o push com as
-- chaves VAPID, que só existem nas variáveis do Netlify. Uma rotina a cada 5
-- minutos repete o POST para o que não saiu (app fora do ar, falha de rede).
--
-- O endereço do app e o segredo do POST ficam no Vault do Supabase
-- (`push_dispatch_url`, `push_dispatch_secret`) — nunca no código nem nesta
-- migration. O mesmo segredo está no Netlify como PUSH_DISPATCH_SECRET.

create extension if not exists pg_net;

-- Aparelhos inscritos. Uma pessoa pode ter vários (celular e computador).
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists push_subscriptions_profile_idx on push_subscriptions (profile_id);

alter table push_subscriptions enable row level security;

-- Cada pessoa vê, cadastra e remove só os próprios aparelhos. O envio é feito
-- pelo servidor com service_role, que não passa por aqui.
create policy push_subscriptions_own_select on push_subscriptions
  for select using (profile_id = auth.uid());
create policy push_subscriptions_own_insert on push_subscriptions
  for insert with check (profile_id = auth.uid());
create policy push_subscriptions_own_update on push_subscriptions
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy push_subscriptions_own_delete on push_subscriptions
  for delete using (profile_id = auth.uid());

grant select, insert, update, delete on push_subscriptions to authenticated;

-- Controle de envio do push por notificação.
alter table notifications
  add column if not exists pushed_at timestamptz,
  add column if not exists push_attempts int not null default 0;

-- Dispara o POST. `ids` vazio = varredura do que ficou para trás.
create or replace function app_push_dispatch(p_ids uuid[] default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_dispatch_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_dispatch_secret';
  if v_url is null or v_secret is null then
    return; -- push ainda não configurado: as notificações continuam no app
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body := jsonb_build_object('ids', coalesce(to_jsonb(p_ids), '[]'::jsonb)),
    timeout_milliseconds := 10000
  );
end;
$$;

revoke all on function app_push_dispatch(uuid[]) from public, anon, authenticated;

create or replace function app_notifications_push_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform app_push_dispatch(array[new.id]);
  return new;
exception when others then
  -- Push nunca impede a notificação de ser gravada.
  return new;
end;
$$;

create trigger notifications_push_after_insert
  after insert on notifications
  for each row execute function app_notifications_push_trigger();

select cron.schedule('push-varredura', '*/5 * * * *', $$select public.app_push_dispatch(null)$$);
