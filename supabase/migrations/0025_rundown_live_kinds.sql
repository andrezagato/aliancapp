-- Tipos de bloco por igreja (customizáveis pelo admin/líderes)
create table if not exists rundown_kinds (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches(id) on delete cascade,
  label text not null,
  color text not null default '#6b7280',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists rundown_kinds_church_idx on rundown_kinds (church_id);

alter table rundown_kinds enable row level security;

-- leitura: membros ativos da mesma igreja
drop policy if exists rundown_kinds_select on rundown_kinds;
create policy rundown_kinds_select on rundown_kinds for select
  using (church_id = (select church_id from profiles where id = (select auth.uid())));

-- gerência (inserir/editar/remover): admin ou qualquer líder
drop policy if exists rundown_kinds_write on rundown_kinds;
create policy rundown_kinds_write on rundown_kinds for all
  using (is_admin() or is_any_leader())
  with check (is_admin() or is_any_leader());

-- bloco do cronograma: cor (snapshot do tipo) + tick de "feito"
alter table event_rundown add column if not exists color text;
alter table event_rundown add column if not exists done_at timestamptz;

-- start real do culto (âncora do modo ao vivo)
alter table events add column if not exists rundown_started_at timestamptz;

-- seed dos tipos padrão para cada igreja que ainda não tem
insert into rundown_kinds (church_id, label, color, sort_order)
select c.id, k.label, k.color, k.ord
from churches c
cross join (values
  ('Abertura',     '#0e7490', 0),
  ('Louvor',       '#7c3aed', 1),
  ('Oração',       '#2563eb', 2),
  ('Palavra',      '#b45309', 3),
  ('Ministração',  '#be185d', 4),
  ('Ceia',         '#9d174d', 5),
  ('Avisos',       '#0891b2', 6),
  ('Ofertas',      '#15803d', 7),
  ('Vídeo',        '#db2777', 8),
  ('Transição',    '#6b7280', 9),
  ('Encerramento', '#4b5563', 10)
) as k(label, color, ord)
where not exists (select 1 from rundown_kinds rk where rk.church_id = c.id);