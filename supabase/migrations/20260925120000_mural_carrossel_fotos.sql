-- Mural: carrossel de fotos (estilo Instagram, até 5 fotos por publicação).
--
-- Continua sendo uma linha por arquivo em `cafe_photos`. A publicação em si
-- é sempre a primeira linha (parent_media_id nulo); as fotos extras do
-- carrossel são linhas filhas apontando para ela. Curtidas e comentários
-- continuam presos ao id da linha-pai — o carrossel inteiro compartilha uma
-- única curtida/discussão, como no Instagram.
--
-- Vídeo nunca vira linha-pai de outra: publicação de vídeo é sempre uma
-- linha sozinha, sem filhas. Isso é garantido pela camada de aplicação
-- (lib/services/cafe-media.service.ts), não aqui.

alter table cafe_photos
  add column if not exists parent_media_id uuid references cafe_photos(id) on delete cascade,
  add column if not exists sort_order smallint not null default 0;

create index if not exists cafe_photos_parent_idx on cafe_photos (parent_media_id);

-- RLS: nenhuma política nova. As já existentes (cafe_photos_select/insert/
-- delete) decidem por group_id e author_profile_id, colunas que toda linha
-- filha também carrega — cobrem o carrossel sem alteração.
