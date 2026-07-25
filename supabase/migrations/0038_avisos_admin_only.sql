-- Avisos gerais viram mural SÓ do admin (antes: admin OU qualquer líder).
-- Leitura continua aberta a todo ativo; muda apenas quem POSTA.
create or replace function public.can_post_channel(p_type text, p_ref uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case p_type
    when 'avisos' then public.is_admin()
    when 'equipe' then public.is_team_member(p_ref)
    when 'evento' then public.is_admin() or exists (
      select 1 from public.assignments a where a.event_id = p_ref and a.profile_id = auth.uid())
    else false end;
$$;
grant execute on function public.can_post_channel(text, uuid) to authenticated;
