-- =============================================================================
-- 0037 — Chat: canal de EVENTO para escalados + líderes das equipes do evento
-- =============================================================================
-- Antes (0035): evento era legível por `is_admin() OU escalado`. Dois problemas:
--   (1) admin puro via o chat de TODOS os eventos (indesejado);
--   (2) líder que não estava pessoalmente escalado, mas lidera uma equipe do
--       evento, NÃO via — sendo que ele precisa acompanhar.
-- Agora: evento é de quem está ESCALADO no evento OU LIDERA uma equipe que tem
-- requisito nele. Admin não ganha acesso só por ser admin (mas ganha se estiver
-- escalado ou liderar). Isso casa com a aba EVENTOS da UI (escalado + que lidero).

create or replace function public.can_read_channel(p_type text, p_ref uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case p_type
    when 'avisos' then public.is_active() and p_ref = (select church_id from public.profiles where id = auth.uid())
    when 'equipe' then public.is_team_member(p_ref)
    when 'evento' then
      exists (select 1 from public.assignments a
                where a.event_id = p_ref and a.profile_id = auth.uid())
      or exists (select 1 from public.event_requirements er
                   join public.memberships m on m.team_id = er.team_id
                  where er.event_id = p_ref and m.profile_id = auth.uid() and m.role = 'leader')
    else false end;
$$;

create or replace function public.can_post_channel(p_type text, p_ref uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case p_type
    when 'avisos' then public.is_admin() or public.is_any_leader()
    when 'equipe' then public.is_team_member(p_ref)
    when 'evento' then
      exists (select 1 from public.assignments a
                where a.event_id = p_ref and a.profile_id = auth.uid())
      or exists (select 1 from public.event_requirements er
                   join public.memberships m on m.team_id = er.team_id
                  where er.event_id = p_ref and m.profile_id = auth.uid() and m.role = 'leader')
    else false end;
$$;

-- Push do canal de evento: escalados + líderes das equipes do evento (menos o
-- autor e menos os silenciados).
create or replace function public.chat_push_recipients(p_type text, p_ref uuid)
returns table(endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = public as $$
  select ps.endpoint, ps.p256dh, ps.auth
  from public.push_subscriptions ps
  where public.can_post_channel(p_type, p_ref)
    and ps.profile_id <> auth.uid()
    and ps.profile_id in (
      select p.id from public.profiles p
        where p_type = 'avisos' and p.church_id = p_ref and p.status = 'ativo'
      union
      select m.profile_id from public.memberships m
        where p_type = 'equipe' and m.team_id = p_ref
      union
      select a.profile_id from public.assignments a
        where p_type = 'evento' and a.event_id = p_ref and a.profile_id is not null
      union
      select m.profile_id from public.memberships m
        join public.event_requirements er on er.team_id = m.team_id
        where p_type = 'evento' and er.event_id = p_ref and m.role = 'leader'
    )
    and not exists (
      select 1 from public.chat_reads r
      where r.profile_id = ps.profile_id
        and r.channel_type = p_type and r.channel_ref = p_ref and r.muted
    );
$$;
