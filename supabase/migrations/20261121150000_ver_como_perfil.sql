-- "Ver como esta pessoa" (só perfil Desenvolvedor): registro de cada entrada
-- na conta de outra pessoa.
--
-- A linha serve a duas coisas: auditoria (quem entrou como quem, quando e de
-- onde) e controle da volta. O cookie do navegador guarda só o id desta linha
-- (opaco, httpOnly); é por ele que o servidor descobre qual desenvolvedor deve
-- reassumir a sessão ao clicar em "Voltar". Por isso a linha é de uso único
-- (ended_at) e vence em 8 horas.
--
-- Escrita só pelo backend (service_role). Leitura só para Desenvolvedor.

create table if not exists impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references profiles(id) on delete cascade,
  -- Nulo se a conta visitada for excluída depois; o nome fica no registro.
  target_id uuid references profiles(id) on delete set null,
  target_name text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ip_address text,
  user_agent text
);

create index if not exists impersonation_sessions_developer_idx
  on impersonation_sessions (developer_id, started_at desc);
create index if not exists impersonation_sessions_target_idx
  on impersonation_sessions (target_id);

alter table impersonation_sessions enable row level security;

revoke all on impersonation_sessions from anon, authenticated;
grant select on impersonation_sessions to authenticated;

create policy impersonation_sessions_developer_select on impersonation_sessions
  for select to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'desenvolvedor'
    )
  );
