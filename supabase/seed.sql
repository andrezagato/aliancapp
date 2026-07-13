-- =============================================================================
-- Servir — seed de DEMONSTRAÇÃO (dev local)
-- Roda com `supabase db reset`. Cria igreja, equipes, pessoas fake e um culto.
-- Login real é via OAuth; as senhas abaixo servem só pra teste local.
-- =============================================================================

-- ---- Igreja (única) ----
insert into churches (id, name, join_code) values
  ('a0000000-0000-0000-0000-000000000001', 'Comunidade Videira', 'VIDEIRA2026');

-- ---- Equipes ----
insert into teams (id, church_id, name, color, icon, sort_order) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Louvor',    '#C4633E', 'music',        1),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Som',       '#5B6B4E', 'sliders',      2),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Recepção',  '#B0894A', 'hand-heart',   3),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Kids',      '#7C6BAF', 'baby',         4);

-- ---- Posições por equipe ----
insert into positions (id, team_id, name, sort_order) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Vocal',      1),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Guitarra',   2),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Baixo',      3),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'Bateria',    4),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'Teclado',    5),
  ('c0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000002', 'Mesa de som',1),
  ('c0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000002', 'Monitor',    2),
  ('c0000000-0000-0000-0000-000000000020', 'b0000000-0000-0000-0000-000000000003', 'Porta',      1),
  ('c0000000-0000-0000-0000-000000000021', 'b0000000-0000-0000-0000-000000000003', 'Ofertas',    2),
  ('c0000000-0000-0000-0000-000000000030', 'b0000000-0000-0000-0000-000000000004', 'Professor',  1),
  ('c0000000-0000-0000-0000-000000000031', 'b0000000-0000-0000-0000-000000000004', 'Auxiliar',   2);

-- ---- Usuários de teste (dispara o trigger handle_new_user -> cria profiles) ----
-- senha de todos: "senha123"
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@videira.test',   crypt('senha123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"André (Admin)"}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'marcos@videira.test',  crypt('senha123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Marcos (Líder Louvor)"}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'juliana@videira.test', crypt('senha123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Juliana (Vocal)"}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'pedro@videira.test',   crypt('senha123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Pedro (Som + Louvor)"}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'ana@videira.test',     crypt('senha123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ana (Líder Som)"}');

-- Admin
update profiles set system_role = 'admin', phone = '+55 51 99999-0001' where id = 'd0000000-0000-0000-0000-000000000001';

-- ---- Memberships (Pedro está em DUAS equipes: Louvor e Som) ----
insert into memberships (id, profile_id, team_id, role) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'leader'),    -- Marcos lidera Louvor
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'volunteer'), -- Juliana no Louvor
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'volunteer'), -- Pedro no Louvor
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'volunteer'), -- Pedro no Som
  ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'leader');    -- Ana lidera Som

insert into member_positions (membership_id, position_id) values
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001'), -- Juliana: Vocal
  ('e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002'), -- Pedro: Guitarra
  ('e0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000010'); -- Pedro: Mesa de som

-- ---- Série recorrente + evento do próximo domingo ----
insert into event_series (id, church_id, title, weekday, start_time, location) values
  ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Culto de Domingo', 0, '18:00', 'Templo');

insert into events (id, church_id, series_id, title, starts_at, location, created_by) values
  ('f1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
   'Culto de Domingo', date_trunc('week', now()) + interval '6 days 18 hours', 'Templo',
   'd0000000-0000-0000-0000-000000000001');

-- ---- Escalações do culto ----
insert into assignments (event_id, team_id, position_id, profile_id, status, assigned_by) values
  ('f1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'confirmado', 'd0000000-0000-0000-0000-000000000002'), -- Juliana vocal (confirmou)
  ('f1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000004', 'convidado',  'd0000000-0000-0000-0000-000000000002'), -- Pedro guitarra (pendente)
  ('f1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', null,                                   'vaga_aberta','d0000000-0000-0000-0000-000000000002'), -- Bateria em aberto
  ('f1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000004', 'confirmado', 'd0000000-0000-0000-0000-000000000005'); -- Pedro mesa de som

-- ---- Um interesse em servir (Juliana quer aprender Teclado -> notifica líder do Louvor) ----
insert into service_interests (profile_id, team_id, position_id, note) values
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', 'Quero começar a treinar teclado :)');
