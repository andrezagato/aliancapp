-- Local por evento (override do local da igreja — ex.: retiro fora)
alter table public.events
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

-- Call time no modelo de culto (série)
alter table public.event_series add column if not exists call_time time;