do $$
declare f text;
begin
  foreach f in array array[
    'app_notify_new_assignment()',
    'app_notifications_push_trigger()',
    'app_participant_visitor_after()'
  ] loop
    if to_regprocedure('public.' || f) is not null then
      execute format('grant execute on function public.%s to public', f);
    end if;
  end loop;
  if to_regprocedure('public.app_participant_visitor_before()') is not null then
    alter function public.app_participant_visitor_before() reset search_path;
  end if;
end $$;
