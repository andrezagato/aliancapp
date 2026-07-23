alter table public.events add column if not exists archived_at timestamptz;
comment on column public.events.archived_at is 'Evento arquivado (some das listas, mas mantém o histórico). NULL = ativo.';