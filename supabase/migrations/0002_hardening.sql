-- =============================================================================
-- 0002_hardening — fecha os WARNs do Supabase advisor (segurança)
--
-- O schema 0001 já estava aplicado no banco quando esta migração foi escrita.
-- Aqui NÃO mexemos em estrutura (tabelas/policies): só endurecemos as funções.
--
--   1) search_path fixo nas duas funções que faltavam (as demais já têm).
--   2) funções que são SÓ de trigger não devem ser chamáveis via PostgREST /rpc.
--   3) helpers de RLS: 'authenticated' precisa (a RLS avalia como o usuário logado);
--      'anon' não usa nenhuma policy que as referencie -> tira do alcance do anon.
--
-- Observação: revogar EXECUTE de funções de TRIGGER não quebra os triggers —
-- eles rodam no contexto do owner da tabela, independente do grant do chamador.
-- =============================================================================

-- 1) search_path fixo
alter function public.set_updated_at()         set search_path = public;
alter function public.check_position_in_team() set search_path = public;

-- 2) funções de trigger fora da API REST
revoke all on function public.handle_new_user()           from public, anon, authenticated;
revoke all on function public.profiles_guard_privileged() from public, anon, authenticated;
revoke all on function public.set_updated_at()            from public, anon, authenticated;
revoke all on function public.check_position_in_team()    from public, anon, authenticated;

-- 3) helpers de RLS: mantém 'authenticated', remove do 'anon'
revoke execute on function public.is_active()          from anon;
revoke execute on function public.is_admin()           from anon;
revoke execute on function public.is_any_leader()      from anon;
revoke execute on function public.is_team_member(uuid) from anon;
revoke execute on function public.is_team_leader(uuid) from anon;
revoke execute on function public.leads_team_of(uuid)  from anon;
