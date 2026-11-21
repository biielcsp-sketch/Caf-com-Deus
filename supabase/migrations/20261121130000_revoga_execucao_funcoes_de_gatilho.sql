-- Funções de gatilho não precisam ser chamáveis por ninguém via API (/rest/v1/rpc).
-- Achado do teste pgTAP e do Supabase Advisors: anon e authenticated podiam executá-las.
-- Bloco condicional: a função de visitante veio de uma migration anterior que pode não existir
-- num banco criado do zero.
do $$
declare f text;
begin
  foreach f in array array[
    'app_notify_new_assignment()',
    'app_notifications_push_trigger()',
    'app_participant_visitor_after()'
  ] loop
    if to_regprocedure('public.' || f) is not null then
      execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    end if;
  end loop;

  if to_regprocedure('public.app_participant_visitor_before()') is not null then
    alter function public.app_participant_visitor_before() set search_path = public;
  end if;
end $$;
