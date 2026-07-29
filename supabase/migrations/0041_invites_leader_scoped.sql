-- 0041_invites_leader_scoped
--
-- aprovarJoinRequest (0040) passou a poder ser chamado por um líder de equipe
-- (quando join_requests.desired_team_id é a equipe dele), mas invites/
-- invite_teams eram estritamente admin-only na RLS — o insert do convite
-- falharia pro líder. Libera, escopado: líder só cria convite 'member' (nunca
-- 'admin') pra própria igreja, e só adiciona à invite_teams a equipe que ele
-- lidera.
create policy invites_insert_leader on invites for insert to authenticated
  with check (
    is_any_leader()
    and system_role = 'member'
    and church_id = (select church_id from profiles where id = auth.uid())
  );

create policy invite_teams_insert_leader on invite_teams for insert to authenticated
  with check (
    is_team_leader(team_id)
    and exists (select 1 from invites i where i.id = invite_id and i.system_role = 'member')
  );
