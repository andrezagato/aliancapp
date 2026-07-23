-- Resolução de interesse: líder responde (aceita/recusa) com motivo + histórico
alter table public.service_interests
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null,
  add column if not exists resolved_note text,
  add column if not exists resolved_at timestamptz;