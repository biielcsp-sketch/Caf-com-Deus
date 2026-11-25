drop function if exists app_mural_names(uuid[]);
create function app_mural_names(p_photo_ids uuid[])
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
revoke execute on function app_mural_names(uuid[]) from public, anon;
grant execute on function app_mural_names(uuid[]) to authenticated;

drop policy if exists cafe_photos_insert on cafe_photos;
create policy cafe_photos_insert on cafe_photos
  for insert with check (
    author_profile_id = auth.uid()
    and (
      app_is_admin()
      or exists (select 1 from groups g where g.id = cafe_photos.group_id and g.leader_id = app_current_leader_id())
    )
  );
