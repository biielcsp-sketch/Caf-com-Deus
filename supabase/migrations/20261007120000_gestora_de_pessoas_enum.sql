-- Novo papel "Gestora de Pessoas": responsável por distribuir as novas
-- participantes e redistribuir membras. Separado da migration seguinte porque o
-- Postgres não deixa usar um valor de enum recém-criado na mesma transação.
alter type user_role add value if not exists 'gestora_de_pessoas';
