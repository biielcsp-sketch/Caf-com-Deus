-- Aviso às líderes quando o estudo do mês é publicado.
begin;
select plan(4);

select has_trigger('public', 'study_materials', 'study_materials_notify_leaders', 'gatilho de aviso existe');
select ok(
  (select prosecdef from pg_proc where oid = 'public.app_notify_study_published()'::regprocedure),
  'função é security definer'
);
select ok(
  (select proconfig::text like '%search_path%' from pg_proc where oid = 'public.app_notify_study_published()'::regprocedure),
  'função fixa o search_path'
);
select ok(
  not has_function_privilege('authenticated', 'public.app_notify_study_published()', 'execute'),
  'ninguém chama a função de gatilho pela API'
);

select * from finish();
rollback;
