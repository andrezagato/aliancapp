-- WS1.2 Fase 1 — Repositório de arquivos por evento.
-- Guarda o link de uma pasta compartilhada (OneDrive) do culto. Coluna aditiva,
-- nullable — sem impacto em dados existentes. Quem seta = admin/Produção (server
-- action definirPastaArquivos); todos os escalados veem o link no cronograma.
alter table public.events
  add column if not exists files_url text;
