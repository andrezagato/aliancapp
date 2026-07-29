-- 0042_profiles_leader_activate
--
-- aprovarProfilePendente (0040) permite líder ativar um profile pendente que
-- pediu a equipe dele, mas profiles só tinha policy de UPDATE pro próprio
-- dono (profiles_update_self) ou admin (profiles_admin_write) — faltava a
-- policy que deixa um líder alcançar a linha de OUTRA pessoa. O trigger
-- profiles_guard_privileged continua sendo o guarda real de
-- status/church_id/system_role; esta policy só abre a linha pro update
-- chegar até o trigger.
create policy profiles_leader_activate on profiles for update to authenticated
  using (
    status = 'pendente'
    and desired_team_id is not null
    and is_team_leader(desired_team_id)
  )
  with check (
    is_team_leader(desired_team_id)
  );
