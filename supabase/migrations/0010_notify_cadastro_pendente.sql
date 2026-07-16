-- cadastro_pendente: avisa os admins quando alguém pede pra entrar.
-- (1) recria solicitar_entrada (mesma lógica do 0003) + notifica admins;
-- (2) trigger em profiles pendentes (login espontâneo sem convite) notifica admins.

create or replace function solicitar_entrada(
  p_full_name text,
  p_email     text,
  p_phone     text,
  p_message   text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  if coalesce(btrim(p_full_name), '') = '' then
    raise exception 'Informe seu nome';
  end if;
  select id into cid from churches order by created_at limit 1;
  if cid is null then
    raise exception 'Nenhuma igreja configurada ainda';
  end if;
  insert into join_requests (church_id, full_name, email, phone, message)
  values (cid, btrim(p_full_name), nullif(btrim(p_email), ''),
          nullif(btrim(p_phone), ''), nullif(btrim(p_message), ''));
  insert into notifications (recipient_id, kind, title, body, link)
  select id, 'cadastro_pendente', 'Nova solicitação de entrada',
         btrim(p_full_name) || ' pediu pra entrar.', '/pessoas'
  from profiles
  where church_id = cid and system_role = 'admin' and status = 'ativo';
end;
$$;

grant execute on function solicitar_entrada(text, text, text, text) to anon, authenticated;

create or replace function public.notify_admins_new_pending() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (recipient_id, kind, title, body, link)
  select id, 'cadastro_pendente', 'Nova solicitação de entrada',
         coalesce(nullif(btrim(new.full_name), ''), 'Alguém') || ' entrou e aguarda aprovação.', '/pessoas'
  from profiles
  where system_role = 'admin' and status = 'ativo' and id <> new.id;
  return new;
end;
$$;

drop trigger if exists trg_notify_admins_new_pending on public.profiles;
create trigger trg_notify_admins_new_pending
after insert on public.profiles
for each row when (new.status = 'pendente')
execute function public.notify_admins_new_pending();
