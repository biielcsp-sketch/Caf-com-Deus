-- Mural aberto: toda pessoa logada vê as publicações de todos os cafés, como
-- um feed. Antes, cafe_photos_select limitava a admin, líder do café,
-- anfitriã do café e participantes daquele café.
--
-- Curtir e comentar já exigem só "enxergar a publicação" (EXISTS em
-- cafe_photos), então passam a valer para todo o mural sem outra mudança.
-- Apagar continua restrito: autora, líder do café e admin (policies de
-- DELETE intactas).
drop policy if exists cafe_photos_select on cafe_photos;
create policy cafe_photos_select on cafe_photos
  for select to authenticated using (true);

-- Nomes que o feed mostra ("Autora · Café"). As tabelas groups e profiles
-- continuam fechadas para participante: estas funções devolvem SÓ o nome da
-- autora da publicação e o nome do café, nada mais da linha.
create or replace function app_mural_names(p_photo_ids uuid[])
returns table (photo_id uuid, group_name text, author_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, g.name, pr.full_name
  from cafe_photos p
  left join groups g on g.id = p.group_id
  left join profiles pr on pr.id = p.author_profile_id
  where p.id = any (p_photo_ids)
    and auth.uid() is not null;
$$;

-- Nome de quem comentou, para os comentários de qualquer publicação.
create or replace function app_mural_comment_authors(p_comment_ids uuid[])
returns table (comment_id uuid, author_name text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, pr.full_name
  from cafe_photo_comments c
  left join profiles pr on pr.id = c.profile_id
  where c.id = any (p_comment_ids)
    and auth.uid() is not null;
$$;

revoke execute on function app_mural_names(uuid[]) from public, anon;
revoke execute on function app_mural_comment_authors(uuid[]) from public, anon;
grant execute on function app_mural_names(uuid[]) to authenticated;
grant execute on function app_mural_comment_authors(uuid[]) to authenticated;
