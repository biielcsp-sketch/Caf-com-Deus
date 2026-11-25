-- Mural como rede social: (1) a publicação mostra a foto de quem publicou e
-- (2) participante também publica, no próprio café.

-- 1) A função de nomes passa a devolver também o caminho da foto de perfil.
-- Mudou o formato do retorno, então não dá para `create or replace`.
-- O caminho (não a imagem) é tudo que sai daqui: o bucket `avatars` continua
-- privado e quem assina a URL é o servidor, só para as autoras de
-- publicações que a própria pessoa já pode ver.
drop function if exists app_mural_names(uuid[]);
create function app_mural_names(p_photo_ids uuid[])
returns table (photo_id uuid, group_name text, author_name text, author_avatar_path text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, g.name, pr.full_name, pr.avatar_url
  from cafe_photos p
  left join groups g on g.id = p.group_id
  left join profiles pr on pr.id = p.author_profile_id
  where p.id = any (p_photo_ids)
    and auth.uid() is not null;
$$;

revoke execute on function app_mural_names(uuid[]) from public, anon;
grant execute on function app_mural_names(uuid[]) to authenticated;

-- 2) Participante publica no café em que está. Os outros ramos são os
-- mesmos de antes (admin e líder do café). Participante excluída
-- (anonimizada), com exclusão lógica ou inativa não publica.
drop policy if exists cafe_photos_insert on cafe_photos;
create policy cafe_photos_insert on cafe_photos
  for insert to authenticated
  with check (
    author_profile_id = auth.uid()
    and (
      app_is_admin()
      or exists (
        select 1 from groups g
        where g.id = cafe_photos.group_id and g.leader_id = app_current_leader_id()
      )
      or group_id = (
        select p.current_group_id
        from participants p
        where p.id = app_current_participant_id()
          and p.deleted_at is null
          and p.anonymized_at is null
          and p.status <> 'inativa'
      )
    )
  );
