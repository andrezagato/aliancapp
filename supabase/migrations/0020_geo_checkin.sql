alter table public.churches
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists checkin_radius_m integer not null default 200;

alter table public.checkins add column if not exists at_location boolean;