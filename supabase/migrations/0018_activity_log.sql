create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  church_id uuid references public.churches(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null,
  event_id uuid references public.events(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_church_created_idx on public.activity_log (church_id, created_at desc);
create index if not exists activity_log_profile_idx on public.activity_log (profile_id);

alter table public.activity_log enable row level security;

-- Leitura só pro admin (relatórios virão depois); escrita só via RPC security definer.
create policy activity_admin_read on public.activity_log
  for select to authenticated using (is_admin());

create or replace function public.log_activity(
  p_profile uuid,
  p_actor uuid,
  p_kind text,
  p_event uuid default null,
  p_team uuid default null,
  p_meta jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_church uuid;
begin
  select church_id into v_church from public.profiles where id = coalesce(p_profile, p_actor);
  insert into public.activity_log (church_id, profile_id, actor_id, kind, event_id, team_id, meta)
  values (v_church, p_profile, p_actor, p_kind, p_event, p_team, coalesce(p_meta, '{}'::jsonb));
end;
$$;

grant execute on function public.log_activity(uuid, uuid, text, uuid, uuid, jsonb) to authenticated;