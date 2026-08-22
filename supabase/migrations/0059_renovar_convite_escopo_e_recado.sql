-- 0059 — RENOVAR CONVITE: escopo de igreja na última checagem, e um recado que
--        diz o que fazer.
--
-- Dois restos que a oitava revisão achou na 0058, e os dois são do mesmo tipo:
-- a regra certa aplicada num lugar e esquecida no vizinho.
--
-- 1) ESCOPO DE IGREJA NA CHECAGEM DE CONVITE DE ADMIN PENDENTE
--    O app escopou essa mesma busca por `church_id` nos dois pontos onde ela
--    aparece em TypeScript (`aprovarJoinRequest` e `reconvidar`), justamente
--    porque `invites_read_leader` é `USING (is_any_leader())` — sem escopo de
--    igreja. Dentro da função, ela continuava sem escopo.
--
--    Com uma segunda igreja: o líder da igreja A tenta renovar, é impedido, e a
--    mensagem — que sobe verbatim pra tela, porque carrega o SQLSTATE 'SIRVO' —
--    revela que existe um convite de ADMIN pendente pra aquele e-mail em outra
--    igreja. Vaza a existência e o papel de um convite de outro tenant.
--
--    Hoje há uma igreja só, então é bomba futura e não dano corrente. Mas o
--    padrão do dia é claro: a regra que só vale enquanto ninguém cresce é a que
--    ninguém lembra de aplicar quando cresce.
--
-- 2) A RECUSA DE LIDERANÇA NÃO DIZIA O QUE FAZER
--    "esse convite dá liderança de uma equipe que não é sua" identifica a
--    classe do problema e deixa a pessoa parada. Quem recebe essa frase é um
--    líder, e ele não tem NENHUMA saída pela tela — não pode cancelar convite,
--    não pode renovar esse. A saída existe (um admin faz), e o recado tem que
--    dizer isso, senão é o beco sem saída de novo, só que educado.
--
-- Fora isso, a função é idêntica à 0058.

create or replace function public.renovar_convite(p_invite uuid)
returns table (token text, email text, full_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invites%rowtype;
  minha_igreja uuid;
begin
  select * into inv from public.invites where id = p_invite;
  if inv.id is null then
    raise exception 'convite não encontrado' using errcode = 'SIRVO';
  end if;

  select p.church_id into minha_igreja from public.profiles p where p.id = auth.uid();
  if minha_igreja is null then
    raise exception 'sua conta não está ligada a uma igreja' using errcode = 'SIRVO';
  end if;

  if not (is_admin() or is_any_leader()) then
    raise exception 'só liderança pode reconvidar' using errcode = 'SIRVO';
  end if;
  if inv.church_id is distinct from minha_igreja then
    raise exception 'esse convite é de outra igreja' using errcode = 'SIRVO';
  end if;

  if inv.system_role <> 'member' then
    raise exception 'convite de administrador não se renova por aqui' using errcode = 'SIRVO';
  end if;
  if inv.status <> 'pendente' then
    raise exception 'este convite não está pendente (está %)', inv.status using errcode = 'SIRVO';
  end if;

  -- (2) recado com próximo passo
  if not is_admin() and exists (
    select 1 from public.invite_teams t
     where t.invite_id = inv.id
       and t.role = 'leader'
       and not is_team_leader(t.team_id)
  ) then
    raise exception 'esse convite dá liderança de uma equipe que não é sua — peça pra um administrador reenviar'
      using errcode = 'SIRVO';
  end if;

  -- (1) `church_id` aqui também
  if exists (
    select 1 from public.invites a
     where lower(btrim(a.email)) = lower(btrim(inv.email))
       and a.church_id = minha_igreja
       and a.status = 'pendente'
       and a.system_role = 'admin'
  ) then
    raise exception 'há um convite de administrador pendente para este e-mail'
      using errcode = 'SIRVO';
  end if;

  update public.invites
     set expires_at = now() + interval '7 days'   -- espelha DIAS_LINK_ENTRADA
   where id = inv.id;

  return query select inv.token, inv.email, inv.full_name;
end;
$$;

revoke all on function public.renovar_convite(uuid) from public, anon;
grant execute on function public.renovar_convite(uuid) to authenticated;
