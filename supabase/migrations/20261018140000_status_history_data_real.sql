-- Data real da mudança de situação da participante.
--
-- O histórico mostrava sempre a data do lançamento: quem registrava hoje que
-- a participante saiu do café no mês passado ficava com a data de hoje no
-- histórico. `effective_date` guarda a data em que aconteceu, quando
-- informada; vazia, vale a data do lançamento (created_at).
alter table participant_status_history
  add column if not exists effective_date date;

comment on column participant_status_history.effective_date is
  'Data em que a mudança aconteceu de fato, quando informada (lançamento retroativo). Vazio = a data do lançamento (created_at).';
