-- Mural: foto do autor na função de nomes e participante publicando.
begin;
select plan(5);

select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'app_mural_names'
      and pg_get_function_result(p.oid) like '%author_avatar_path%'
  ),
  'app_mural_names devolve o caminho da foto do autor'
);
select ok(
  not has_function_privilege('anon', 'public.app_mural_names(uuid[])', 'execute'),
  'anon continua sem chamar app_mural_names'
);
select ok(
  has_function_privilege('authenticated', 'public.app_mural_names(uuid[])', 'execute'),
  'logada chama app_mural_names'
);
select is(
  (select roles::text from pg_policies where tablename = 'cafe_photos' and policyname = 'cafe_photos_insert'),
  '{authenticated}',
  'inserir publicação é só para logadas'
);
select ok(
  (select with_check from pg_policies where tablename = 'cafe_photos' and policyname = 'cafe_photos_insert')
    like '%app_current_participant_id%',
  'a política de inserir reconhece a participante do café'
);

select * from finish();
rollback;
