-- Gestora de Pessoas passa a ter o mesmo perfil da pastora (decisão do
-- Gabriel, 17/10/2026). Muda só o nome do papel.
--
-- Até a v73 a gestora tinha um portão próprio e mais estreito
-- (app_is_people_manager(): participantes, vínculos, histórico de status,
-- líderes e cafés). Agora ela entra no mesmo portão da pastora e do
-- desenvolvedor, que é o que governa todas as policies administrativas —
-- inclusive acompanhamentos de qualquer líder (incluir, editar, excluir),
-- contas, configurações e auditoria.
--
-- app_is_people_manager() continua existindo e continua incluindo os três
-- papéis; as policies "_people_manager_" ficam redundantes, mas inofensivas.
create or replace function public.app_is_admin()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from profiles
     where id = auth.uid()
       and role in ('admin', 'desenvolvedor', 'gestora_de_pessoas')
  );
$function$;
