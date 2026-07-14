-- =============================================================================
-- 0005_series_teams — modelos de evento por EQUIPE
--
-- No modelo novo o admin sinaliza só as equipes; as posições vêm do cadastro da
-- equipe na hora do evento. Um "modelo de evento" (event_series) guarda quais
-- equipes costumam servir — daí criar um culto vira: escolher o modelo, que já
-- marca as equipes e o horário/local padrão. As posições continuam sendo do líder.
-- =============================================================================

create table series_teams (
  series_id uuid not null references event_series(id) on delete cascade,
  team_id   uuid not null references teams(id) on delete cascade,
  primary key (series_id, team_id)
);

alter table series_teams enable row level security;

create policy series_teams_read   on series_teams for select to authenticated using (is_active() or is_admin());
create policy series_teams_manage on series_teams for all    to authenticated using (is_admin()) with check (is_admin());

grant select, insert, update, delete on series_teams to authenticated;
