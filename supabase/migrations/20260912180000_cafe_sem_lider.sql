-- Café pode ficar temporariamente sem líder.
--
-- `groups.leader_id` nasceu `not null`, então excluir uma líder que tinha
-- café era impossível por construção: a FK é "no action" e a coluna não
-- aceitava nulo — não havia para onde apontar o café enquanto outra líder
-- não assumisse. A saída anterior era bloquear a exclusão e mandar a pastora
-- transferir o café antes, o que na prática travava o fluxo dela.
--
-- Agora o café aceita ficar órfão por um tempo. Isso é de propósito um
-- estado VISÍVEL, não silencioso: a tela de cafés marca "Sem líder" e a
-- ficha do café abre com um aviso. E é um estado sem efeito colateral: o
-- café some da distribuição automática (ela varre líderes, e um café sem
-- líder não está pendurado em nenhuma), e o agendamento de encontro recusa
-- com mensagem clara, porque `meetings.leader_id` continua obrigatório.
--
-- Nenhuma linha nova é criada para representar "sem líder" — nada de líder
-- fantasma nem de café duplicado. É só o ponteiro ficando nulo.
alter table groups alter column leader_id drop not null;

comment on column groups.leader_id is
  'Líder responsável pelo café. Aceita nulo: quando a líder é excluída, o café fica sem responsável até a pastora atribuir outra. Estado sinalizado na interface (lista e ficha do café).';
