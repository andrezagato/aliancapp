-- 0044 — fazer `notification_prefs` valer de verdade (WS2.2).
--
-- A tabela existe desde o começo e NINGUÉM lê: todo aviso ia pro sino e todo
-- push saía, independente do que a pessoa quisesse. Duas coisas travavam:
--
-- (1) RLS: `prefs_all` só deixa cada um ver a PRÓPRIA linha (profile_id =
--     auth.uid()). Quem dispara o aviso é outra pessoa (quem escala, quem cria o
--     evento) — ela não consegue ler a preferência do destinatário. Mesma
--     situação do push, que já resolve isso com RPC (get_push_subs).
--     -> `aviso_prefs()` SECURITY DEFINER devolve a preferência do destinatário
--        já com o default (linha ausente = tudo ligado).
--
-- (2) `notificar()` não consultava nada. Agora respeita `in_app`.
--
-- De passagem, um bug: `notificar` devolve cedo quando o destinatário é o
-- próprio autor (guarda contra se auto-notificar a cada ação). Só que a
-- conquista É pra si mesmo — então o aviso de "🏆 Nova conquista" nunca chegava
-- ao sino de ninguém. `conquista` passa a ser a exceção da guarda.

create or replace function public.aviso_prefs(p_recipient uuid, p_kind notification_kind)
returns table (push boolean, email boolean, in_app boolean)
language sql
security definer
stable
set search_path to 'public'
as $$
  select
    coalesce(np.push, true) as push,
    coalesce(np.email, true) as email,
    coalesce(np.in_app, true) as in_app
  from (select 1) as _
  left join public.notification_prefs np
    on np.profile_id = p_recipient and np.kind = p_kind;
$$;

revoke all on function public.aviso_prefs(uuid, notification_kind) from public;
grant execute on function public.aviso_prefs(uuid, notification_kind) to authenticated;

create or replace function public.notificar(
  p_recipient uuid,
  p_kind notification_kind,
  p_title text,
  p_body text default null,
  p_link text default null,
  p_team uuid default null,
  p_event uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_in_app boolean;
begin
  if not public.is_active() then
    raise exception 'not allowed';
  end if;
  if p_recipient is null then
    return;
  end if;
  -- conquista é o único aviso que faz sentido pra si mesmo
  if p_recipient = auth.uid() and p_kind <> 'conquista' then
    return;
  end if;

  select in_app into v_in_app from public.aviso_prefs(p_recipient, p_kind);
  if not coalesce(v_in_app, true) then
    return;
  end if;

  insert into public.notifications (recipient_id, kind, title, body, link, team_id, event_id)
  values (p_recipient, p_kind, p_title, p_body, p_link, p_team, p_event);
end;
$function$;
