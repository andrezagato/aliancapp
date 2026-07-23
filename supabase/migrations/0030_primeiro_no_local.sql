-- Gamificação: "Primeiro no local" — nº de eventos em que o usuário logado foi
-- o PRIMEIRO a fazer check-in ESTANDO no local (at_location = true).
-- SECURITY DEFINER porque o cálculo precisa enxergar os check-ins de TODAS as
-- equipes do evento — a RLS de checkins limita cada um à própria equipe.
create or replace function public.primeiro_no_local_count()
returns integer language sql stable security definer set search_path = public as $$
  with first_per_event as (
    select a.event_id, min(c.checked_at) as first_at
    from public.checkins c
    join public.assignments a on a.id = c.assignment_id
    where c.at_location = true
    group by a.event_id
  )
  select count(distinct a.event_id)::int
  from public.checkins c
  join public.assignments a on a.id = c.assignment_id
  join first_per_event f on f.event_id = a.event_id and f.first_at = c.checked_at
  where c.at_location = true and a.profile_id = auth.uid();
$$;
grant execute on function public.primeiro_no_local_count() to authenticated;
