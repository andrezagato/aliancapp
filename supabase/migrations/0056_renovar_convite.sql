-- 0056 — RENOVAR CONVITE: o Reconvidar do líder passa a existir de verdade.
--
-- O BOTÃO NASCEU MORTO. A 0055 e o commit d2a2d9d entregaram um "Reconvidar" na
-- fila de Equipes, visível pro líder por decisão de produto (mostrar problema pra
-- quem não pode resolver é criar um segundo lugar onde a coisa trava). Só que
-- `invites` tem policy de UPDATE só pra admin:
--
--   invites_admin         ALL     is_admin()
--   invites_insert_leader INSERT  is_any_leader() AND system_role='member' AND mesma igreja
--   invites_read_leader   SELECT  is_any_leader()          ← sem escopo de igreja
--
-- Resultado: o update do líder casava 0 linhas, o erro era descartado, e os 13
-- líderes recebiam "Não consegui gerar o link de acesso do convite" — mensagem
-- que nem diz que o problema é permissão. É a MESMA classe de bug das 0029 e
-- 0049 (app libera, RLS bloqueia, ninguém avisa), agora escrita por quem estava
-- justamente construindo o remédio pra ela.
--
-- POR QUE RPC E NÃO UMA POLICY DE UPDATE. Alargar `invites` seria andar pra trás:
-- a revisão de segurança mostrou que ela JÁ é legível demais — `invites_read_leader`
-- não tem escopo de igreja e não esconde `token`, que é a credencial de
-- /auth/entrar/[token]. Uma policy de UPDATE pra líder ampliaria a mesma
-- superfície. Aqui a permissão fica dentro da função, escrita e legível, e a
-- tabela não muda de tamanho.
--
-- AS DUAS RECUSAS SÃO O CORAÇÃO DISTO, e nenhuma é teórica:
--
--  · `system_role <> 'member'` — um convite de ADMIN pendente é uma janela de
--    escalada de 7 dias: qualquer líder lê o token pelo PostgREST com a chave
--    anônima e o resgata, porque o e-mail ainda não tem conta e o GoTrue devolve
--    'signup'. O `handle_new_user` então provisiona o perfil com system_role do
--    convite — admin. Fechado aqui E na rota (que é onde o resgate acontece).
--
--  · `status <> 'pendente'` — sem isto, "renovar" ressuscita convite CANCELADO:
--    o id vem do cliente, e um convite cancelado continua legível por qualquer
--    líder. Seria desfazer uma revogação sem deixar rastro. Por isso a função
--    também NÃO mexe em `status` — ela só estende o prazo de quem já está
--    pendente. O que não pode ser ressuscitado por construção não depende de
--    ninguém lembrar da checagem.
--
-- O prazo de 7 dias vive aqui, não vem por parâmetro: parâmetro deixaria um
-- chamador autenticado pedir um link de 10 anos. Espelha DIAS_LINK_ENTRADA em
-- src/lib/email.ts — se um mudar, mude o outro.

create or replace function public.renovar_convite(p_invite uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invites%rowtype;
begin
  select * into inv from public.invites where id = p_invite;

  if inv.id is null then
    raise exception 'convite não encontrado';
  end if;

  -- Admin renova qualquer um. Líder só de quem é da equipe dele — pelas equipes
  -- marcadas no convite OU pelo pedido de entrada da mesma pessoa, porque
  -- `aprovarJoinRequest` cria convite SEM invite_teams quando ninguém marca
  -- equipe, e nesse caso o pedido é o único vínculo que existe.
  if not is_admin() then
    if not exists (
          select 1 from public.invite_teams it
           where it.invite_id = inv.id and is_team_leader(it.team_id)
        )
       and not exists (
          select 1 from public.join_requests jr
           where lower(btrim(jr.email)) = lower(btrim(inv.email))
             and jr.desired_team_id is not null
             and is_team_leader(jr.desired_team_id)
        )
    then
      raise exception 'você só pode reconvidar gente da sua equipe';
    end if;
  end if;

  if inv.system_role <> 'member' then
    raise exception 'convite de administrador não se renova por aqui';
  end if;

  if inv.status <> 'pendente' then
    raise exception 'este convite não está pendente (está %)', inv.status;
  end if;

  update public.invites
     set expires_at = now() + interval '7 days'
   where id = inv.id;

  return inv.token;
end;
$$;

-- `anon` fica de fora: renovar convite é ato de quem já está dentro.
revoke all on function public.renovar_convite(uuid) from public, anon;
grant execute on function public.renovar_convite(uuid) to authenticated;
