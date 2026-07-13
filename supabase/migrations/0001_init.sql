-- =============================================================================
-- Servir — schema inicial (MVP)
-- App de escalas de equipes para igreja.
-- Modelo single-church (uma igreja hoje) mas com church_id em tudo pra crescer.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
create type system_role       as enum ('admin', 'member');
create type membership_role    as enum ('leader', 'volunteer');
create type assignment_status  as enum ('convidado', 'confirmado', 'recusado', 'vaga_aberta', 'presente');
create type swap_status        as enum ('pendente', 'aprovada', 'recusada');
create type join_status        as enum ('pendente', 'aprovado', 'recusado');
create type interest_status    as enum ('aberto', 'atendido', 'arquivado');
create type notification_kind  as enum (
  'escalado', 'lembrete', 'confirmado', 'cancelado',
  'troca_solicitada', 'troca_resolvida', 'vaga_aberta',
  'interesse_servir', 'cadastro_pendente'
);

-- -----------------------------------------------------------------------------
-- TABELAS
-- -----------------------------------------------------------------------------

create table churches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  timezone    text not null default 'America/Sao_Paulo',
  logo_url    text,
  join_code   text unique,               -- código do link/QR de auto-cadastro
  created_at  timestamptz not null default now()
);

-- Pessoas. id == auth.users.id (1:1).
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  church_id    uuid not null references churches(id) on delete cascade,
  full_name    text not null default '',
  email        text,
  phone        text,
  avatar_url   text,
  system_role  system_role not null default 'member',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on profiles (church_id);

