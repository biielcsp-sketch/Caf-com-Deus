drop function if exists app_mural_names(uuid[]);
drop function if exists app_mural_comment_authors(uuid[]);
drop policy if exists cafe_photos_select on cafe_photos;
create policy cafe_photos_select on cafe_photos
  for select using (
    app_is_admin()
    or exists (select 1 from groups g where g.id = cafe_photos.group_id and g.leader_id = app_current_leader_id())
    or group_id = app_hosted_group_id()
    or group_id = (select participants.current_group_id from participants where participants.id = app_current_participant_id())
  );
