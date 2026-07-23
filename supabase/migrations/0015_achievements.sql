create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  unlocked_at timestamptz not null default now(),
  unique (profile_id, code)
);

alter table public.achievements enable row level security;

create policy achievements_read on public.achievements
  for select to authenticated
  using (profile_id = auth.uid() or is_admin());

create policy achievements_insert on public.achievements
  for insert to authenticated
  with check (profile_id = auth.uid());

create index if not exists achievements_profile_idx on public.achievements (profile_id);