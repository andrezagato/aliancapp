-- Índices de cobertura pras FKs usadas nas consultas mais frequentes (joins/filtros/cascade).
create index if not exists idx_assignments_event on public.assignments (event_id);
create index if not exists idx_assignments_profile on public.assignments (profile_id);
create index if not exists idx_assignments_team on public.assignments (team_id);
create index if not exists idx_assignments_position on public.assignments (position_id);
create index if not exists idx_assignments_requirement on public.assignments (requirement_id);

create index if not exists idx_event_req_event on public.event_requirements (event_id);
create index if not exists idx_event_req_team on public.event_requirements (team_id);
create index if not exists idx_event_req_position on public.event_requirements (position_id);

create index if not exists idx_memberships_profile on public.memberships (profile_id);
create index if not exists idx_memberships_team on public.memberships (team_id);

create index if not exists idx_notifications_recipient on public.notifications (recipient_id);

create index if not exists idx_service_interests_team on public.service_interests (team_id);
create index if not exists idx_service_interests_profile on public.service_interests (profile_id);

create index if not exists idx_swap_assignment on public.swap_requests (assignment_id);
create index if not exists idx_swap_suggested on public.swap_requests (suggested_profile_id);
create index if not exists idx_swap_requested_by on public.swap_requests (requested_by);

create index if not exists idx_events_church on public.events (church_id);
create index if not exists idx_events_responsible on public.events (responsible_id);
create index if not exists idx_events_series on public.events (series_id);

create index if not exists idx_event_requests_requested_by on public.event_requests (requested_by);
create index if not exists idx_event_feedback_event on public.event_feedback (event_id);

create index if not exists idx_activity_actor on public.activity_log (actor_id);
create index if not exists idx_activity_event on public.activity_log (event_id);
create index if not exists idx_activity_team on public.activity_log (team_id);

create index if not exists idx_positions_team on public.positions (team_id);
create index if not exists idx_availability_profile on public.availability_blocks (profile_id);
create index if not exists idx_member_positions_membership on public.member_positions (membership_id);
create index if not exists idx_member_positions_position on public.member_positions (position_id);