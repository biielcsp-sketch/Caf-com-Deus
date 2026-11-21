-- Funções security definer do schema public:
--  - precisam fixar o search_path (evita sequestro de função);
--  - anon só executa as de limite de tentativas e auditoria de login/cadastro.
begin;
select plan(2);

select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%') $$,
  'toda função security definer fixa o search_path'
);

select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and has_function_privilege('anon', p.oid, 'execute')
       and p.proname not in ('app_check_login_rate_limit', 'app_check_claim_account_rate_limit',
                             'app_log_auth_event', 'app_check_public_enrollment_rate_limit') $$,
  'anon só executa as funções públicas permitidas'
);

select * from finish();
rollback;
