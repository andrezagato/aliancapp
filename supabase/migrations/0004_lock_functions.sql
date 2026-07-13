-- =============================================================================
-- 0004_lock_functions — least-privilege nas funções expostas via PostgREST
--
-- Em Postgres, funções nascem com EXECUTE pra PUBLIC. Revogar "from anon" não
-- adianta enquanto PUBLIC tiver o grant (anon herda via PUBLIC). Aqui revogamos
-- de PUBLIC e concedemos explicitamente a quem deve poder chamar.
--
--   • helpers de RLS  -> só authenticated (a RLS avalia como o usuário logado)
--   • confirmar/recusar escalação -> só authenticated (agem sobre auth.uid())
--
-- Continua propositalmente acessível a anon (não mexemos):
--   • solicitar_entrada(...)  — formulário público de auto-cadastro
--   • join_requests.join_insert (policy) — idem
-- =============================================================================

-- helpers de RLS
revoke execute on function public.is_active()          from public;
revoke execute on function public.is_admin()           from public;
revoke execute on function public.is_any_leader()      from public;
revoke execute on function public.is_team_member(uuid) from public;
revoke execute on function public.is_team_leader(uuid) from public;
revoke execute on function public.leads_team_of(uuid)  from public;

grant execute on function public.is_active()          to authenticated;
grant execute on function public.is_admin()           to authenticated;
grant execute on function public.is_any_leader()      to authenticated;
grant execute on function public.is_team_member(uuid) to authenticated;
grant execute on function public.is_team_leader(uuid) to authenticated;
grant execute on function public.leads_team_of(uuid)  to authenticated;

-- RPCs de resposta do voluntário: authenticated apenas
revoke execute on function public.confirmar_escalacao(uuid)     from public, anon;
revoke execute on function public.recusar_escalacao(uuid, text) from public, anon;
grant  execute on function public.confirmar_escalacao(uuid)     to authenticated;
grant  execute on function public.recusar_escalacao(uuid, text) to authenticated;
