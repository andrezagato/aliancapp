export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          code: string
          id: string
          profile_id: string
          unlocked_at: string
        }
        Insert: {
          code: string
          id?: string
          profile_id: string
          unlocked_at?: string
        }
        Update: {
          code?: string
          id?: string
          profile_id?: string
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log: {
        Row: {
          actor_id: string | null
          church_id: string | null
          created_at: string
          event_id: string | null
          id: string
          kind: string
          meta: Json
          profile_id: string | null
          team_id: string | null
        }
        Insert: {
          actor_id?: string | null
          church_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          kind: string
          meta?: Json
          profile_id?: string | null
          team_id?: string | null
        }
        Update: {
          actor_id?: string | null
          church_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          kind?: string
          meta?: Json
          profile_id?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_assignment_history"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "activity_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          decline_reason: string | null
          event_id: string
          id: string
          position_id: string
          profile_id: string | null
          requirement_id: string | null
          responded_at: string | null
          status: Database["public"]["Enums"]["assignment_status"]
          team_id: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          decline_reason?: string | null
          event_id: string
          id?: string
          position_id: string
          profile_id?: string | null
          requirement_id?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          team_id: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          decline_reason?: string | null
          event_id?: string
          id?: string
          position_id?: string
          profile_id?: string | null
          requirement_id?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_assignment_history"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "assignments_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "event_requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_blocks: {
        Row: {
          created_at: string
          end_date: string
          id: string
          profile_id: string
          reason: string | null
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          profile_id: string
          reason?: string | null
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          profile_id?: string
          reason?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_blocks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string
          channel_ref: string
          channel_type: string
          church_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          channel_ref: string
          channel_type: string
          church_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          channel_ref?: string
          channel_type?: string
          church_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_reads: {
        Row: {
          channel_ref: string
          channel_type: string
          last_read_at: string
          muted: boolean
          profile_id: string
        }
        Insert: {
          channel_ref: string
          channel_type: string
          last_read_at?: string
          muted?: boolean
          profile_id: string
        }
        Update: {
          channel_ref?: string
          channel_type?: string
          last_read_at?: string
          muted?: boolean
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_reads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          assignment_id: string
          at_location: boolean | null
          checked_at: string
          checked_by: string | null
          id: string
        }
        Insert: {
          assignment_id: string
          at_location?: boolean | null
          checked_at?: string
          checked_by?: string | null
          id?: string
        }
        Update: {
          assignment_id?: string
          at_location?: boolean | null
          checked_at?: string
          checked_by?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "v_assignment_history"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "checkins_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      churches: {
        Row: {
          checkin_radius_m: number
          created_at: string
          id: string
          join_code: string | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          timezone: string
        }
        Insert: {
          checkin_radius_m?: number
          created_at?: string
          id?: string
          join_code?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          timezone?: string
        }
        Update: {
          checkin_radius_m?: number
          created_at?: string
          id?: string
          join_code?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          timezone?: string
        }
        Relationships: []
      }
      culto_avaliacoes: {
        Row: {
          author_id: string
          church_id: string
          created_at: string
          event_id: string
          id: string
          rating: number
          updated_at: string
        }
        Insert: {
          author_id: string
          church_id: string
          created_at?: string
          event_id: string
          id?: string
          rating: number
          updated_at?: string
        }
        Update: {
          author_id?: string
          church_id?: string
          created_at?: string
          event_id?: string
          id?: string
          rating?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "culto_avaliacoes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "culto_avaliacoes_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "culto_avaliacoes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "culto_avaliacoes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_assignment_history"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_feedback: {
        Row: {
          comment: string | null
          created_at: string
          event_id: string
          id: string
          profile_id: string
          rating: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          event_id: string
          id?: string
          profile_id: string
          rating: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          event_id?: string
          id?: string
          profile_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_feedback_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_feedback_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_assignment_history"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_feedback_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_requests: {
        Row: {
          church_id: string
          created_at: string
          desired_at: string | null
          id: string
          location: string | null
          note: string | null
          requested_by: string
          resolved_by: string | null
          resolved_event_id: string | null
          status: Database["public"]["Enums"]["event_request_status"]
          team_ids: string[]
          title: string
        }
        Insert: {
          church_id: string
          created_at?: string
          desired_at?: string | null
          id?: string
          location?: string | null
          note?: string | null
          requested_by: string
          resolved_by?: string | null
          resolved_event_id?: string | null
          status?: Database["public"]["Enums"]["event_request_status"]
          team_ids?: string[]
          title: string
        }
        Update: {
          church_id?: string
          created_at?: string
          desired_at?: string | null
          id?: string
          location?: string | null
          note?: string | null
          requested_by?: string
          resolved_by?: string | null
          resolved_event_id?: string | null
          status?: Database["public"]["Enums"]["event_request_status"]
          team_ids?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_requests_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_requests_resolved_event_id_fkey"
            columns: ["resolved_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_requests_resolved_event_id_fkey"
            columns: ["resolved_event_id"]
            isOneToOne: false
            referencedRelation: "v_assignment_history"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_requirements: {
        Row: {
          event_id: string
          id: string
          needed_count: number
          note: string | null
          position_id: string
          status: Database["public"]["Enums"]["requirement_status"]
          team_id: string
        }
        Insert: {
          event_id: string
          id?: string
          needed_count?: number
          note?: string | null
          position_id: string
          status?: Database["public"]["Enums"]["requirement_status"]
          team_id: string
        }
        Update: {
          event_id?: string
          id?: string
          needed_count?: number
          note?: string | null
          position_id?: string
          status?: Database["public"]["Enums"]["requirement_status"]
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_requirements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_requirements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_assignment_history"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_requirements_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_requirements_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rundown: {
        Row: {
          color: string | null
          created_at: string
          done_at: string | null
          duration_min: number
          event_id: string
          id: string
          kind: string
          link: string | null
          note: string | null
          responsible: string | null
          sort_order: number
          title: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          done_at?: string | null
          duration_min?: number
          event_id: string
          id?: string
          kind?: string
          link?: string | null
          note?: string | null
          responsible?: string | null
          sort_order?: number
          title: string
        }
        Update: {
          color?: string | null
          created_at?: string
          done_at?: string | null
          duration_min?: number
          event_id?: string
          id?: string
          kind?: string
          link?: string | null
          note?: string | null
          responsible?: string | null
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rundown_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rundown_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_assignment_history"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_series: {
        Row: {
          active: boolean
          call_time: string | null
          church_id: string
          created_at: string
          id: string
          location: string | null
          start_time: string
          title: string
          weekday: number | null
        }
        Insert: {
          active?: boolean
          call_time?: string | null
          church_id: string
          created_at?: string
          id?: string
          location?: string | null
          start_time?: string
          title: string
          weekday?: number | null
        }
        Update: {
          active?: boolean
          call_time?: string | null
          church_id?: string
          created_at?: string
          id?: string
          location?: string | null
          start_time?: string
          title?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_series_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          archived_at: string | null
          call_time: string | null
          church_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          ends_at: string | null
          files_url: string | null
          id: string
          latitude: number | null
          location: string | null
          longitude: number | null
          notes: string | null
          responsible_id: string | null
          rundown_ended_at: string | null
          rundown_started_at: string | null
          series_id: string | null
          starts_at: string
          title: string
        }
        Insert: {
          archived_at?: string | null
          call_time?: string | null
          church_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          files_url?: string | null
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          notes?: string | null
          responsible_id?: string | null
          rundown_ended_at?: string | null
          rundown_started_at?: string | null
          series_id?: string | null
          starts_at: string
          title: string
        }
        Update: {
          archived_at?: string | null
          call_time?: string | null
          church_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          files_url?: string | null
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          notes?: string | null
          responsible_id?: string | null
          rundown_ended_at?: string | null
          rundown_started_at?: string | null
          series_id?: string | null
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "event_series"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_teams: {
        Row: {
          invite_id: string
          role: Database["public"]["Enums"]["membership_role"]
          team_id: string
        }
        Insert: {
          invite_id: string
          role?: Database["public"]["Enums"]["membership_role"]
          team_id: string
        }
        Update: {
          invite_id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_teams_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          church_id: string
          created_at: string
          created_by: string | null
          email: string
          expires_at: string | null
          full_name: string
          id: string
          phone: string | null
          status: Database["public"]["Enums"]["invite_status"]
          system_role: Database["public"]["Enums"]["system_role"]
          token: string
        }
        Insert: {
          church_id: string
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
          system_role?: Database["public"]["Enums"]["system_role"]
          token?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
          system_role?: Database["public"]["Enums"]["system_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      join_requests: {
        Row: {
          church_id: string
          created_at: string
          desired_team_id: string | null
          email: string | null
          full_name: string
          id: string
          message: string | null
          phone: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["join_status"]
        }
        Insert: {
          church_id: string
          created_at?: string
          desired_team_id?: string | null
          email?: string | null
          full_name: string
          id?: string
          message?: string | null
          phone?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["join_status"]
        }
        Update: {
          church_id?: string
          created_at?: string
          desired_team_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          message?: string | null
          phone?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["join_status"]
        }
        Relationships: [
          {
            foreignKeyName: "join_requests_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "join_requests_desired_team_id_fkey"
            columns: ["desired_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "join_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_positions: {
        Row: {
          membership_id: string
          position_id: string
        }
        Insert: {
          membership_id: string
          position_id: string
        }
        Update: {
          membership_id?: string
          position_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_positions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_positions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          role: Database["public"]["Enums"]["membership_role"]
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          role?: Database["public"]["Enums"]["membership_role"]
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          email: boolean
          in_app: boolean
          kind: Database["public"]["Enums"]["notification_kind"]
          profile_id: string
          push: boolean
        }
        Insert: {
          email?: boolean
          in_app?: boolean
          kind: Database["public"]["Enums"]["notification_kind"]
          profile_id: string
          push?: boolean
        }
        Update: {
          email?: boolean
          in_app?: boolean
          kind?: Database["public"]["Enums"]["notification_kind"]
          profile_id?: string
          push?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          event_id: string | null
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          link: string | null
          read_at: string | null
          recipient_id: string
          team_id: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          link?: string | null
          read_at?: string | null
          recipient_id: string
          team_id?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          link?: string | null
          read_at?: string | null
          recipient_id?: string
          team_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_assignment_history"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoa_observacoes: {
        Row: {
          author_id: string
          church_id: string
          created_at: string
          event_id: string
          id: string
          note: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          church_id: string
          created_at?: string
          event_id: string
          id?: string
          note: string
          subject_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          church_id?: string
          created_at?: string
          event_id?: string
          id?: string
          note?: string
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pessoa_observacoes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoa_observacoes_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoa_observacoes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoa_observacoes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_assignment_history"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "pessoa_observacoes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
          team_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          team_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          church_id: string | null
          created_at: string
          desired_team_id: string | null
          email: string | null
          full_name: string
          id: string
          nickname: string | null
          phone: string | null
          status: Database["public"]["Enums"]["profile_status"]
          system_role: Database["public"]["Enums"]["system_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          church_id?: string | null
          created_at?: string
          desired_team_id?: string | null
          email?: string | null
          full_name?: string
          id: string
          nickname?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          system_role?: Database["public"]["Enums"]["system_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          church_id?: string | null
          created_at?: string
          desired_team_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          nickname?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          system_role?: Database["public"]["Enums"]["system_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_desired_team_id_fkey"
            columns: ["desired_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          profile_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          profile_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_log: {
        Row: {
          event_id: string
          id: string
          kind: string
          profile_id: string
          sent_at: string
          step: number
        }
        Insert: {
          event_id: string
          id?: string
          kind: string
          profile_id: string
          sent_at?: string
          step: number
        }
        Update: {
          event_id?: string
          id?: string
          kind?: string
          profile_id?: string
          sent_at?: string
          step?: number
        }
        Relationships: [
          {
            foreignKeyName: "reminder_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_assignment_history"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "reminder_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rundown_kinds: {
        Row: {
          church_id: string
          color: string
          created_at: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          church_id: string
          color?: string
          created_at?: string
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          church_id?: string
          color?: string
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "rundown_kinds_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      rundown_templates: {
        Row: {
          church_id: string
          created_at: string
          id: string
          items: Json
          name: string
        }
        Insert: {
          church_id: string
          created_at?: string
          id?: string
          items?: Json
          name: string
        }
        Update: {
          church_id?: string
          created_at?: string
          id?: string
          items?: Json
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "rundown_templates_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      series_requirements: {
        Row: {
          id: string
          needed_count: number
          position_id: string
          series_id: string
          team_id: string
        }
        Insert: {
          id?: string
          needed_count?: number
          position_id: string
          series_id: string
          team_id: string
        }
        Update: {
          id?: string
          needed_count?: number
          position_id?: string
          series_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_requirements_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_requirements_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "event_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_requirements_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      series_teams: {
        Row: {
          series_id: string
          team_id: string
        }
        Insert: {
          series_id: string
          team_id: string
        }
        Update: {
          series_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_teams_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "event_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      service_interests: {
        Row: {
          created_at: string
          id: string
          note: string | null
          position_id: string | null
          profile_id: string
          resolved_at: string | null
          resolved_by: string | null
          resolved_note: string | null
          status: Database["public"]["Enums"]["interest_status"]
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          position_id?: string | null
          profile_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_note?: string | null
          status?: Database["public"]["Enums"]["interest_status"]
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          position_id?: string | null
          profile_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_note?: string | null
          status?: Database["public"]["Enums"]["interest_status"]
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_interests_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_interests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_interests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_interests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      swap_requests: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
          reason: string | null
          requested_by: string
          resolved_by: string | null
          status: Database["public"]["Enums"]["swap_status"]
          substitute_accepted_at: string | null
          suggested_profile_id: string | null
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id?: string
          reason?: string | null
          requested_by: string
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["swap_status"]
          substitute_accepted_at?: string | null
          suggested_profile_id?: string | null
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          requested_by?: string
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["swap_status"]
          substitute_accepted_at?: string | null
          suggested_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "swap_requests_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_requests_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_assignment_history"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "swap_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_requests_suggested_profile_id_fkey"
            columns: ["suggested_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          archived_at: string | null
          church_id: string
          color: string
          created_at: string
          icon: string
          id: string
          manages_rundown: boolean
          name: string
          sort_order: number
          whatsapp_group: string | null
        }
        Insert: {
          archived_at?: string | null
          church_id: string
          color?: string
          created_at?: string
          icon?: string
          id?: string
          manages_rundown?: boolean
          name: string
          sort_order?: number
          whatsapp_group?: string | null
        }
        Update: {
          archived_at?: string | null
          church_id?: string
          color?: string
          created_at?: string
          icon?: string
          id?: string
          manages_rundown?: boolean
          name?: string
          sort_order?: number
          whatsapp_group?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_assignment_history: {
        Row: {
          assignment_id: string | null
          event_id: string | null
          event_title: string | null
          full_name: string | null
          position_id: string | null
          position_name: string | null
          profile_id: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["assignment_status"] | null
          team_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      aviso_prefs: {
        Args: {
          p_kind: Database["public"]["Enums"]["notification_kind"]
          p_recipient: string
        }
        Returns: {
          email: boolean
          in_app: boolean
          push: boolean
        }[]
      }
      can_post_channel: {
        Args: { p_ref: string; p_type: string }
        Returns: boolean
      }
      can_read_channel: {
        Args: { p_ref: string; p_type: string }
        Returns: boolean
      }
      chat_push_recipients: {
        Args: { p_ref: string; p_type: string }
        Returns: {
          auth: string
          endpoint: string
          p256dh: string
        }[]
      }
      confirmar_escalacao: {
        Args: { p_assignment: string }
        Returns: undefined
      }
      confirmar_evento: {
        Args: { p_confirmar: boolean; p_event: string }
        Returns: undefined
      }
      contribuir_no_bloco: {
        Args: { p_bloco: string; p_link: string; p_note: string }
        Returns: undefined
      }
      definir_pasta_evento: {
        Args: { p_event: string; p_url: string }
        Returns: undefined
      }
      get_push_subs: {
        Args: { p_profile: string }
        Returns: {
          auth: string
          endpoint: string
          p256dh: string
        }[]
      }
      is_active: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_any_leader: { Args: never; Returns: boolean }
      is_team_leader: { Args: { t: string }; Returns: boolean }
      is_team_member: { Args: { t: string }; Returns: boolean }
      leads_team_of: { Args: { p: string }; Returns: boolean }
      listar_equipes_publicas: {
        Args: never
        Returns: {
          color: string
          icon: string
          id: string
          name: string
        }[]
      }
      log_activity: {
        Args: {
          p_actor: string
          p_event?: string
          p_kind: string
          p_meta?: Json
          p_profile: string
          p_team?: string
        }
        Returns: undefined
      }
      manages_rundown: { Args: never; Returns: boolean }
      notificar: {
        Args: {
          p_body?: string
          p_event?: string
          p_kind: Database["public"]["Enums"]["notification_kind"]
          p_link?: string
          p_recipient: string
          p_team?: string
          p_title: string
        }
        Returns: undefined
      }
      primeiro_no_local_count: { Args: never; Returns: number }
      reconciliar_onboarding: { Args: never; Returns: undefined }
      recusar_escalacao: {
        Args: { p_assignment: string; p_motivo: string }
        Returns: undefined
      }
      solicitar_entrada: {
        Args: {
          p_desired_team_id?: string
          p_email: string
          p_full_name: string
          p_message: string
          p_phone: string
        }
        Returns: undefined
      }
    }
    Enums: {
      assignment_status:
        | "convidado"
        | "confirmado"
        | "recusado"
        | "vaga_aberta"
        | "presente"
      event_request_status: "pendente" | "aprovado" | "recusado"
      interest_status: "aberto" | "atendido" | "arquivado"
      invite_status: "pendente" | "aceito" | "expirado" | "cancelado"
      join_status: "pendente" | "aprovado" | "recusado"
      membership_role: "leader" | "volunteer"
      notification_kind:
        | "escalado"
        | "lembrete"
        | "confirmado"
        | "cancelado"
        | "troca_solicitada"
        | "troca_resolvida"
        | "vaga_aberta"
        | "interesse_servir"
        | "cadastro_pendente"
        | "cadastro_aprovado"
        | "evento_alterado"
        | "evento_confirmar"
        | "evento_solicitado"
        | "aniversario"
        | "cobertura"
        | "interesse_resolvido"
        | "evento_resolvido"
        | "conquista"
        | "evento_equipe"
      profile_status: "pendente" | "ativo"
      requirement_status: "needed" | "not_applicable"
      swap_status: "pendente" | "aprovada" | "recusada"
      system_role: "admin" | "member"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      assignment_status: [
        "convidado",
        "confirmado",
        "recusado",
        "vaga_aberta",
        "presente",
      ],
      event_request_status: ["pendente", "aprovado", "recusado"],
      interest_status: ["aberto", "atendido", "arquivado"],
      invite_status: ["pendente", "aceito", "expirado", "cancelado"],
      join_status: ["pendente", "aprovado", "recusado"],
      membership_role: ["leader", "volunteer"],
      notification_kind: [
        "escalado",
        "lembrete",
        "confirmado",
        "cancelado",
        "troca_solicitada",
        "troca_resolvida",
        "vaga_aberta",
        "interesse_servir",
        "cadastro_pendente",
        "cadastro_aprovado",
        "evento_alterado",
        "evento_confirmar",
        "evento_solicitado",
        "aniversario",
        "cobertura",
        "interesse_resolvido",
        "evento_resolvido",
        "conquista",
        "evento_equipe",
      ],
      profile_status: ["pendente", "ativo"],
      requirement_status: ["needed", "not_applicable"],
      swap_status: ["pendente", "aprovada", "recusada"],
      system_role: ["admin", "member"],
    },
  },
} as const

// -----------------------------------------------------------------------------
// Aliases de conveniência (mantêm compatibilidade com o código do app).
// Regenerar o bloco acima com:  npm run db:types  (ou generate_typescript_types).
// -----------------------------------------------------------------------------
export type SystemRole = Enums<"system_role">
export type MembershipRole = Enums<"membership_role">
export type AssignmentStatus = Enums<"assignment_status">
export type RequirementStatus = Enums<"requirement_status">
export type SwapStatus = Enums<"swap_status">
export type JoinStatus = Enums<"join_status">
export type InviteStatus = Enums<"invite_status">
export type EventRequestStatus = Enums<"event_request_status">
export type InterestStatus = Enums<"interest_status">
export type ProfileStatus = Enums<"profile_status">
export type NotificationKind = Enums<"notification_kind">

export type Church = Tables<"churches">
export type Profile = Tables<"profiles">
export type Team = Tables<"teams">
export type Position = Tables<"positions">
export type Membership = Tables<"memberships">
export type Invite = Tables<"invites">
export type EventSeries = Tables<"event_series">
export type EventRow = Tables<"events">
export type EventRequirement = Tables<"event_requirements">
export type Assignment = Tables<"assignments">
export type JoinRequest = Tables<"join_requests">
export type ServiceInterest = Tables<"service_interests">
export type Notification = Tables<"notifications">
export type ChatMessage = Tables<"chat_messages">
export type ChatRead = Tables<"chat_reads">