create table teams (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references churches(id) on delete cascade,
  name        text not null,
  color       text not null default '#C4633E',   -- cor do "chip" da equipe
  icon        text not null default 'users',      -- nome do ícone Lucide
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index on teams (church_id);

-- Funções/posições dentro de uma equipe (Louvor -> vocal, guitarra...).
create table positions (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  name        text not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index on positions (team_id);

-- Pessoa <-> equipe (N por pessoa). Papel dentro DAQUELA equipe.
create table memberships (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  team_id     uuid not null references teams(id) on delete cascade,
  role        membership_role not null default 'volunteer',
  created_at  timestamptz not null default now(),
  unique (profile_id, team_id)
);
create index on memberships (team_id);
create index on memberships (profile_id);

-- Quais posições a pessoa sabe/pode exercer naquela equipe.
create table member_positions (
  membership_id uuid not null references memberships(id) on delete cascade,
  position_id   uuid not null references positions(id) on delete cascade,
  primary key (membership_id, position_id)
);

-- Recorrência (ex.: "Culto de Domingo, dom 18h"). Opcional.
create table event_series (
  id           uuid primary key default gen_random_uuid(),
  church_id    uuid not null references churches(id) on delete cascade,
  title        text not null,
  weekday      int check (weekday between 0 and 6),   -- 0=domingo
  start_time   time not null default '18:00',
  location     text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Ocorrência concreta (gerada de uma série ou avulsa).
create table events (
  id           uuid primary key default gen_random_uuid(),
  church_id    uuid not null references churches(id) on delete cascade,
  series_id    uuid references event_series(id) on delete set null,
  title        text not null,
  starts_at    timestamptz not null,
  location     text,
  notes        text,
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index on events (church_id, starts_at);

-- NÚCLEO: quem serve, em qual posição, em qual evento.
create table assignments (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events(id) on delete cascade,
  team_id      uuid not null references teams(id) on delete cascade,
  position_id  uuid not null references positions(id) on delete cascade,
  profile_id   uuid references profiles(id) on delete set null,  -- null = vaga aberta
  status       assignment_status not null default 'convidado',
  decline_reason text,
  assigned_by  uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on assignments (event_id);
create index on assignments (team_id);
create index on assignments (profile_id);

-- Bloqueio de disponibilidade (a pessoa marca quando NÃO pode).
create table availability_blocks (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  reason      text,
  created_at  timestamptz not null default now(),
  check (end_date >= start_date)
);
create index on availability_blocks (profile_id, start_date);

-- Pedido de troca/substituto ligado a uma escalação.
create table swap_requests (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references assignments(id) on delete cascade,
  requested_by   uuid not null references profiles(id) on delete cascade,
  suggested_profile_id uuid references profiles(id) on delete set null,
  reason         text,
  status         swap_status not null default 'pendente',
  resolved_by    uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index on swap_requests (assignment_id);

-- Presença no dia.
create table checkins (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade unique,
  checked_by    uuid references profiles(id) on delete set null,
  checked_at    timestamptz not null default now()
);

-- Auto-cadastro pendente de aprovação.
create table join_requests (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references churches(id) on delete cascade,
  full_name   text not null,
  email       text,
  phone       text,
  message     text,
  status      join_status not null default 'pendente',
  resolved_by uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on join_requests (church_id, status);

-- "Quero servir/aprender em X" -> notifica líder da equipe.
create table service_interests (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  team_id     uuid not null references teams(id) on delete cascade,
  position_id uuid references positions(id) on delete set null,
  note        text,
  status      interest_status not null default 'aberto',
  created_at  timestamptz not null default now(),
  unique (profile_id, team_id, position_id)
);
create index on service_interests (team_id, status);

-- Sino in-app. team_id de ORIGEM = base do roteamento compartimentado.
create table notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references profiles(id) on delete cascade,
  team_id       uuid references teams(id) on delete set null,
  kind          notification_kind not null,
  title         text not null,
  body          text,
  link          text,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index on notifications (recipient_id, read_at);

-- Preferências de canal por pessoa e por tipo de aviso.
create table notification_prefs (
  profile_id  uuid not null references profiles(id) on delete cascade,
  kind        notification_kind not null,
  push        boolean not null default true,
  email       boolean not null default true,
  in_app      boolean not null default true,
  primary key (profile_id, kind)
);

-- Assinaturas Web Push (Fase 3).
create table push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
create index on push_subscriptions (profile_id);

-- -----------------------------------------------------------------------------
-- HISTÓRICO DE ESCALAÇÕES (view — sem tabela nova)
-- "quem já serviu nessa função", "última vez que fulano serviu"
-- -----------------------------------------------------------------------------
create view v_assignment_history as
select
  a.id            as assignment_id,
  a.profile_id,
  p.full_name,
  a.team_id,
  a.position_id,
  pos.name        as position_name,
  e.id            as event_id,
  e.title         as event_title,
  e.starts_at,
  a.status
from assignments a
join events e     on e.id = a.event_id
left join profiles p   on p.id = a.profile_id
left join positions pos on pos.id = a.position_id;

-- =============================================================================
-- TRIGGERS
-- =============================================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create trigger trg_profiles_updated   before update on profiles    for each row execute function set_updated_at();
create trigger trg_assignments_updated before update on assignments for each row execute function set_updated_at();

-- Cria profile automaticamente quando um usuário se autentica (OAuth).
-- Liga à ÚNICA igreja existente (modelo single-church).
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  the_church uuid;
begin
  select id into the_church from churches order by created_at limit 1;
  insert into profiles (id, church_id, full_name, email, avatar_url)
  values (
    new.id,
    the_church,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =============================================================================
-- HELPERS DE RLS (SECURITY DEFINER pra evitar recursão de policy)
-- =============================================================================
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and system_role = 'admin');
$$;

create or replace function is_team_member(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where profile_id = auth.uid() and team_id = t);
$$;

create or replace function is_team_leader(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships
    where profile_id = auth.uid() and team_id = t and role = 'leader'
  );
$$;

-- Sou líder de alguma equipe da qual a pessoa `p` faz parte?
create or replace function leads_team_of(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from memberships mine
    join memberships theirs on theirs.team_id = mine.team_id
    where mine.profile_id = auth.uid() and mine.role = 'leader'
      and theirs.profile_id = p
  );
$$;

create or replace function is_any_leader()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where profile_id = auth.uid() and role = 'leader');
$$;

-- =============================================================================
-- RLS
-- =============================================================================
alter table churches            enable row level security;
alter table profiles            enable row level security;
alter table teams               enable row level security;
alter table positions           enable row level security;
alter table memberships         enable row level security;
alter table member_positions    enable row level security;
alter table event_series        enable row level security;
alter table events              enable row level security;
alter table assignments         enable row level security;
alter table availability_blocks enable row level security;
alter table swap_requests       enable row level security;
alter table checkins            enable row level security;
alter table join_requests       enable row level security;
alter table service_interests   enable row level security;
alter table notifications       enable row level security;
alter table notification_prefs  enable row level security;
alter table push_subscriptions  enable row level security;

-- churches: todo autenticado lê; só admin altera.
create policy churches_read   on churches for select to authenticated using (true);
create policy churches_write  on churches for all    to authenticated using (is_admin()) with check (is_admin());

-- profiles: todo autenticado lê (aparecem na escala); edita o próprio; admin edita todos.
create policy profiles_read        on profiles for select to authenticated using (true);
create policy profiles_update_self on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_write on profiles for all    to authenticated using (is_admin()) with check (is_admin());

-- teams / positions: leitura geral; admin gerencia (líder gerencia posições da própria equipe).
create policy teams_read       on teams     for select to authenticated using (true);
create policy teams_admin      on teams     for all    to authenticated using (is_admin()) with check (is_admin());
create policy positions_read   on positions for select to authenticated using (true);
create policy positions_manage on positions for all    to authenticated
  using (is_admin() or is_team_leader(team_id))
  with check (is_admin() or is_team_leader(team_id));

-- memberships: leitura geral; admin ou líder DA equipe gerencia.
create policy memberships_read   on memberships for select to authenticated using (true);
create policy memberships_manage on memberships for all    to authenticated
  using (is_admin() or is_team_leader(team_id))
  with check (is_admin() or is_team_leader(team_id));

create policy member_positions_read on member_positions for select to authenticated using (true);
create policy member_positions_manage on member_positions for all to authenticated
  using (exists (select 1 from memberships m where m.id = membership_id and (is_admin() or is_team_leader(m.team_id))))
  with check (exists (select 1 from memberships m where m.id = membership_id and (is_admin() or is_team_leader(m.team_id))));

-- eventos: leitura geral; admin e líderes criam/editam.
create policy series_read   on event_series for select to authenticated using (true);
create policy series_manage on event_series for all    to authenticated using (is_admin() or is_any_leader()) with check (is_admin() or is_any_leader());
create policy events_read   on events for select to authenticated using (true);
create policy events_manage on events for all to authenticated using (is_admin() or is_any_leader()) with check (is_admin() or is_any_leader());

-- assignments (VISIBILIDADE = compartimentação):
--   vê quem é membro da equipe (voluntário vê a escala da própria equipe) ou admin.
create policy assignments_read on assignments for select to authenticated
  using (is_admin() or is_team_member(team_id));
--   escala: admin ou líder da equipe.
create policy assignments_manage on assignments for all to authenticated
  using (is_admin() or is_team_leader(team_id))
  with check (is_admin() or is_team_leader(team_id));
--   confirmar/cancelar: a própria pessoa escalada edita a própria linha.
create policy assignments_update_self on assignments for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- disponibilidade: dono gerencia; admin e líderes que compartilham equipe leem.
create policy availability_read on availability_blocks for select to authenticated
  using (profile_id = auth.uid() or is_admin() or leads_team_of(profile_id));
create policy availability_manage on availability_blocks for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- trocas: dono, líder da equipe da escalação, ou admin.
create policy swaps_read on swap_requests for select to authenticated using (
  requested_by = auth.uid() or is_admin() or
  exists (select 1 from assignments a where a.id = assignment_id and is_team_leader(a.team_id))
);
create policy swaps_insert on swap_requests for insert to authenticated with check (requested_by = auth.uid());
create policy swaps_resolve on swap_requests for update to authenticated using (
  is_admin() or exists (select 1 from assignments a where a.id = assignment_id and is_team_leader(a.team_id))
);

-- check-in: membros da equipe leem; próprio ou líder registra.
create policy checkins_read on checkins for select to authenticated using (
  is_admin() or exists (select 1 from assignments a where a.id = assignment_id and is_team_member(a.team_id))
);
create policy checkins_write on checkins for all to authenticated using (
  is_admin() or exists (select 1 from assignments a where a.id = assignment_id and (a.profile_id = auth.uid() or is_team_leader(a.team_id)))
) with check (
  is_admin() or exists (select 1 from assignments a where a.id = assignment_id and (a.profile_id = auth.uid() or is_team_leader(a.team_id)))
);

-- auto-cadastro: qualquer um (anon) cria; admin/líderes leem e resolvem.
create policy join_insert  on join_requests for insert to anon, authenticated with check (true);
create policy join_read    on join_requests for select to authenticated using (is_admin() or is_any_leader());
create policy join_resolve on join_requests for update to authenticated using (is_admin() or is_any_leader());

-- interesses: dono cria/vê; líder da equipe-alvo e admin veem.
create policy interests_read on service_interests for select to authenticated
  using (profile_id = auth.uid() or is_admin() or is_team_leader(team_id));
create policy interests_insert on service_interests for insert to authenticated with check (profile_id = auth.uid());
create policy interests_update on service_interests for update to authenticated
  using (is_admin() or is_team_leader(team_id));

-- notificações: só o destinatário.
create policy notifications_read   on notifications for select to authenticated using (recipient_id = auth.uid());
create policy notifications_update on notifications for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- prefs / push: só o dono.
create policy prefs_all on notification_prefs for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy push_all  on push_subscriptions for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- =============================================================================
-- GRANTS (Supabase: papéis anon / authenticated; RLS faz o controle fino)
-- =============================================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant insert on join_requests to anon;
grant select on v_assignment_history to authenticated;
