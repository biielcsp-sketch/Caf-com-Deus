-- Motivo da inatividade (o "regularidade" do PPT de melhorias).
-- Um campo só junto da situação: preenchido quando a participante fica
-- Inativa, limpo quando volta. Valores em lib/inactive-reasons.ts.
alter table participants
  add column if not exists inactive_reason text;

alter table participants
  add constraint participants_inactive_reason_check
  check (inactive_reason is null or inactive_reason in (
    'saiu_do_cafe', 'saiu_da_igreja', 'foi_para_outro_cafe',
    'multiplicou_o_cafe', 'sem_disponibilidade', 'outra_lagoinha'
  ));
