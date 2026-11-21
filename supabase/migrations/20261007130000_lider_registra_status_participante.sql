-- A líder passa a mudar o status da jornada das PRÓPRIAS participantes
-- (ativa / acompanhamento / inativa). O UPDATE em `participants` ela já tinha
-- (participants_update); o que faltava era gravar a transição em
-- participant_status_history, que só aceitava admin e a gestora — sem isto o
-- status mudava mas a gravação do histórico falhava.
-- Mesmo molde de pcsh_leader_insert (histórico do status de contato).
create policy psh_leader_insert on participant_status_history
  for insert to authenticated
  with check (
    app_is_responsible_for_participant(participant_id)
    and changed_by = auth.uid()
  );
