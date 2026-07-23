-- Modelos de cronograma (preset de blocos) por igreja.
create table if not exists rundown_templates (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches(id) on delete cascade,
  name text not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists rundown_templates_church_idx on rundown_templates (church_id);

alter table rundown_templates enable row level security;

drop policy if exists rundown_templates_select on rundown_templates;
create policy rundown_templates_select on rundown_templates for select
  using (church_id = (select church_id from profiles where id = (select auth.uid())));

drop policy if exists rundown_templates_write on rundown_templates;
create policy rundown_templates_write on rundown_templates for all
  using (is_admin() or is_any_leader())
  with check (is_admin() or is_any_leader());