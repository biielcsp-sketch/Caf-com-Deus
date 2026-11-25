-- Mural aberto: leitura para qualquer logada; funções de nome só para logadas.
begin;
select plan(5);

select is(
  (select qual from pg_policies where tablename = 'cafe_photos' and policyname = 'cafe_photos_select'),
  'true',
  'qualquer pessoa logada lê as publicações do mural'
);
select is(
  (select roles::text from pg_policies where tablename = 'cafe_photos' and policyname = 'cafe_photos_select'),
  '{authenticated}',
  'a leitura é só para logadas, não para anon'
);
select ok(
  not has_function_privilege('anon', 'public.app_mural_names(uuid[])', 'execute'),
  'anon não chama app_mural_names'
);
select ok(
  has_function_privilege('authenticated', 'public.app_mural_names(uuid[])', 'execute'),
  'logada chama app_mural_names'
);
select ok(
  (select count(*) from pg_policies where tablename = 'cafe_photos' and cmd = 'DELETE' and qual not like '%true%') = 1,
  'apagar continua restrito (autora, líder do café, admin)'
);

select * from finish();
rollback;
