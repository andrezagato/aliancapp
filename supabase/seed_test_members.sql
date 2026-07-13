-- =============================================================================
-- Servir — pessoas de TESTE (cloud) para rodar os fluxos de escala
--
-- Cria membros ATIVOS via o caminho real de onboarding: um invite + a inserção
-- em auth.users dispara handle_new_user, que provisiona profile ativo + memberships.
-- Emails @teste.local (fictícios) — NÃO logam pela UI (login é Google-only); servem
-- só como alvos de escalação. Senha fake 'teste123'. Idempotente.
--
-- Para REMOVER tudo depois:
--   delete from auth.users where email like '%@teste.local';
--   delete from invites   where email like '%@teste.local';
-- (o cascade limpa profiles/memberships/member_positions)
-- =============================================================================

-- ---- invites (com equipes/função pretendidas) ----
insert into invites (id, church_id, email, full_name, system_role, status) values
  ('66666666-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','joana@teste.local','Joana Ribeiro','member','pendente'),
  ('66666666-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','pedro@teste.local','Pedro Alves','member','pendente'),
  ('66666666-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','rafael@teste.local','Rafael Souza','member','pendente'),
  ('66666666-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','bia@teste.local','Bia Nunes','member','pendente'),
  ('66666666-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','ana@teste.local','Ana Prado','member','pendente'),
  ('66666666-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','lucas@teste.local','Lucas Dias','member','pendente'),
  ('66666666-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','clara@teste.local','Clara Melo','member','pendente'),
  ('66666666-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','tiago@teste.local','Tiago Reis','member','pendente')
on conflict (id) do nothing;

insert into invite_teams (invite_id, team_id, role) values
  ('66666666-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','leader'),    -- Joana lidera Louvor
  ('66666666-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001','volunteer'), -- Pedro Louvor
  ('66666666-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000002','volunteer'), -- Pedro Som
  ('66666666-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000001','volunteer'), -- Rafael Louvor
  ('66666666-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000001','volunteer'), -- Bia Louvor
  ('66666666-0000-0000-0000-000000000005','22222222-0000-0000-0000-000000000002','leader'),    -- Ana lidera Som
  ('66666666-0000-0000-0000-000000000006','22222222-0000-0000-0000-000000000003','volunteer'), -- Lucas Mídia
  ('66666666-0000-0000-0000-000000000007','22222222-0000-0000-0000-000000000004','volunteer'), -- Clara Recepção
  ('66666666-0000-0000-0000-000000000008','22222222-0000-0000-0000-000000000005','leader')     -- Tiago lidera Kids
on conflict do nothing;

-- ---- auth.users (dispara handle_new_user -> profile ativo + memberships) ----
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000','77777777-0000-0000-0000-000000000001','authenticated','authenticated','joana@teste.local', crypt('teste123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Joana Ribeiro"}'),
  ('00000000-0000-0000-0000-000000000000','77777777-0000-0000-0000-000000000002','authenticated','authenticated','pedro@teste.local', crypt('teste123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Pedro Alves"}'),
  ('00000000-0000-0000-0000-000000000000','77777777-0000-0000-0000-000000000003','authenticated','authenticated','rafael@teste.local', crypt('teste123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Rafael Souza"}'),
  ('00000000-0000-0000-0000-000000000000','77777777-0000-0000-0000-000000000004','authenticated','authenticated','bia@teste.local', crypt('teste123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Bia Nunes"}'),
  ('00000000-0000-0000-0000-000000000000','77777777-0000-0000-0000-000000000005','authenticated','authenticated','ana@teste.local', crypt('teste123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Ana Prado"}'),
  ('00000000-0000-0000-0000-000000000000','77777777-0000-0000-0000-000000000006','authenticated','authenticated','lucas@teste.local', crypt('teste123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Lucas Dias"}'),
  ('00000000-0000-0000-0000-000000000000','77777777-0000-0000-0000-000000000007','authenticated','authenticated','clara@teste.local', crypt('teste123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Clara Melo"}'),
  ('00000000-0000-0000-0000-000000000000','77777777-0000-0000-0000-000000000008','authenticated','authenticated','tiago@teste.local', crypt('teste123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Tiago Reis"}')
on conflict (id) do nothing;

-- ---- member_positions (habilidades) via subselect na membership ----
insert into member_positions (membership_id, position_id)
select m.id, v.position_id
from (values
  ('77777777-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','33333333-0000-0001-0000-000000000001'), -- Joana: Vocal
  ('77777777-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001','33333333-0000-0001-0000-000000000002'), -- Pedro: Guitarra
  ('77777777-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000002','33333333-0000-0002-0000-000000000001'), -- Pedro: Mesa de som
  ('77777777-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000001','33333333-0000-0001-0000-000000000003'), -- Rafael: Baixo
  ('77777777-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000001','33333333-0000-0001-0000-000000000005'), -- Bia: Teclado
  ('77777777-0000-0000-0000-000000000005','22222222-0000-0000-0000-000000000002','33333333-0000-0002-0000-000000000001'), -- Ana: Mesa de som
  ('77777777-0000-0000-0000-000000000006','22222222-0000-0000-0000-000000000003','33333333-0000-0003-0000-000000000001'), -- Lucas: Projeção
  ('77777777-0000-0000-0000-000000000007','22222222-0000-0000-0000-000000000004','33333333-0000-0004-0000-000000000001'), -- Clara: Porta
  ('77777777-0000-0000-0000-000000000008','22222222-0000-0000-0000-000000000005','33333333-0000-0005-0000-000000000001')  -- Tiago: Professor
) as v(profile_id, team_id, position_id)
join memberships m on m.profile_id = v.profile_id::uuid and m.team_id = v.team_id::uuid
on conflict do nothing;

-- ---- Correções pro login por senha funcionar (GoTrue) ----
-- Usuário inserido "na mão" nasce com colunas de token NULL; o GoTrue quebra ao
-- ler a linha ("Database error querying schema"). Precisam ser string vazia.
update auth.users
set confirmation_token     = coalesce(confirmation_token, ''),
    recovery_token         = coalesce(recovery_token, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change           = coalesce(email_change, '')
where email like '%@teste.local';

-- E o login por email exige uma identidade 'email' (a inserção manual não cria).
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
       'email', now(), now(), now()
from auth.users u
where u.email like '%@teste.local'
on conflict do nothing;
