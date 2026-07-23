create or replace function public.notificar(
  p_recipient uuid,
  p_kind notification_kind,
  p_title text,
  p_body text default null,
  p_link text default null,
  p_team uuid default null,
  p_event uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active() then
    raise exception 'not allowed';
  end if;
  if p_recipient is null or p_recipient = auth.uid() then
    return;
  end if;
  insert into public.notifications (recipient_id, kind, title, body, link, team_id, event_id)
  values (p_recipient, p_kind, p_title, p_body, p_link, p_team, p_event);
end;
$$;

revoke all on function public.notificar(uuid, notification_kind, text, text, text, uuid, uuid) from anon;
grant execute on function public.notificar(uuid, notification_kind, text, text, text, uuid, uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;