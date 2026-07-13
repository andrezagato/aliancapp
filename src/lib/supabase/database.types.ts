// Tipos do banco (escritos à mão para o MVP).
// Regenere quando o schema evoluir:  npm run db:types
// (supabase gen types typescript --local > src/lib/supabase/database.types.ts)

export type SystemRole = "admin" | "member";
export type MembershipRole = "leader" | "volunteer";
export type AssignmentStatus =
  | "convidado"
  | "confirmado"
  | "recusado"
  | "vaga_aberta"
  | "presente";
export type SwapStatus = "pendente" | "aprovada" | "recusada";
export type JoinStatus = "pendente" | "aprovado" | "recusado";
export type InterestStatus = "aberto" | "atendido" | "arquivado";
export type NotificationKind =
  | "escalado"
  | "lembrete"
  | "confirmado"
  | "cancelado"
  | "troca_solicitada"
  | "troca_resolvida"
  | "vaga_aberta"
  | "interesse_servir"
  | "cadastro_pendente";

type Row<T> = T;
type Table<R> = { Row: R; Insert: Partial<R>; Update: Partial<R>; Relationships: [] };

export interface Database {
  public: {
    Tables: {
      churches: Table<Row<{
        id: string;
        name: string;
        timezone: string;
        logo_url: string | null;
        join_code: string | null;
        created_at: string;
      }>>;
      profiles: Table<Row<{
        id: string;
        church_id: string;
        full_name: string;
        email: string | null;
        phone: string | null;
        avatar_url: string | null;
        system_role: SystemRole;
        created_at: string;
        updated_at: string;
      }>>;
      teams: Table<Row<{
        id: string;
        church_id: string;
        name: string;
        color: string;
        icon: string;
        sort_order: number;
        created_at: string;
      }>>;
      positions: Table<Row<{
        id: string;
        team_id: string;
        name: string;
        sort_order: number;
        created_at: string;
      }>>;
      memberships: Table<Row<{
        id: string;
        profile_id: string;
        team_id: string;
        role: MembershipRole;
        created_at: string;
      }>>;
      member_positions: Table<Row<{ membership_id: string; position_id: string }>>;
      event_series: Table<Row<{
        id: string;
        church_id: string;
        title: string;
        weekday: number | null;
        start_time: string;
        location: string | null;
        active: boolean;
        created_at: string;
      }>>;
      events: Table<Row<{
        id: string;
        church_id: string;
        series_id: string | null;
        title: string;
        starts_at: string;
        location: string | null;
        notes: string | null;
        created_by: string | null;
        created_at: string;
      }>>;
      assignments: Table<Row<{
        id: string;
        event_id: string;
        team_id: string;
        position_id: string;
        profile_id: string | null;
        status: AssignmentStatus;
        decline_reason: string | null;
        assigned_by: string | null;
        created_at: string;
        updated_at: string;
      }>>;
      availability_blocks: Table<Row<{
        id: string;
        profile_id: string;
        start_date: string;
        end_date: string;
        reason: string | null;
        created_at: string;
      }>>;
      swap_requests: Table<Row<{
        id: string;
        assignment_id: string;
        requested_by: string;
        suggested_profile_id: string | null;
        reason: string | null;
        status: SwapStatus;
        resolved_by: string | null;
        created_at: string;
      }>>;
      checkins: Table<Row<{
        id: string;
        assignment_id: string;
        checked_by: string | null;
        checked_at: string;
      }>>;
      join_requests: Table<Row<{
        id: string;
        church_id: string;
        full_name: string;
        email: string | null;
        phone: string | null;
        message: string | null;
        status: JoinStatus;
        resolved_by: string | null;
        created_at: string;
      }>>;
      service_interests: Table<Row<{
        id: string;
        profile_id: string;
        team_id: string;
        position_id: string | null;
        note: string | null;
        status: InterestStatus;
        created_at: string;
      }>>;
      notifications: Table<Row<{
        id: string;
        recipient_id: string;
        team_id: string | null;
        kind: NotificationKind;
        title: string;
        body: string | null;
        link: string | null;
        read_at: string | null;
        created_at: string;
      }>>;
      notification_prefs: Table<Row<{
        profile_id: string;
        kind: NotificationKind;
        push: boolean;
        email: boolean;
        in_app: boolean;
      }>>;
      push_subscriptions: Table<Row<{
        id: string;
        profile_id: string;
        endpoint: string;
        p256dh: string;
        auth: string;
        created_at: string;
      }>>;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      system_role: SystemRole;
      membership_role: MembershipRole;
      assignment_status: AssignmentStatus;
      swap_status: SwapStatus;
      join_status: JoinStatus;
      interest_status: InterestStatus;
      notification_kind: NotificationKind;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
