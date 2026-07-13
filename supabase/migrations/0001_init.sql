-- =============================================================================
-- Aliança / Servir — schema inicial (MVP)
-- App de escalas de equipes para igreja.
-- Modelo single-church (uma igreja hoje) com church_id em tudo pra crescer.
--
-- NOTA: enquanto o schema NÃO foi aplicado a nenhum banco, este arquivo é a
-- fonte única. Depois do primeiro `supabase db push` (ou Run no SQL Editor),
-- toda mudança vira uma migração NOVA (0002, 0003…) — não edite este arquivo.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
create type system_role          as enum ('admin', 'member');
create type profile_status       as enum ('pendente', 'ativo');
create type membership_role      as enum ('leader', 'volunteer');
create type assignment_status    as enum ('convidado', 'confirmado', 'recusado', 'vaga_aberta', 'presente');
create type requirement_status   as enum ('needed', 'not_applicable');
create type swap_status          as enum ('pendente', 'aprovada', 'recusada');
create type join_status          as enum ('pendente', 'aprovado', 'recusado');
create type invite_status        as enum ('pendente', 'aceito', 'expirado', 'cancelado');
create type event_request_status as enum ('pendente', 'aprovado', 'recusado');
create type interest_status      as enum ('aberto', 'atendido', 'arquivado');
create type notification_kind    as enum (
  'escalado', 'lembrete', 'confirmado', 'cancelado',
  'troca_solicitada', 'troca_resolvida', 'vaga_aberta',
  'interesse_servir', 'cadastro_pendente', 'cadastro_aprovado',
  'evento_alterado', 'evento_confirmar', 'evento_solicitado',
  'aniversario', 'cobertura'
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
-- church_id é NULLABLE: quem loga sem convite fica "pendente / sem igreja" até
-- o admin aprovar (fila de aprovação).
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  church_id    uuid references churches(id) on delete set null,
  full_name    text not null default '',
  email        text,
  phone        text,
  avatar_url   text,
  birth_date   date,                      -- aniversário (visível pra igreja toda)
  system_role  system_role not null default 'member',
  status       profile_status not null default 'pendente',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on profiles (church_id);
create index on profiles (status);

create table teams (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references churches(id) on delete cascade,
  name        text not null,
  color       text not null default '#C4633E',
  icon        text not null default 'users',
  sort_order  int not null default 0,
  archived_at timestamptz,                -- soft-delete (preserva histórico)
  created_at  timestamptz not null default now()
);
create index on teams (church_id);

-- Funções/posições dentro de uma equipe (Louvor -> vocal, guitarra...).
create table positions (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  name        text not null,
  sort_order  int not null default 0,
  archived_at timestamptz,                -- soft-delete (preserva histórico)
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

-- CONVITE pré-login: admin cria a pessoa ANTES dela logar. No 1º login o
-- trigger handle_new_user casa por email e provisiona profile + memberships.
create table invites (
  id           uuid primary key default gen_random_uuid(),
  church_id    uuid not null references churches(id) on delete cascade,
  email        text not null,
  full_name    text not null default '',
  phone        text,
  system_role  system_role not null default 'member',
  token        text not null unique default encode(gen_random_bytes(16), 'hex'),
  status       invite_status not null default 'pendente',
  created_by   uuid references profiles(id) on delete set null,
  expires_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index on invites (church_id, status);
create index on invites (lower(email));

-- Equipes/função que o convite já pré-atribui.
create table invite_teams (
  invite_id uuid not null references invites(id) on delete cascade,
  team_id   uuid not null references teams(id) on delete cascade,
  role      membership_role not null default 'volunteer',
  primary key (invite_id, team_id)
);

-- Recorrência (ex.: "Culto de Domingo, dom 18h").
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

-- TEMPLATE de escala da série: quais posições e QUANTAS pessoas.
-- É o "denominador" que a ocorrência herda.
create table series_requirements (
  id           uuid primary key default gen_random_uuid(),
  series_id    uuid not null references event_series(id) on delete cascade,
  team_id      uuid not null references teams(id) on delete cascade,
  position_id  uuid not null references positions(id) on delete cascade,
  needed_count int not null default 1 check (needed_count >= 0),
  unique (series_id, position_id)
);
create index on series_requirements (series_id);

-- Ocorrência concreta (gerada de uma série ou avulsa).
-- Editar um event NÃO afeta a série (é cópia materializada).
create table events (
  id             uuid primary key default gen_random_uuid(),
  church_id      uuid not null references churches(id) on delete cascade,
  series_id      uuid references event_series(id) on delete set null,
  title          text not null,
  starts_at      timestamptz not null,
  ends_at        timestamptz,                -- duração (opcional)
  location       text,
  notes          text,
  responsible_id uuid references profiles(id) on delete set null,  -- pastor/responsável
  confirmed_at   timestamptz,                -- responsável confirmou que vai acontecer
  confirmed_by   uuid references profiles(id) on delete set null,
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index on events (church_id, starts_at);

-- Requisitos EFETIVOS por ocorrência (copiados do template, editáveis).
-- status='not_applicable' = líder dispensou a posição de propósito (≠ vazio).
-- Base do alerta de cobertura (verde/amarelo/vermelho).
create table event_requirements (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events(id) on delete cascade,
  team_id      uuid not null references teams(id) on delete cascade,
  position_id  uuid not null references positions(id) on delete cascade,
  needed_count int not null default 1 check (needed_count >= 0),
  status       requirement_status not null default 'needed',
  note         text,
  unique (event_id, position_id)
);
create index on event_requirements (event_id);
create index on event_requirements (team_id);

-- Líder SOLICITA criação de evento -> admin aprova (Fase 2).
create table event_requests (
  id                uuid primary key default gen_random_uuid(),
  church_id         uuid not null references churches(id) on delete cascade,
  requested_by      uuid not null references profiles(id) on delete cascade,
  title             text not null,
  desired_at        timestamptz,
  location          text,
  note              text,
  status            event_request_status not null default 'pendente',
  resolved_by       uuid references profiles(id) on delete set null,
  resolved_event_id uuid references events(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index on event_requests (church_id, status);

-- NÚCLEO: quem serve, em qual posição, em qual evento.
create table assignments (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references events(id) on delete cascade,
  requirement_id uuid references event_requirements(id) on delete set null,
  team_id        uuid not null references teams(id) on delete cascade,
  position_id    uuid not null references positions(id) on delete cascade,
  profile_id     uuid references profiles(id) on delete set null,   -- null = vaga aberta
  status         assignment_status not null default 'convidado',
  decline_reason text,
  assigned_by    uuid references profiles(id) on delete set null,
  responded_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
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

-- Presença no dia (auto-declarada no MVP).
create table checkins (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade unique,
  checked_by    uuid references profiles(id) on delete set null,
  checked_at    timestamptz not null default now()
);

-- Auto-cadastro pendente de aprovação (porta 2: pré-login, via link/QR).
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

-- Sino in-app. ESCOPO do roteamento compartimentado:
--   team_id  preenchido  -> aviso POR-EQUIPE  (só quem tem escopo na equipe)
--   event_id preenchido  -> aviso POR-EVENTO  (todos escalados no evento)
--   ambos null           -> aviso POR-PESSOA  (destinatário direto)
create table notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references profiles(id) on delete cascade,
  team_id       uuid references teams(id) on delete set null,
  event_id      uuid references events(id) on delete set null,
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
-- security_invoker = on  => RESPEITA a RLS de quem consulta (não vaza escala
-- de outras equipes). Sem isso, a view rodaria como o dono e furaria a RLS.
-- -----------------------------------------------------------------------------
create view v_assignment_history
with (security_invoker = on) as
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
join events e      on e.id = a.event_id
left join profiles p    on p.id = a.profile_id
left join positions pos on pos.id = a.position_id;

-- =============================================================================
-- FUNÇÕES
-- =============================================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- Integridade: a posição precisa pertencer à equipe informada.
-- (mata o furo de escalar alguém numa posição de outra equipe)
create or replace function check_position_in_team()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from positions p where p.id = new.position_id and p.team_id = new.team_id
  ) then
    raise exception 'Posição % não pertence à equipe %', new.position_id, new.team_id;
  end if;
  return new;
end; $$;

-- Impede que NÃO-admin altere campos privilegiados do próprio profile
-- (system_role, status, church_id) — evita auto-promoção/auto-aprovação.
create or replace function profiles_guard_privileged()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from profiles where id = auth.uid() and system_role = 'admin') then
    return new;  -- admin pode tudo
  end if;
  new.system_role := old.system_role;
  new.status      := old.status;
  new.church_id   := old.church_id;
  return new;
end; $$;

-- Onboarding de DUAS PORTAS ao criar um usuário (OAuth):
--   1) tem convite pendente pro email -> provisiona e entra ATIVO (admin já aprovou)
--   2) sem convite -> profile PENDENTE sem igreja (fila de aprovação)
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  inv invites%rowtype;
begin
  select * into inv
    from invites
   where lower(email) = lower(new.email) and status = 'pendente'
   order by created_at
   limit 1;

  if inv.id is not null then
    insert into profiles (id, church_id, full_name, email, phone, avatar_url, system_role, status)
    values (
      new.id, inv.church_id,
      coalesce(nullif(inv.full_name, ''), new.raw_user_meta_data->>'full_name',
               new.raw_user_meta_data->>'name', ''),
      new.email, inv.phone, new.raw_user_meta_data->>'avatar_url',
      inv.system_role, 'ativo'
    )
    on conflict (id) do nothing;

    insert into memberships (profile_id, team_id, role)
      select new.id, it.team_id, it.role
        from invite_teams it
       where it.invite_id = inv.id
      on conflict (profile_id, team_id) do nothing;

    update invites set status = 'aceito' where id = inv.id;
  else
    insert into profiles (id, church_id, full_name, email, avatar_url, status)
    values (
      new.id, null,
      coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
      new.email, new.raw_user_meta_data->>'avatar_url', 'pendente'
    )
    on conflict (id) do nothing;
  end if;

  return new;
end; $$;

-- RPCs de resposta do voluntário (SECURITY DEFINER + checagem de dono):
-- o voluntário só muda a PRÓPRIA linha e só nas transições válidas.
create or replace function confirmar_escalacao(p_assignment uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update assignments
     set status = 'confirmado', responded_at = now()
   where id = p_assignment
     and profile_id = auth.uid()
     and status = 'convidado';
  if not found then
    raise exception 'Escalação não encontrada ou não pode ser confirmada';
  end if;
end; $$;

create or replace function recusar_escalacao(p_assignment uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update assignments
     set status = 'recusado', decline_reason = p_motivo, responded_at = now()
   where id = p_assignment
     and profile_id = auth.uid()
     and status in ('convidado', 'confirmado');
  if not found then
    raise exception 'Escalação não encontrada ou não pode ser recusada';
  end if;
end; $$;

-- =============================================================================
-- HELPERS DE RLS (SECURITY DEFINER pra evitar recursão de policy)
-- =============================================================================
create or replace function is_active()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
     where id = auth.uid() and status = 'ativo' and church_id is not null
  );
$$;

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
-- TRIGGERS
-- =============================================================================
create trigger trg_profiles_updated   before update on profiles    for each row execute function set_updated_at();
create trigger trg_assignments_updated before update on assignments for each row execute function set_updated_at();

create trigger trg_profiles_guard before update on profiles for each row execute function profiles_guard_privileged();

create trigger trg_assign_pit  before insert or update on assignments         for each row execute function check_position_in_team();
create trigger trg_evreq_pit   before insert or update on event_requirements  for each row execute function check_position_in_team();
create trigger trg_serreq_pit  before insert or update on series_requirements for each row execute function check_position_in_team();

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =============================================================================
-- RLS
-- =============================================================================
alter table churches            enable row level security;
alter table profiles            enable row level security;
alter table teams               enable row level security;
alter table positions           enable row level security;
alter table memberships         enable row level security;
alter table member_positions    enable row level security;
alter table invites             enable row level security;
alter table invite_teams        enable row level security;
alter table event_series        enable row level security;
alter table series_requirements enable row level security;
alter table events              enable row level security;
alter table event_requirements  enable row level security;
alter table event_requests      enable row level security;
alter table assignments         enable row level security;
alter table availability_blocks enable row level security;
alter table swap_requests       enable row level security;
alter table checkins            enable row level security;
alter table join_requests       enable row level security;
alter table service_interests   enable row level security;
alter table notifications       enable row level security;
alter table notification_prefs  enable row level security;
alter table push_subscriptions  enable row level security;

-- churches: membro ativo (ou admin) lê; só admin altera.
create policy churches_read  on churches for select to authenticated using (is_active() or is_admin());
create policy churches_write on churches for all    to authenticated using (is_admin()) with check (is_admin());

-- profiles: lê o PRÓPRIO (pra saber que está pendente), membro ativo lê todos,
-- admin lê/edita todos. Update do próprio é permitido MAS o trigger
-- profiles_guard_privileged impede mexer em system_role/status/church_id.
create policy profiles_read        on profiles for select to authenticated using (id = auth.uid() or is_active() or is_admin());
create policy profiles_update_self on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_write on profiles for all    to authenticated using (is_admin()) with check (is_admin());

-- teams / positions: leitura pra ativos; admin gerencia (líder gerencia posições da própria equipe).
create policy teams_read       on teams     for select to authenticated using (is_active() or is_admin());
create policy teams_admin      on teams     for all    to authenticated using (is_admin()) with check (is_admin());
create policy positions_read   on positions for select to authenticated using (is_active() or is_admin());
create policy positions_manage on positions for all    to authenticated
  using (is_admin() or is_team_leader(team_id))
  with check (is_admin() or is_team_leader(team_id));

-- memberships: leitura pra ativos; admin ou líder DA equipe gerencia.
create policy memberships_read   on memberships for select to authenticated using (is_active() or is_admin());
create policy memberships_manage on memberships for all    to authenticated
  using (is_admin() or is_team_leader(team_id))
  with check (is_admin() or is_team_leader(team_id));

create policy member_positions_read   on member_positions for select to authenticated using (is_active() or is_admin());
create policy member_positions_manage on member_positions for all to authenticated
  using (exists (select 1 from memberships m where m.id = membership_id and (is_admin() or is_team_leader(m.team_id))))
  with check (exists (select 1 from memberships m where m.id = membership_id and (is_admin() or is_team_leader(m.team_id))));

-- invites: só admin gerencia; líderes leem.
create policy invites_admin       on invites      for all    to authenticated using (is_admin()) with check (is_admin());
create policy invites_read_leader on invites      for select to authenticated using (is_any_leader());
create policy invite_teams_admin  on invite_teams for all    to authenticated using (is_admin()) with check (is_admin());

-- eventos e séries: leitura pra ativos; SÓ ADMIN cria/edita.
create policy series_read     on event_series for select to authenticated using (is_active() or is_admin());
create policy series_manage   on event_series for all    to authenticated using (is_admin()) with check (is_admin());
create policy series_req_read on series_requirements for select to authenticated using (is_active() or is_admin());
create policy series_req_mng  on series_requirements for all    to authenticated using (is_admin()) with check (is_admin());
create policy events_read     on events for select to authenticated using (is_active() or is_admin());
create policy events_manage   on events for all    to authenticated using (is_admin()) with check (is_admin());

-- requisitos do evento: leitura pra ativos; admin OU líder da equipe ajusta
-- (é aqui que o líder marca "não se aplica" na própria equipe).
create policy event_req_read   on event_requirements for select to authenticated using (is_active() or is_admin());
create policy event_req_manage on event_requirements for all    to authenticated
  using (is_admin() or is_team_leader(team_id))
  with check (is_admin() or is_team_leader(team_id));

-- solicitação de evento (líder pede -> admin aprova).
create policy event_req_insert  on event_requests for insert to authenticated with check (requested_by = auth.uid() and (is_admin() or is_any_leader()));
create policy event_req_select  on event_requests for select to authenticated using (requested_by = auth.uid() or is_admin());
create policy event_req_resolve on event_requests for update to authenticated using (is_admin()) with check (is_admin());

-- assignments (VISIBILIDADE = compartimentação):
--   vê quem é membro da equipe (voluntário vê a escala da própria equipe) ou admin.
create policy assignments_read on assignments for select to authenticated
  using (is_admin() or is_team_member(team_id));
--   escala: admin ou líder da equipe. (confirmar/recusar do voluntário = via RPC)
create policy assignments_manage on assignments for all to authenticated
  using (is_admin() or is_team_leader(team_id))
  with check (is_admin() or is_team_leader(team_id));

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
create policy swaps_insert  on swap_requests for insert to authenticated with check (requested_by = auth.uid());
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
create policy interests_read   on service_interests for select to authenticated
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
grant execute on function confirmar_escalacao(uuid)      to authenticated;
grant execute on function recusar_escalacao(uuid, text)  to authenticated;
