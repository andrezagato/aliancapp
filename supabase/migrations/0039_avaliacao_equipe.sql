-- Avaliação da equipe pós-culto (o LÍDER avalia). Privado à liderança/admin.
-- É separado de event_feedback (auto-avaliação PRIVADA do voluntário, "a voz dele").
--   culto_avaliacoes  = nota 1-5 do culto, uma por (evento, autor-líder)
--   pessoa_observacoes = texto por pessoa que serviu, uma por (evento, autor, pessoa)

create table if not exists public.culto_avaliacoes (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, author_id)
);

create table if not exists public.pessoa_observacoes (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.profiles(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, author_id, subject_id)
);

create index if not exists idx_pessoa_obs_subject on public.pessoa_observacoes (subject_id);
create index if not exists idx_culto_aval_event on public.culto_avaliacoes (event_id);

alter table public.culto_avaliacoes enable row level security;
alter table public.pessoa_observacoes enable row level security;

-- Lê quem escreveu OU admin; escreve só o próprio autor, e só se admin ou líder.
create policy culto_avaliacoes_rw on public.culto_avaliacoes
  for all
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() and (public.is_admin() or public.is_any_leader()));

create policy pessoa_observacoes_rw on public.pessoa_observacoes
  for all
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() and (public.is_admin() or public.is_any_leader()));
