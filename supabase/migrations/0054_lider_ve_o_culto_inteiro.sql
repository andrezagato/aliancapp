-- =============================================================================
-- 0054 — Líder vê o CULTO INTEIRO (as outras equipes, em modo leitura)
-- =============================================================================
-- Os líderes pediram: abrir um culto e enxergar TODAS as equipes — quem está
-- escalado, em que posição, e se confirmou. Só isso. Escalar, ajustar requisito
-- e remover continuam sendo só da equipe que ele lidera.
--
-- Duas das três tabelas envolvidas JÁ deixavam ele ler tudo desde a 0001:
--   · event_requirements → `event_req_read` = is_active() or is_admin()
--   · profiles           → `profiles_read`  = id = auth.uid() or is_active() or is_admin()
-- A que trava é a terceira:
--   · assignments        → `assignments_read` = is_admin() or is_team_member(team_id)
--
-- POR QUE RPC E NÃO ABRIR A POLÍTICA:
--   1) RLS é linha, não coluna, e não sabe o que é "um culto". Um `or
--      is_any_leader()` entrega a QUALQUER líder o histórico inteiro de
--      escalações da igreja por uma chamada crua de API — inclusive o
--      `decline_reason`, que é a justificativa privada de quem recusou.
--   2) `assignments` é lida em ~25 lugares com o cliente do próprio usuário e
--      pela view `v_assignment_history`, que é `security_invoker` e segue a RLS
--      de quem chama. Mexer na política mexe em todos de uma vez — e a decisão
--      do dono é que a home e o calendário NÃO mudam.
--   3) O pedido diz "nome, posição e status" e diz para NÃO expor telefone de
--      gente de outra equipe. Isso é regra de COLUNA. RLS não faz coluna.
--   4) É o raciocínio já escrito na 0029 e na 0049.
--
-- O QUE ESTA MIGRATION NÃO FAZ: não cria, não altera e não remove NENHUMA
-- policy. Quem não chamar `escala_do_culto` continua enxergando exatamente o
-- que enxergava ontem. Desfazer é um `drop function`.
--
-- NOTA DE ESCRITA: os nomes do `returns table` sombreiam os nomes de coluna
-- dentro do corpo. Por isso TODA referência está qualificada com `a.` ou `p.`.

create or replace function public.escala_do_culto(p_event uuid)
returns table (
  id             uuid,
  team_id        uuid,
  position_id    uuid,
  profile_id     uuid,
  status         public.assignment_status,
  decline_reason text,
  full_name      text,
  avatar_url     text,
  phone          text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.team_id,
    a.position_id,
    a.profile_id,
    a.status,
    -- Justificativa de recusa é conversa entre a pessoa e o líder DELA.
    case when public.is_admin() or public.is_team_leader(a.team_id)
         then a.decline_reason end,
    p.full_name,
    p.avatar_url,
    -- O telefone só sai pra quem de fato gerencia aquela equipe — mesmo teste
    -- do `canManage` do app. Observador recebe null, e o <WhatsAppButton> já
    -- some sozinho quando o telefone é null.
    case when public.is_admin() or public.is_team_leader(a.team_id)
         then p.phone end
  from public.assignments a
  left join public.profiles p on p.id = a.profile_id
  where a.event_id = p_event
    and public.is_active()
    and (
      public.is_admin()
      or public.is_any_leader()
      -- voluntário continua compartimentado, igual à policy de hoje
      or public.is_team_member(a.team_id)
    );
$$;

revoke all on function public.escala_do_culto(uuid) from public, anon;
grant execute on function public.escala_do_culto(uuid) to authenticated;
