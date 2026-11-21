-- Colunas e rotinas da v76/v77 existem e estão protegidas.
-- (O comportamento com dados — status que baixa o contato, lembrete de
-- visitante — é coberto pelo teste manual descrito em CLAUDE.md até existir
-- uma fixture de participantes neste banco de teste.)
begin;
select plan(7);

select has_column('public', 'participants', 'is_visitor', 'participants.is_visitor existe');
select has_column('public', 'participants', 'church_status', 'participants.church_status existe');
select has_column('public', 'participants', 'cep', 'participants.cep existe');
select has_function('public', 'app_confirm_visitor_contact', array['uuid'], 'confirmar contato de visitante existe');
select has_trigger('public', 'participants', 'participants_confirm_contact_on_status', 'status baixa o contato pendente');

select ok(
  not has_function_privilege('anon', 'public.app_confirm_visitor_contact(uuid)', 'execute'),
  'anon não confirma contato de visitante'
);
select ok(
  not has_function_privilege('anon', 'public.app_remind_visitor_contacts()', 'execute'),
  'anon não roda o lembrete de visitantes'
);

select * from finish();
rollback;
