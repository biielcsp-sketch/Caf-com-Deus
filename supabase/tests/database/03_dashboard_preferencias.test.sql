-- Preferências do Dashboard: tabela existe, RLS ligada e fechada para anon.
begin;
select plan(5);

select has_table('public', 'dashboard_preferences', 'dashboard_preferences existe');
select has_column('public', 'dashboard_preferences', 'indicadores', 'coluna indicadores existe');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.dashboard_preferences'::regclass),
  'RLS ligada em dashboard_preferences'
);
select ok(
  not has_table_privilege('anon', 'public.dashboard_preferences', 'select'),
  'anon não lê preferências'
);
select ok(
  (select count(*) from pg_policies where tablename = 'dashboard_preferences') = 3,
  'três políticas, todas do próprio dono'
);

select * from finish();
rollback;
