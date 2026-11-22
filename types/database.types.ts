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
      bible_favorites: {
        Row: {
          book_abbrev: string
          book_name: string
          chapter: number
          created_at: string
          id: string
          profile_id: string
          text: string
          verse: number
        }
        Insert: {
          book_abbrev: string
          book_name: string
          chapter: number
          created_at?: string
          id?: string
          profile_id: string
          text: string
          verse: number
        }
        Update: {
          book_abbrev?: string
          book_name?: string
          chapter?: number
          created_at?: string
          id?: string
          profile_id?: string
          text?: string
          verse?: number
        }
        Relationships: [
          {
            foreignKeyName: "bible_favorites_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_photo_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          photo_id: string
          profile_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          photo_id: string
          profile_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          photo_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafe_photo_comments_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "cafe_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_photo_comments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_photo_likes: {
        Row: {
          created_at: string
          photo_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          photo_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          photo_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafe_photo_likes_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "cafe_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_photo_likes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_photos: {
        Row: {
          author_profile_id: string
          caption: string | null
          created_at: string
          drive_file_id: string | null
          file_name: string | null
          group_id: string
          id: string
          media_type: string
          mime_type: string | null
          parent_media_id: string | null
          sort_order: number
          storage_path: string | null
        }
        Insert: {
          author_profile_id: string
          caption?: string | null
          created_at?: string
          drive_file_id?: string | null
          file_name?: string | null
          group_id: string
          id?: string
          media_type?: string
          mime_type?: string | null
          parent_media_id?: string | null
          sort_order?: number
          storage_path?: string | null
        }
        Update: {
          author_profile_id?: string
          caption?: string | null
          created_at?: string
          drive_file_id?: string | null
          file_name?: string | null
          group_id?: string
          id?: string
          media_type?: string
          mime_type?: string | null
          parent_media_id?: string | null
          sort_order?: number
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cafe_photos_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_photos_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_photos_parent_media_id_fkey"
            columns: ["parent_media_id"]
            isOneToOne: false
            referencedRelation: "cafe_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      attendance: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          notes: string | null
          participant_id: string
          registered_at: string | null
          registered_by: string | null
          status: Database["public"]["Enums"]["attendance_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          notes?: string | null
          participant_id: string
          registered_at?: string | null
          registered_by?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          notes?: string | null
          participant_id?: string
          registered_at?: string | null
          registered_by?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
        }
        Relationships: [
          {
            foreignKeyName: "attendance_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_profile_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_audit_log: {
        Row: {
          created_at: string
          event: Database["public"]["Enums"]["auth_audit_event"]
          id: string
          ip_address: string | null
          metadata: Json | null
          profile_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          event: Database["public"]["Enums"]["auth_audit_event"]
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          profile_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          event?: Database["public"]["Enums"]["auth_audit_event"]
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          profile_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_audit_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_preferences: {
        Row: {
          indicadores: string[]
          profile_id: string
          updated_at: string
        }
        Insert: {
          indicadores?: string[]
          profile_id: string
          updated_at?: string
        }
        Update: {
          indicadores?: string[]
          profile_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      enrollment_sources: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          group_id: string | null
          id: string
          label: string
          leader_id: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          group_id?: string | null
          id?: string
          label: string
          leader_id?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          group_id?: string | null
          id?: string
          label?: string
          leader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_sources_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_sources_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_ups: {
        Row: {
          created_at: string
          date: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          leader_id: string
          needs_return: boolean | null
          next_follow_up_date: string | null
          observation: string | null
          participant_id: string
          status: Database["public"]["Enums"]["follow_up_status"]
          type: Database["public"]["Enums"]["follow_up_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          date?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          leader_id: string
          needs_return?: boolean | null
          next_follow_up_date?: string | null
          observation?: string | null
          participant_id: string
          status?: Database["public"]["Enums"]["follow_up_status"]
          type: Database["public"]["Enums"]["follow_up_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          leader_id?: string
          needs_return?: boolean | null
          next_follow_up_date?: string | null
          observation?: string | null
          participant_id?: string
          status?: Database["public"]["Enums"]["follow_up_status"]
          type?: Database["public"]["Enums"]["follow_up_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          address: string | null
          available_days: string[] | null
          capacity: number
          created_at: string
          host_profile_id: string | null
          id: string
          latitude: number | null
          leader_id: string | null
          longitude: number | null
          meeting_time: string | null
          multiplied_at: string | null
          name: string
          parent_group_id: string | null
          region: string | null
          status: Database["public"]["Enums"]["group_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          available_days?: string[] | null
          capacity: number
          created_at?: string
          host_profile_id?: string | null
          id?: string
          latitude?: number | null
          leader_id?: string | null
          longitude?: number | null
          meeting_time?: string | null
          multiplied_at?: string | null
          name: string
          parent_group_id?: string | null
          region?: string | null
          status?: Database["public"]["Enums"]["group_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          available_days?: string[] | null
          capacity?: number
          created_at?: string
          host_profile_id?: string | null
          id?: string
          latitude?: number | null
          leader_id?: string | null
          longitude?: number | null
          meeting_time?: string | null
          multiplied_at?: string | null
          name?: string
          parent_group_id?: string | null
          region?: string | null
          status?: Database["public"]["Enums"]["group_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_host_profile_id_fkey"
            columns: ["host_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_sessions: {
        Row: {
          developer_id: string
          ended_at: string | null
          id: string
          ip_address: string | null
          started_at: string
          target_id: string | null
          target_name: string
          user_agent: string | null
        }
        Insert: {
          developer_id: string
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          started_at?: string
          target_id?: string | null
          target_name: string
          user_agent?: string | null
        }
        Update: {
          developer_id?: string
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          started_at?: string
          target_id?: string | null
          target_name?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_sessions_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaders: {
        Row: {
          admin_notes: string | null
          availability: Json | null
          city: string | null
          created_at: string
          id: string
          joined_at: string
          max_capacity: number
          meeting_address: string | null
          neighborhood: string | null
          profile_id: string
          region: string | null
          status: Database["public"]["Enums"]["leader_status"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          availability?: Json | null
          city?: string | null
          created_at?: string
          id?: string
          joined_at?: string
          max_capacity?: number
          meeting_address?: string | null
          neighborhood?: string | null
          profile_id: string
          region?: string | null
          status?: Database["public"]["Enums"]["leader_status"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          availability?: Json | null
          city?: string | null
          created_at?: string
          id?: string
          joined_at?: string
          max_capacity?: number
          meeting_address?: string | null
          neighborhood?: string | null
          profile_id?: string
          region?: string | null
          status?: Database["public"]["Enums"]["leader_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          participant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          participant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          participant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          date: string
          group_id: string
          id: string
          leader_id: string
          location: string | null
          ministered_by: string | null
          status: Database["public"]["Enums"]["meeting_status"]
          time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          group_id: string
          id?: string
          leader_id: string
          location?: string | null
          ministered_by?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
          time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          group_id?: string
          id?: string
          leader_id?: string
          location?: string | null
          ministered_by?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
          time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          metadata: Json | null
          participant_id: string | null
          profile_id: string
          push_attempts: number
          pushed_at: string | null
          read: boolean
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json | null
          participant_id?: string | null
          profile_id: string
          push_attempts?: number
          pushed_at?: string | null
          read?: boolean
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json | null
          participant_id?: string | null
          profile_id?: string
          push_attempts?: number
          pushed_at?: string | null
          read?: boolean
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          last_used_at: string | null
          p256dh: string
          profile_id: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          profile_id: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          profile_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      participant_contact_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          note: string | null
          participant_id: string
          status: Database["public"]["Enums"]["contact_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          participant_id: string
          status: Database["public"]["Enums"]["contact_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          participant_id?: string
          status?: Database["public"]["Enums"]["contact_status"]
        }
        Relationships: [
          {
            foreignKeyName: "participant_contact_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_contact_status_history_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_leader_history: {
        Row: {
          changed_by: string | null
          contact_confirmed_at: string | null
          contact_confirmed_by: string | null
          contact_escalated_at: string | null
          created_at: string
          end_date: string | null
          group_id: string | null
          id: string
          leader_id: string
          participant_id: string
          reason: string | null
          start_date: string
        }
        Insert: {
          changed_by?: string | null
          contact_confirmed_at?: string | null
          contact_confirmed_by?: string | null
          contact_escalated_at?: string | null
          created_at?: string
          end_date?: string | null
          group_id?: string | null
          id?: string
          leader_id: string
          participant_id: string
          reason?: string | null
          start_date?: string
        }
        Update: {
          changed_by?: string | null
          contact_confirmed_at?: string | null
          contact_confirmed_by?: string | null
          contact_escalated_at?: string | null
          created_at?: string
          end_date?: string | null
          group_id?: string | null
          id?: string
          leader_id?: string
          participant_id?: string
          reason?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_leader_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_leader_history_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_leader_history_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_leader_history_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          effective_date: string | null
          id: string
          note: string | null
          participant_id: string
          status: Database["public"]["Enums"]["participant_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          effective_date?: string | null
          id?: string
          note?: string | null
          participant_id: string
          status: Database["public"]["Enums"]["participant_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          effective_date?: string | null
          id?: string
          note?: string | null
          participant_id?: string
          status?: Database["public"]["Enums"]["participant_status"]
        }
        Relationships: [
          {
            foreignKeyName: "participant_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_status_history_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          address: string | null
          admin_notes: string | null
          anonymized_at: string | null
          availability_days: string[] | null
          availability_period: string[] | null
          birth_date: string | null
          city: string | null
          contact_authorized_at: string | null
          contact_status: Database["public"]["Enums"]["contact_status"]
          cpf: string | null
          return_reason: string | null
          returned_at: string | null
          returned_by_leader_id: string | null
          created_at: string
          current_group_id: string | null
          current_leader_id: string | null
          deleted_at: string | null
          email: string | null
          enrollment_date: string
          enrollment_source: string | null
          full_name: string
          geo_lat: number | null
          geo_lng: number | null
          home_meeting_ok: boolean | null
          id: string
          inactive_reason: string | null
          is_lagoinha_member: boolean | null
          is_visitor: boolean
          visitor_marked_at: string | null
          visitor_contact_confirmed_at: string | null
          visitor_reminded_at: string | null
          church_status: string | null
          church_name: string | null
          cep: string | null
          location_preference: string | null
          neighborhood: string | null
          other_notes: string | null
          phone: string | null
          preferred_name: string | null
          profile_id: string | null
          status: Database["public"]["Enums"]["participant_status"]
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          admin_notes?: string | null
          anonymized_at?: string | null
          availability_days?: string[] | null
          availability_period?: string[] | null
          birth_date?: string | null
          city?: string | null
          contact_authorized_at?: string | null
          contact_status?: Database["public"]["Enums"]["contact_status"]
          cpf?: string | null
          return_reason?: string | null
          returned_at?: string | null
          returned_by_leader_id?: string | null
          created_at?: string
          current_group_id?: string | null
          current_leader_id?: string | null
          deleted_at?: string | null
          email?: string | null
          enrollment_date?: string
          enrollment_source?: string | null
          full_name: string
          geo_lat?: number | null
          geo_lng?: number | null
          home_meeting_ok?: boolean | null
          id?: string
          inactive_reason?: string | null
          is_lagoinha_member?: boolean | null
          is_visitor?: boolean
          visitor_marked_at?: string | null
          visitor_contact_confirmed_at?: string | null
          visitor_reminded_at?: string | null
          church_status?: string | null
          church_name?: string | null
          cep?: string | null
          location_preference?: string | null
          neighborhood?: string | null
          other_notes?: string | null
          phone?: string | null
          preferred_name?: string | null
          profile_id?: string | null
          status?: Database["public"]["Enums"]["participant_status"]
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          admin_notes?: string | null
          anonymized_at?: string | null
          availability_days?: string[] | null
          availability_period?: string[] | null
          birth_date?: string | null
          city?: string | null
          contact_authorized_at?: string | null
          contact_status?: Database["public"]["Enums"]["contact_status"]
          cpf?: string | null
          return_reason?: string | null
          returned_at?: string | null
          returned_by_leader_id?: string | null
          created_at?: string
          current_group_id?: string | null
          current_leader_id?: string | null
          deleted_at?: string | null
          email?: string | null
          enrollment_date?: string
          enrollment_source?: string | null
          full_name?: string
          geo_lat?: number | null
          geo_lng?: number | null
          home_meeting_ok?: boolean | null
          id?: string
          inactive_reason?: string | null
          is_lagoinha_member?: boolean | null
          is_visitor?: boolean
          visitor_marked_at?: string | null
          visitor_contact_confirmed_at?: string | null
          visitor_reminded_at?: string | null
          church_status?: string | null
          church_name?: string | null
          cep?: string | null
          location_preference?: string | null
          neighborhood?: string | null
          other_notes?: string | null
          phone?: string | null
          preferred_name?: string | null
          profile_id?: string | null
          status?: Database["public"]["Enums"]["participant_status"]
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_current_group_id_fkey"
            columns: ["current_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_current_leader_id_fkey"
            columns: ["current_leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      rate_limit_events: {
        Row: {
          created_at: string
          id: number
          key: string
        }
        Insert: {
          created_at?: string
          id?: never
          key: string
        }
        Update: {
          created_at?: string
          id?: never
          key?: string
        }
        Relationships: []
      }
      study_materials: {
        Row: {
          created_at: string
          description: string | null
          file_name: string
          id: string
          mime_type: string
          reference_month: string
          size_bytes: number
          storage_path: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name: string
          id?: string
          mime_type: string
          reference_month: string
          size_bytes: number
          storage_path: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string
          id?: string
          mime_type?: string
          reference_month?: string
          size_bytes?: number
          storage_path?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "study_materials_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_check_claim_account_rate_limit: {
        Args: { p_key: string }
        Returns: boolean
      }
      app_check_login_rate_limit: { Args: { p_key: string }; Returns: boolean }
      app_check_participant_write_rate_limit: {
        Args: { p_key: string }
        Returns: boolean
      }
      app_check_public_enrollment_rate_limit: {
        Args: { p_key: string }
        Returns: boolean
      }
      app_multiply_cafe: {
        Args: {
          p_cafe: Json
          p_date?: string
          p_new_leader_participant_id: string
          p_new_leader_profile_id: string
          p_origin_group_id: string
          p_participant_ids: string[]
        }
        Returns: string
      }
      app_set_cafe_origin: {
        Args: { p_date: string | null; p_group_id: string; p_parent_group_id: string | null }
        Returns: undefined
      }
      app_confirm_visitor_contact: {
        Args: { p_participant_id: string }
        Returns: undefined
      }
      app_confirm_participant_contact: {
        Args: { p_participant_id: string }
        Returns: undefined
      }
      app_confirm_distribution: {
        Args: {
          p_group_id: string | null
          p_leader_id: string
          p_participant_id: string
        }
        Returns: undefined
      }
      app_create_participant_by_leader: {
        Args: { p_group_id: string | null; p_leader_id: string; p_payload: Json }
        Returns: Database["public"]["Tables"]["participants"]["Row"]
      }
      app_enroll_participant_via_leader_link: {
        Args: { p_group_id: string | null; p_leader_id: string; p_payload: Json }
        Returns: Database["public"]["Tables"]["participants"]["Row"]
      }
      app_return_participant_to_queue: {
        Args: {
          p_participant_id: string
          p_reason: string | null
        }
        Returns: undefined
      }
      app_transfer_participant: {
        Args: {
          p_group_id: string | null
          p_leader_id: string
          p_participant_id: string
          p_reason: string | null
        }
        Returns: undefined
      }
      app_current_leader_id: { Args: never; Returns: string }
      app_current_participant_id: { Args: never; Returns: string }
      app_hosted_group_id: { Args: never; Returns: string }
      app_is_admin: { Args: never; Returns: boolean }
      app_is_responsible_for_participant: {
        Args: { p_participant_id: string }
        Returns: boolean
      }
      app_log_audit_event: {
        Args: {
          p_action: string
          p_after?: Json
          p_before?: Json
          p_entity: string
          // uuid nullable no banco: nem toda entidade auditável tem id uuid
          p_entity_id: string | null
        }
        Returns: undefined
      }
      app_log_auth_event: {
        Args: {
          p_event: Database["public"]["Enums"]["auth_audit_event"]
          p_ip_address: string
          p_metadata?: Json
          p_profile_id: string
          p_user_agent: string
        }
        Returns: undefined
      }
      app_rate_limit_hit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      app_revoke_user_sessions: {
        Args: { p_profile_id: string }
        Returns: undefined
      }
    }
    Enums: {
      attendance_status: "presente" | "ausente" | "justificou" | "nao_informado"
      auth_audit_event:
        | "login_success"
        | "login_failed"
        | "logout"
        | "password_reset_requested"
        | "access_denied"
        | "session_revoked"
      contact_status:
        | "em_processo"
        | "primeira_visita"
        | "segunda_visita"
        | "terceira_visita"
        | "membro"
      follow_up_status: "normal" | "atencao" | "acompanhamento_necessario"
      follow_up_type:
        | "encontro"
        | "ligacao"
        | "whatsapp"
        | "visita"
        | "oracao"
        | "acompanhamento_pastoral"
        | "outro"
      group_status: "ativo" | "inativo" | "lotado"
      leader_status: "ativa" | "inativa"
      meeting_status: "planejado" | "confirmado" | "realizado" | "cancelado"
      participant_status:
        | "nova_inscricao"
        | "aguardando_distribuicao"
        | "distribuida"
        | "ativa"
        | "acompanhamento"
        | "inativa"
      user_role:
        | "admin"
        | "lider"
        | "participante"
        | "desenvolvedor"
        | "co_lider"
        | "anfitria"
        | "gestora_de_pessoas"
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
      attendance_status: ["presente", "ausente", "justificou", "nao_informado"],
      auth_audit_event: [
        "login_success",
        "login_failed",
        "logout",
        "password_reset_requested",
        "access_denied",
        "session_revoked",
      ],
      contact_status: [
        "em_processo",
        "primeira_visita",
        "segunda_visita",
        "terceira_visita",
        "membro",
      ],
      follow_up_status: ["normal", "atencao", "acompanhamento_necessario"],
      follow_up_type: [
        "encontro",
        "ligacao",
        "whatsapp",
        "visita",
        "oracao",
        "acompanhamento_pastoral",
        "outro",
      ],
      group_status: ["ativo", "inativo", "lotado"],
      leader_status: ["ativa", "inativa"],
      meeting_status: ["planejado", "confirmado", "realizado", "cancelado"],
      participant_status: [
        "nova_inscricao",
        "aguardando_distribuicao",
        "distribuida",
        "ativa",
        "acompanhamento",
        "inativa",
      ],
      user_role: [
        "admin",
        "lider",
        "participante",
        "desenvolvedor",
        "co_lider",
        "anfitria",
        "gestora_de_pessoas",
      ],
    },
  },
} as const
