-- 0040_equipe_desejada_aprovacao_lider
--
-- Pessoa escolhe UMA equipe desejada ao pedir entrada (cadastro público ou
-- perfil pendente por login espontâneo). O líder daquela equipe passa a poder
-- aprovar (hoje só admin). Equipes extras: fluxo já existente de "pedir para
-- servir" (service_interests), que já é escopado por líder via team_id.

-- 1) Equipe desejada nas duas portas de entrada pendente.
alter table join_requests add column if not exists desired_team_id uuid references teams(id) on delete set null;
alter table profiles       add column if not exists desired_team_id uuid references teams(id) on delete set null;

-- 2) RPC pública pra listar equipes: anon (cadastro) e autenticado-pendente
--    (tela de espera) não conseguem ler `teams` via RLS normal — teams_read
--    exige is_active() (já provisionado) ou is_admin().
create or replace function listar_equipes_publicas()
returns table (id uuid, name text, color text, icon text)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.color, t.icon
    from teams t
   where t.archived_at is null
   order by t.sort_order
   limit 200;
$$;
grant execute on function listar_equipes_publicas() to anon, authenticated;

-- 3) solicitar_entrada passa a receber a equipe desejada (opcional) e avisa
--    o(s) líder(es) dela, além dos admins (comportamento já existente).
drop function if exists solicitar_entrada(text, text, text, text);
create or replace function solicitar_entrada(
  p_full_name text,
  p_email     text,
  p_phone     text,
  p_message   text,
  p_desired_team_id uuid default null
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

  select id into cid from churches order by created_at limit 1;  -- MVP: uma igreja
  if cid is null then
    raise exception 'Nenhuma igreja configurada ainda';
  end if;

  insert into join_requests (church_id, full_name, email, phone, message, desired_team_id)
  values (cid, btrim(p_full_name), nullif(btrim(p_email), ''),
          nullif(btrim(p_phone), ''), nullif(btrim(p_message), ''), p_desired_team_id);

  insert into notifications (recipient_id, kind, title, body, link)
  select id, 'cadastro_pendente', 'Nova solicitação de entrada',
         btrim(p_full_name) || ' pediu pra entrar.', '/equipes'
  from profiles
  where church_id = cid and system_role = 'admin' and status = 'ativo';

  if p_desired_team_id is not null then
    insert into notifications (recipient_id, kind, title, body, link, team_id)
    select m.profile_id, 'cadastro_pendente', 'Alguém quer entrar na sua equipe',
           btrim(p_full_name) || ' pediu pra servir na sua equipe.', '/equipes', p_desired_team_id
      from memberships m
     where m.team_id = p_desired_team_id and m.role = 'leader';
  end if;
end;
$$;
grant execute on function solicitar_entrada(text, text, text, text, uuid) to anon, authenticated;

-- 4) join_requests: escopo de leitura/resolução por equipe (hoje é
--    is_any_leader() global — qualquer líder via qualquer pedido).
drop policy if exists join_read on join_requests;
create policy join_read on join_requests for select to authenticated
  using (is_admin() or (desired_team_id is not null and is_team_leader(desired_team_id)));

drop policy if exists join_resolve on join_requests;
create policy join_resolve on join_requests for update to authenticated
  using (is_admin() or (desired_team_id is not null and is_team_leader(desired_team_id)))
  with check (is_admin() or (desired_team_id is not null and is_team_leader(desired_team_id)));

-- 5) Trigger de guarda: permite um líder ativar um profile PENDENTE que pediu
--    a equipe dele (desired_team_id), fixando church_id na igreja do próprio
--    líder. Continua bloqueando qualquer outra mudança de status/church_id/
--    system_role por não-admin (líder não se auto-promove, não ativa gente
--    fora da própria equipe, não reverte status de quem já foi resolvido).
create or replace function profiles_guard_privileged()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  leader_can_activate boolean;
begin
  if exists (select 1 from profiles where id = auth.uid() and system_role = 'admin') then
    return new;  -- admin pode tudo
  end if;

  leader_can_activate :=
    old.status = 'pendente'
    and new.status = 'ativo'
    and new.system_role = old.system_role
    and old.desired_team_id is not null
    and is_team_leader(old.desired_team_id);

  if leader_can_activate then
    new.church_id := (select church_id from profiles where id = auth.uid());
    return new;
  end if;

  new.system_role := old.system_role;
  new.status      := old.status;
  new.church_id   := old.church_id;
  return new;
end; $$;
