alter table public.event_requests
  add column if not exists team_ids uuid[] not null default '{}';