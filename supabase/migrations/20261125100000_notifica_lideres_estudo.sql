-- Avisa as líderes (líder e co-líder ativas) quando a pastora publica um
-- estudo do mês. A notificação nasce aqui e o push no celular sai pelo
-- gatilho que já existe em `notifications` (app_notifications_push_trigger).
create or replace function app_notify_study_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (profile_id, type, title, body, link)
  select p.id,
         'estudo_publicado',
         'Novo estudo do mês',
         'O estudo "' || new.title || '" já está disponível no Feed.',
         '/feed'
  from profiles p
  where p.role in ('lider', 'co_lider')
    and p.active;
  return new;
end;
$$;

revoke execute on function app_notify_study_published() from public, anon, authenticated;

drop trigger if exists study_materials_notify_leaders on study_materials;
create trigger study_materials_notify_leaders
  after insert on study_materials
  for each row execute function app_notify_study_published();
