-- Indicadores escolhidos pela pessoa no Dashboard ("Personalizar").
-- Uma linha por pessoa; a escolha acompanha a conta em qualquer aparelho.
-- Os ids dos indicadores são validados no app (lista fixa), não aqui.

create table if not exists dashboard_preferences (
  profile_id uuid primary key references profiles(id) on delete cascade,
  indicadores text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table dashboard_preferences enable row level security;

create policy dashboard_preferences_own_select on dashboard_preferences
  for select using (profile_id = auth.uid());
create policy dashboard_preferences_own_insert on dashboard_preferences
  for insert with check (profile_id = auth.uid());
create policy dashboard_preferences_own_update on dashboard_preferences
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

grant select, insert, update on dashboard_preferences to authenticated;
