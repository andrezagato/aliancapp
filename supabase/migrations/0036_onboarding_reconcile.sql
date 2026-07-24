-- =============================================================================
-- 0036 — Reconciliação de onboarding no login
-- =============================================================================
-- O trigger handle_new_user (0001) só provisiona o profile no PRIMEIRO cadastro
-- (INSERT em auth.users). Isso deixa dois casos presos, sem conserto por reconvite
-- (o trigger nunca dispara de novo num re-login):
--   (a) convite não casou no signup — pessoa logou espontânea, ou o convite foi
--       cancelado antes dela entrar → profile fica 'pendente' / church_id null;
--   (b) conta órfã — o profile foi excluído (hard delete) mas auth.users permaneceu
--       → usuário autenticado SEM profile, em limbo permanente.
--
-- reconciliar_onboarding() roda no login de quem ainda NÃO está ativo: deriva o
-- e-mail de auth.uid() (NUNCA confia em input do cliente, senão daria pra "roubar"
-- o convite de outro e-mail), procura um convite pendente que case e ativa o
-- profile (criando-o se preciso) + memberships do convite. Sem convite, garante ao
-- menos um profile 'pendente' pra pessoa cair na fila de aprovação do admin.
-- SECURITY DEFINER: precisa ler auth.users e escrever profiles/memberships/invites
-- sem depender da RLS do chamador (mesma razão do handle_new_user).

create or replace function reconciliar_onboarding()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_meta  text;
  prof    profiles%rowtype;
  inv     invites%rowtype;
begin
  if v_uid is null then return; end if;

  select * into prof from profiles where id = v_uid;
  -- Já ativo: nada a reconciliar (rota barata pro caso comum).
  if prof.id is not null and prof.status = 'ativo' then return; end if;

  select email,
         coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '')
    into v_email, v_meta
    from auth.users where id = v_uid;
  if v_email is null then return; end if;

  select * into inv
    from invites
   where lower(email) = lower(v_email) and status = 'pendente'
   order by created_at
   limit 1;

  if inv.id is not null then
    -- Ativa: cria o profile (caso órfão) ou promove o pendente, a partir do convite.
    insert into profiles (id, church_id, full_name, email, phone, system_role, status)
    values (
      v_uid, inv.church_id,
      coalesce(nullif(prof.full_name, ''), nullif(inv.full_name, ''), v_meta),
      v_email, coalesce(prof.phone, inv.phone), inv.system_role, 'ativo'
    )
    on conflict (id) do update set
      status      = 'ativo',
      church_id   = excluded.church_id,
      system_role = excluded.system_role,
      full_name   = coalesce(nullif(profiles.full_name, ''), excluded.full_name),
      phone       = coalesce(profiles.phone, excluded.phone),
      updated_at  = now();

    insert into memberships (profile_id, team_id, role)
      select v_uid, it.team_id, it.role
        from invite_teams it
       where it.invite_id = inv.id
      on conflict (profile_id, team_id) do nothing;

    update invites set status = 'aceito' where id = inv.id;
  else
    -- Sem convite pendente: garante um profile 'pendente' (cobre a conta órfã).
    if prof.id is null then
      insert into profiles (id, church_id, full_name, email, status)
      values (v_uid, null, v_meta, v_email, 'pendente')
      on conflict (id) do nothing;
    end if;
  end if;
end; $$;

revoke all on function public.reconciliar_onboarding() from public, anon;
grant execute on function public.reconciliar_onboarding() to authenticated;
