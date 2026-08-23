-- 0058 — E-MAIL CANÔNICO em `invites`, e o Reconvidar para de desvencer liderança.
--
-- Duas coisas que a terceira revisão adversarial achou, e as duas são da mesma
-- família: uma afirmação minha que o sistema não sustentava.
--
-- ---------------------------------------------------------------------------
-- 1) TRÊS NORMALIZADORES DECIDINDO A MESMA COISA
-- ---------------------------------------------------------------------------
-- A trava de escalada em `/auth/entrar/[token]` compara e-mail em JS
-- (`trim().toLowerCase()`). O `handle_new_user` compara com `lower()` no
-- Postgres. E quem grava `auth.users.email` é o GoTrue, em Go — cujo
-- `strings.ToLower` faz *simple case mapping*, enquanto JS e este Postgres
-- (17.6, en_US.UTF-8) fazem *full*. Elas divergem: `İ` (U+0130) vira 1
-- codepoint no Go e 2 no JS/PG.
--
-- Consequência possível: convite de admin pendente pra `isabel@…`; um líder
-- insere um convite `member` pra `İsabel@…` (a policy permite); a trava da rota
-- vê strings diferentes e LIBERA; o GoTrue grava `isabel@…`; o trigger casa o
-- convite de ADMIN e provisiona admin. O elo não confirmado é se o GoTrue aceita
-- local-part não-ASCII — não deu pra testar. Mas a defesa não deve depender
-- disso, e sim de as três strings serem a MESMA string.
--
-- Esta constraint mata a classe na origem: `invites.email` só existe em forma
-- canônica e ASCII. Onde não há maiúscula, espaço nem caractere fora do ASCII,
-- os três normalizadores concordam por construção. As 41 linhas de hoje já
-- satisfazem (conferido antes de aplicar).
--
-- O app já grava `.trim().toLowerCase()` em `criarConvite`, `aprovarJoinRequest`
-- e `reconvidar` — então isto não muda comportamento, apenas impede que um
-- caminho futuro esqueça. E se esquecer, o insert falha ALTO em vez de abrir uma
-- brecha calada.

alter table public.invites
  drop constraint if exists invites_email_canonico;

alter table public.invites
  add constraint invites_email_canonico check (
    email = lower(btrim(email))
    and email ~ '^[\x21-\x7e]+@[\x21-\x7e]+$'
  );

-- ---------------------------------------------------------------------------
-- 2) RENOVAR NÃO PODE DESVENCER UMA LIDERANÇA DE OUTRA EQUIPE
-- ---------------------------------------------------------------------------
-- O cabeçalho da 0057 afirma: "renovar um convite `member` que já existe não lhe
-- dá poder que ele não tenha". Isso está ERRADO, e a revisão mostrou por quê.
--
-- Um convite pode carregar `invite_teams` com `role='leader'` — o admin cria
-- assim ao convidar um líder novo (há 10 linhas dessas no banco). O líder da
-- equipe A não consegue CRIAR uma linha dessas pra equipe B
-- (`invite_teams_insert_leader` exige `is_team_leader(team_id)`), mas com a 0057
-- ele conseguia RESSUSCITAR um convite vencido que já a tinha, ler o token e
-- resgatar — virando líder da equipe B.
--
-- O delta exato que a 0057 adicionou é o poder de DESVENCER: um convite desses
-- ainda no prazo já era resgatável assim antes dela. Mesmo assim é capacidade
-- nova, e o `expires_at` é fronteira de segurança na rota de resgate.
--
-- Agora: quem não lidera a equipe não renova convite que dá liderança dela.
--
-- Também troca o SQLSTATE dos `raise` por um marcador próprio. A action
-- classificava a mensagem por REGEX pra decidir se mostrava na tela — e o regex
-- casava com o nome da própria função, então `permission denied for function
-- renovar_convite` ia verbatim pra tela do voluntário. Marcador não tem esse
-- problema: ou o erro é nosso, ou é do Postgres.

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

  -- NOVO (ver bloco 2 acima): liderança de equipe que não é sua não se desvence.
  if not is_admin() and exists (
    select 1 from public.invite_teams t
     where t.invite_id = inv.id
       and t.role = 'leader'
       and not is_team_leader(t.team_id)
  ) then
    raise exception 'esse convite dá liderança de uma equipe que não é sua'
      using errcode = 'SIRVO';
  end if;

  if exists (
    select 1 from public.invites a
     where lower(btrim(a.email)) = lower(btrim(inv.email))
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
