create table if not exists public.event_feedback (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (profile_id, event_id)
);

alter table public.event_feedback enable row level security;

create policy feedback_own_read on public.event_feedback
  for select to authenticated using (profile_id = auth.uid() or is_admin());
create policy feedback_own_insert on public.event_feedback
  for insert to authenticated with check (profile_id = auth.uid());
create policy feedback_own_update on public.event_feedback
  for update to authenticated using (profile_id = auth.uid());

create index if not exists event_feedback_profile_idx on public.event_feedback (profile_id);