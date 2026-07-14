-- =============================================================================
-- Servir — seed de PRODUÇÃO/CLOUD (dados iniciais da igreja do André)
--
-- Diferente de seed.sql (que é do dev LOCAL e insere auth.users fake). Aqui NÃO
-- criamos usuários: no cloud o login é via Google e o profile nasce no 1º login
-- pelo trigger handle_new_user. Este seed cria a igreja, o convite de admin e um
-- ponto de partida (equipes, posições, série e um culto com requisitos abertos)
-- pra que o app já esteja "vivo" no primeiro acesso. Tudo editável pelo admin.
--
-- Idempotente: pode rodar de novo sem duplicar (PKs fixas + guards).
-- =============================================================================

-- ---- Igreja ----
insert into churches (id, name, join_code, timezone) values
  ('11111111-1111-1111-1111-111111111111', 'Aliança', 'ALIANCA', 'America/Sao_Paulo')
on conflict (id) do nothing;

-- ---- Convite de ADMIN (troque o email pelo Google que o André vai usar) ----
insert into invites (church_id, email, full_name, system_role, status)
select '11111111-1111-1111-1111-111111111111', 'andrezagato@gmail.com', 'André Zagato', 'admin', 'pendente'
where not exists (
  select 1 from invites where lower(email) = lower('andrezagato@gmail.com') and status = 'pendente'
);

-- ---- Equipes ----
insert into teams (id, church_id, name, color, icon, sort_order) values
  ('22222222-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Louvor',    '#C4633E', 'music',      1),
  ('22222222-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Som',       '#5B6B4E', 'sliders',    2),
  ('22222222-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Mídia',     '#7C6BAF', 'video',      3),
  ('22222222-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Recepção',  '#B0894A', 'hand-heart', 4),
  ('22222222-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Kids',      '#4E86A6', 'baby',       5)
on conflict (id) do nothing;

-- ---- Posições por equipe ----
insert into positions (id, team_id, name, sort_order) values
  -- Louvor
  ('33333333-0000-0001-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'Vocal',       1),
  ('33333333-0000-0001-0000-000000000002', '22222222-0000-0000-0000-000000000001', 'Guitarra',    2),
  ('33333333-0000-0001-0000-000000000003', '22222222-0000-0000-0000-000000000001', 'Baixo',       3),
  ('33333333-0000-0001-0000-000000000004', '22222222-0000-0000-0000-000000000001', 'Bateria',     4),
  ('33333333-0000-0001-0000-000000000005', '22222222-0000-0000-0000-000000000001', 'Teclado',     5),
  -- Som
  ('33333333-0000-0002-0000-000000000001', '22222222-0000-0000-0000-000000000002', 'Mesa de som', 1),
  ('33333333-0000-0002-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'Monitor',     2),
  -- Mídia
  ('33333333-0000-0003-0000-000000000001', '22222222-0000-0000-0000-000000000003', 'Projeção',    1),
  ('33333333-0000-0003-0000-000000000002', '22222222-0000-0000-0000-000000000003', 'Transmissão', 2),
  ('33333333-0000-0003-0000-000000000003', '22222222-0000-0000-0000-000000000003', 'Fotografia',  3),
  -- Recepção
  ('33333333-0000-0004-0000-000000000001', '22222222-0000-0000-0000-000000000004', 'Porta',       1),
  ('33333333-0000-0004-0000-000000000002', '22222222-0000-0000-0000-000000000004', 'Ofertas',     2),
  -- Kids
  ('33333333-0000-0005-0000-000000000001', '22222222-0000-0000-0000-000000000005', 'Professor',   1),
  ('33333333-0000-0005-0000-000000000002', '22222222-0000-0000-0000-000000000005', 'Auxiliar',    2)
on conflict (id) do nothing;

-- ---- Série recorrente ----
insert into event_series (id, church_id, title, weekday, start_time, location) values
  ('44444444-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Culto de Domingo', 0, '18:00', 'Templo')
on conflict (id) do nothing;

-- ---- Modelo: equipes que servem nesse culto (series_teams) ----
insert into series_teams (series_id, team_id) values
  ('44444444-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001'),
  ('44444444-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000002'),
  ('44444444-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000003'),
  ('44444444-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000004')
on conflict do nothing;

-- ---- Template da série (series_requirements) ----
insert into series_requirements (series_id, team_id, position_id, needed_count) values
  ('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', '33333333-0000-0001-0000-000000000001', 2),
  ('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', '33333333-0000-0001-0000-000000000002', 1),
  ('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', '33333333-0000-0001-0000-000000000004', 1),
  ('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', '33333333-0000-0002-0000-000000000001', 1),
  ('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003', '33333333-0000-0003-0000-000000000001', 1),
  ('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000004', '33333333-0000-0004-0000-000000000001', 2)
on conflict (series_id, position_id) do nothing;

-- ---- Ocorrência: próximo domingo 18h (horário de São Paulo) ----
insert into events (id, church_id, series_id, title, starts_at, location)
select
  '55555555-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  '44444444-0000-0000-0000-000000000001',
  'Culto de Domingo',
  ((d.today + (case when extract(dow from d.today)::int = 0 then 7
                    else 7 - extract(dow from d.today)::int end) * interval '1 day')::date
   + interval '18 hours') at time zone 'America/Sao_Paulo',
  'Templo'
from (select (now() at time zone 'America/Sao_Paulo')::date as today) d
on conflict (id) do nothing;

-- ---- Requisitos efetivos do culto (o "denominador" da cobertura) ----
insert into event_requirements (event_id, team_id, position_id, needed_count, status) values
  ('55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', '33333333-0000-0001-0000-000000000001', 2, 'needed'),
  ('55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', '33333333-0000-0001-0000-000000000002', 1, 'needed'),
  ('55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', '33333333-0000-0001-0000-000000000003', 1, 'needed'),
  ('55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', '33333333-0000-0001-0000-000000000004', 1, 'needed'),
  ('55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', '33333333-0000-0002-0000-000000000001', 1, 'needed'),
  ('55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003', '33333333-0000-0003-0000-000000000001', 1, 'needed'),
  ('55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000004', '33333333-0000-0004-0000-000000000001', 2, 'needed')
on conflict (event_id, position_id) do nothing;
