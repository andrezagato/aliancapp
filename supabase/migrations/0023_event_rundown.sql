create table if not exists public.event_rundown (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  sort_order integer not null default 0,
  title text not null,
  kind text not null default 'outro',
  duration_min integer not null default 5,
  responsible text,
  note text,
  link text,
  created_at timestamptz not null default now()
);

create index if not exists event_rundown_event_idx on public.event_rundown (event_id, sort_order);

alter table public.event_rundown enable row level security;

-- Leitura: qualquer pessoa ativa (igual aos eventos).
create policy rundown_read on public.event_rundown
  for select to authenticated
  using (is_active() or is_admin());

-- Escrita: admin, responsável do culto, ou líder de uma equipe que serve nesse evento.
create policy rundown_write on public.event_rundown
  for all to authenticated
  using (
    is_admin()
    or exists (select 1 from public.events e where e.id = event_rundown.event_id and e.responsible_id = auth.uid())
    or exists (
      select 1 from public.event_requirements r
      where r.event_id = event_rundown.event_id and is_team_leader(r.team_id)
    )
  )
  with check (
    is_admin()
    or exists (select 1 from public.events e where e.id = event_rundown.event_id and e.responsible_id = auth.uid())
    or exists (
      select 1 from public.event_requirements r
      where r.event_id = event_rundown.event_id and is_team_leader(r.team_id)
    )
  );