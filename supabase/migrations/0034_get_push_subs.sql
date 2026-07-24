-- WS2.1 fix — ler as push_subscriptions do DESTINATÁRIO sem depender de service-role.
-- SECURITY DEFINER contorna a RLS push_all (profile_id = auth.uid()), mas o acesso
-- é restrito a admin/líder — os únicos papéis que disparam avisos com push
-- (escalar, lembrete, criar evento). Volunteer comum não consegue colher subs de terceiros.
create or replace function public.get_push_subs(p_profile uuid)
returns table(endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = public as $$
  select ps.endpoint, ps.p256dh, ps.auth
  from public.push_subscriptions ps
  where ps.profile_id = p_profile
    and (public.is_admin() or public.is_any_leader());
$$;
grant execute on function public.get_push_subs(uuid) to authenticated;
