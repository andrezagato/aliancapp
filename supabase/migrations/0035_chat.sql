-- Chat interno v1 — 3 canais: 'avisos' (igreja), 'equipe' (team), 'evento' (event).
-- channel_ref sempre não-nulo: avisos=church_id, equipe=team_id, evento=event_id.

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  channel_type text not null check (channel_type in ('avisos', 'equipe', 'evento')),
  channel_ref uuid not null,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_channel_idx
  on public.chat_messages (channel_type, channel_ref, created_at desc);

create table if not exists public.chat_reads (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  channel_type text not null,
  channel_ref uuid not null,
  last_read_at timestamptz not null default now(),
  muted boolean not null default false,
  primary key (profile_id, channel_type, channel_ref)
);

alter table public.chat_messages enable row level security;
alter table public.chat_reads enable row level security;

-- Quem pode LER o canal (participação derivada dos dados).
create or replace function public.can_read_channel(p_type text, p_ref uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case p_type
    when 'avisos' then public.is_active() and p_ref = (select church_id from public.profiles where id = auth.uid())
    when 'equipe' then public.is_team_member(p_ref)
    when 'evento' then public.is_admin() or exists (
      select 1 from public.assignments a where a.event_id = p_ref and a.profile_id = auth.uid())
    else false end;
$$;
grant execute on function public.can_read_channel(text, uuid) to authenticated;

-- Quem pode POSTAR. Avisos = mural (admin/líder) no v1.
create or replace function public.can_post_channel(p_type text, p_ref uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case p_type
    when 'avisos' then public.is_admin() or public.is_any_leader()
    when 'equipe' then public.is_team_member(p_ref)
    when 'evento' then public.is_admin() or exists (
      select 1 from public.assignments a where a.event_id = p_ref and a.profile_id = auth.uid())
    else false end;
$$;
grant execute on function public.can_post_channel(text, uuid) to authenticated;

create policy chat_messages_read on public.chat_messages
  for select using (public.can_read_channel(channel_type, channel_ref));
create policy chat_messages_insert on public.chat_messages
  for insert with check (sender_id = auth.uid() and public.can_post_channel(channel_type, channel_ref));
create policy chat_messages_delete on public.chat_messages
  for delete using (sender_id = auth.uid() or public.is_admin());

create policy chat_reads_all on public.chat_reads
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Realtime pra atualizar o chat/badge ao vivo.
alter publication supabase_realtime add table public.chat_messages;

-- Destinatários de push ao postar: membros do canal, menos o autor, menos os que silenciaram.
-- SECURITY DEFINER; guarda: só quem pode postar no canal chama isso.
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
    )
    and not exists (
      select 1 from public.chat_reads r
      where r.profile_id = ps.profile_id
        and r.channel_type = p_type and r.channel_ref = p_ref and r.muted
    );
$$;
grant execute on function public.chat_push_recipients(text, uuid) to authenticated;
