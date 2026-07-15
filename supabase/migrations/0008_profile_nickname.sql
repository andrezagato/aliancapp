-- Apelido (nickname) da pessoa — ex.: "Maui" para "Gabriel Oliveira".
-- Aditivo e nullable: não toca dados existentes nem quebra queries antigas.
-- A própria pessoa preenche no Perfil (helper displayName usa nickname || full_name).
alter table public.profiles add column if not exists nickname text;
