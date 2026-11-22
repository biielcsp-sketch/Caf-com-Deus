-- "Ver como esta pessoa": tabela de registro fechada para quem não é o backend.
begin;
select plan(6);

select has_table('public', 'impersonation_sessions', 'impersonation_sessions existe');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.impersonation_sessions'::regclass),
  'RLS ligada em impersonation_sessions'
);
select ok(
  not has_table_privilege('anon', 'public.impersonation_sessions', 'select'),
  'anon não lê o registro'
);
select ok(
  not has_table_privilege('authenticated', 'public.impersonation_sessions', 'insert'),
  'authenticated não grava o registro'
);
select ok(
  not has_table_privilege('authenticated', 'public.impersonation_sessions', 'update'),
  'authenticated não altera o registro'
);
select ok(
  (select count(*) from pg_policies where tablename = 'impersonation_sessions') = 1,
  'uma única política, de leitura só para Desenvolvedor'
);

select * from finish();
rollback;
