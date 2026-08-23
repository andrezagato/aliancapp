-- 0057 — RENOVAR CONVITE: escopo por IGREJA, porque "da minha equipe" era mentira.
--
-- A 0056 autorizava o líder por vínculo: o convite ter uma equipe dele em
-- `invite_teams`, ou existir um `join_requests` do mesmo e-mail pedindo a equipe
-- dele. Uma revisão adversarial mostrou que **os dois vínculos são forjáveis**,
-- e não por descuido — pelas policies que já existem:
--
--   · `join_insert` é `INSERT to anon, authenticated WITH CHECK (true)`, e não há
--     constraint nenhuma na tabela. Qualquer um insere um pedido com o e-mail de
--     QUALQUER convite e a equipe que quiser. O `exists(...)` vira verdadeiro.
--   · `invite_teams_insert_leader` deixa um líder pendurar a equipe DELE em
--     qualquer convite `member`. O outro vínculo cai igual.
--
-- Ou seja: `is_team_leader(...)` degenerava em `is_any_leader()`, e a checagem
-- que parecia estreita autorizava qualquer líder sobre qualquer convite do banco
-- — de qualquer igreja, já que nenhum ramo conferia `church_id`.
--
-- Pior: isso era CAPACIDADE NOVA. Antes da 0056 o UPDATE do líder casava 0
-- linhas (não há policy de UPDATE pra líder), então o botão morria. A 0056
-- transformou um botão morto numa escrita cross-equipe que passa por cima da
-- RLS — e `expires_at` é fronteira de segurança na rota `/auth/entrar/[token]`
-- ("convite sem prazo ou vencido não abre porta"). Renovar levanta essa
-- fronteira.
--
-- O QUE ESTA MIGRATION FAZ: tira os dois vínculos e põe no lugar o único escopo
-- que as policies de hoje sustentam de verdade — **a igreja de quem chama**.
--
-- E POR QUE ISSO É ACEITÁVEL, escrito para quem vier depois questionar:
-- qualquer líder já pode, direto no PostgREST com a chave anônima, criar um
-- convite `member` para um e-mail arbitrário da própria igreja
-- (`invites_insert_leader`) e ler o `token` de volta (`invites_read_leader`).
-- Renovar um convite `member` que já existe não lhe dá poder que ele não tenha.
-- O que ele NÃO pode continua valendo: convite de admin é recusado aqui, e a
-- rota de resgate recusa qualquer e-mail que tenha convite de admin pendente.
-- Fingir um escopo mais estreito do que o banco garante é pior que assumir o
-- escopo real — foi assim que a 0056 nasceu errada.
--
-- MUDA TAMBÉM O RETORNO: a função devolve token + e-mail + nome numa linha só.
-- Antes a action renovava e DEPOIS lia o e-mail numa segunda query; se aquela
-- leitura voltasse vazia, ela respondia "convite não encontrado" com o prazo já
-- estendido, e cada retentativa estendia de novo em silêncio.

drop function if exists public.renovar_convite(uuid);

create function public.renovar_convite(p_invite uuid)
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
    raise exception 'convite não encontrado';
  end if;

  select p.church_id into minha_igreja from public.profiles p where p.id = auth.uid();
  if minha_igreja is null then
    raise exception 'sua conta não está ligada a uma igreja';
  end if;

  -- Líder OU admin, e sempre dentro da própria igreja. `is_admin()` também é
  -- escopado aqui de propósito: ele não confere igreja, e no dia em que houver
  -- uma segunda igreja um admin de uma não deve renovar convite da outra.
  if not (is_admin() or is_any_leader()) then
    raise exception 'só liderança pode reconvidar';
  end if;
  if inv.church_id is distinct from minha_igreja then
    raise exception 'esse convite é de outra igreja';
  end if;

  -- As duas recusas que seguram a escalada. Nenhuma é teórica: um convite de
  -- admin pendente é janela de 7 dias, e ressuscitar cancelado desfaz revogação.
  -- A função também não mexe em `status` — o que não pode ser ressuscitado por
  -- construção não depende de ninguém lembrar da checagem.
  if inv.system_role <> 'member' then
    raise exception 'convite de administrador não se renova por aqui';
  end if;
  if inv.status <> 'pendente' then
    raise exception 'este convite não está pendente (está %)', inv.status;
  end if;

  -- Cinto e suspensório com a rota: mesmo renovando um convite `member`, se
  -- houver convite de ADMIN pendente pro mesmo e-mail, manter esse link vivo
  -- alimenta a combinação que a rota recusa. Melhor não emitir.
  if exists (
    select 1 from public.invites a
     where lower(btrim(a.email)) = lower(btrim(inv.email))
       and a.status = 'pendente'
       and a.system_role = 'admin'
  ) then
    raise exception 'há um convite de administrador pendente para este e-mail';
  end if;

  update public.invites
     set expires_at = now() + interval '7 days'   -- espelha DIAS_LINK_ENTRADA
   where id = inv.id;

  return query select inv.token, inv.email, inv.full_name;
end;
$$;

revoke all on function public.renovar_convite(uuid) from public, anon;
grant execute on function public.renovar_convite(uuid) to authenticated;
