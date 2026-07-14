-- =============================================================================
-- 0006_swap_accept — troca com aceite do substituto antes da aprovação do líder
--
-- Fluxo: voluntário pede troca sugerindo alguém -> o substituto ACEITA (grava
-- substitute_accepted_at) -> o líder APROVA (reatribui a escala). Sem aceite,
-- o líder não deve aprovar.
--
-- Precisamos que o substituto (suggested_profile_id) possa LER e ATUALIZAR o
-- próprio pedido — as policies atuais só cobrem dono, admin e líder da equipe.
-- =============================================================================

alter table swap_requests add column if not exists substitute_accepted_at timestamptz;

create policy swaps_read_substitute on swap_requests for select to authenticated
  using (suggested_profile_id = auth.uid());

create policy swaps_substitute on swap_requests for update to authenticated
  using (suggested_profile_id = auth.uid())
  with check (suggested_profile_id = auth.uid());
