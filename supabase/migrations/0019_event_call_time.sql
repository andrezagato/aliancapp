alter table public.events add column if not exists call_time timestamptz;
comment on column public.events.call_time is 'Horário de chegada da equipe (call time) — antes do início do culto.';