-- Editar e excluir acompanhamento (pastora, Gestora de Pessoas e
-- desenvolvedor — pedido de 17/10/2026).
--
-- "Excluir" aqui é esconder: a linha fica, com quem e quando excluiu. O
-- CLAUDE.md proíbe DELETE em follow_ups; e um acompanhamento apagado de verdade
-- some também dos relatórios de períodos já fechados. A policy de UPDATE que
-- já existe (app_is_admin() ou líder responsável) cobre as duas operações.
alter table follow_ups
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references profiles(id);
