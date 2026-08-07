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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      animals: {
        Row: {
          created_at: string
          id: string
          on_behalf_of: string | null
          order_id: string
          species: Database["public"]["Enums"]["animal_species"]
          status: Database["public"]["Enums"]["animal_status"]
          tag_code: string | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          on_behalf_of?: string | null
          order_id: string
          species?: Database["public"]["Enums"]["animal_species"]
          status?: Database["public"]["Enums"]["animal_status"]
          tag_code?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          on_behalf_of?: string | null
          order_id?: string
          species?: Database["public"]["Enums"]["animal_species"]
          status?: Database["public"]["Enums"]["animal_status"]
          tag_code?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "animals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "animals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_progress"
            referencedColumns: ["order_id"]
          },
        ]
      }
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["pic_user_id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["pic_user_id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          code: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      distributions: {
        Row: {
          created_at: string
          distributed_at: string
          distributed_by: string | null
          id: string
          lat: number | null
          lng: number | null
          order_id: string
          packages_count: number
          recipient_area: string | null
          recipient_name: string | null
          slaughter_record_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          distributed_at?: string
          distributed_by?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          order_id: string
          packages_count?: number
          recipient_area?: string | null
          recipient_name?: string | null
          slaughter_record_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          distributed_at?: string
          distributed_by?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          order_id?: string
          packages_count?: number
          recipient_area?: string | null
          recipient_name?: string | null
          slaughter_record_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "distributions_distributed_by_fkey"
            columns: ["distributed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distributions_distributed_by_fkey"
            columns: ["distributed_by"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["pic_user_id"]
          },
          {
            foreignKeyName: "distributions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distributions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "distributions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_progress"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "distributions_slaughter_record_id_fkey"
            columns: ["slaughter_record_id"]
            isOneToOne: false
            referencedRelation: "slaughter_records"
            referencedColumns: ["id"]
          },
        ]
      }
      documentations: {
        Row: {
          animal_id: string | null
          caption: string | null
          created_at: string
          id: string
          order_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          stage: Database["public"]["Enums"]["doc_stage"]
          status: Database["public"]["Enums"]["doc_status"]
          storage_path: string | null
          type: Database["public"]["Enums"]["doc_type"]
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          animal_id?: string | null
          caption?: string | null
          created_at?: string
          id?: string
          order_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          stage?: Database["public"]["Enums"]["doc_stage"]
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path?: string | null
          type?: Database["public"]["Enums"]["doc_type"]
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          animal_id?: string | null
          caption?: string | null
          created_at?: string
          id?: string
          order_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          stage?: Database["public"]["Enums"]["doc_stage"]
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path?: string | null
          type?: Database["public"]["Enums"]["doc_type"]
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentations_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "documentations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_progress"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "documentations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["pic_user_id"]
          },
          {
            foreignKeyName: "documentations_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentations_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["pic_user_id"]
          },
        ]
      }
      issues: {
        Row: {
          created_at: string
          description: string | null
          id: string
          order_id: string
          reported_by: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["issue_severity"]
          status: Database["public"]["Enums"]["issue_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          order_id: string
          reported_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["issue_severity"]
          status?: Database["public"]["Enums"]["issue_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string
          reported_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["issue_severity"]
          status?: Database["public"]["Enums"]["issue_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "issues_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_progress"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "issues_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["pic_user_id"]
          },
          {
            foreignKeyName: "issues_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["pic_user_id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          branch_id: string
          created_at: string
          deleted_at: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          branch_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          branch_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_branch_kpi"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "locations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      notifications: {
        Row: {
          attempts: number
          channel: Database["public"]["Enums"]["notif_channel"]
          created_at: string
          error: string | null
          id: string
          order_id: string | null
          payload: Json
          sent_at: string | null
          status: Database["public"]["Enums"]["notif_status"]
          target: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel: Database["public"]["Enums"]["notif_channel"]
          created_at?: string
          error?: string | null
          id?: string
          order_id?: string | null
          payload?: Json
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notif_status"]
          target?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel?: Database["public"]["Enums"]["notif_channel"]
          created_at?: string
          error?: string | null
          id?: string
          order_id?: string | null
          payload?: Json
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notif_status"]
          target?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_progress"
            referencedColumns: ["order_id"]
          },
        ]
      }
      order_counters: {
        Row: {
          last_number: number
          period: string
        }
        Insert: {
          last_number?: number
          period: string
        }
        Update: {
          last_number?: number
          period?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          meta: Json
          order_id: string
          qty: number
          service_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta?: Json
          order_id: string
          qty?: number
          service_id: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          meta?: Json
          order_id?: string
          qty?: number
          service_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_progress"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          order_number: string
          paid_amount: number
          participant_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          public_token: string
          status: Database["public"]["Enums"]["order_status"]
          status_reason: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_number: string
          paid_amount?: number
          participant_id: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          public_token?: string
          status?: Database["public"]["Enums"]["order_status"]
          status_reason?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          paid_amount?: number
          participant_id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          public_token?: string
          status?: Database["public"]["Enums"]["order_status"]
          status_reason?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_branch_kpi"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["pic_user_id"]
          },
          {
            foreignKeyName: "orders_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      participants: {
        Row: {
          address: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string | null
          note: string | null
          order_id: string
          proof_path: string | null
          status: Database["public"]["Enums"]["payment_verification_status"]
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method?: string | null
          note?: string | null
          order_id: string
          proof_path?: string | null
          status?: Database["public"]["Enums"]["payment_verification_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string | null
          note?: string | null
          order_id?: string
          proof_path?: string | null
          status?: Database["public"]["Enums"]["payment_verification_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_progress"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["pic_user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          branch_id: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          is_supervisor: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          is_supervisor?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          is_supervisor?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_branch_kpi"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          generated_at: string
          generated_by: string | null
          id: string
          order_id: string
          pdf_path: string | null
          public_token: string
          sent_at: string | null
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          order_id: string
          pdf_path?: string | null
          public_token?: string
          sent_at?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          order_id?: string
          pdf_path?: string | null
          public_token?: string
          sent_at?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "reports_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "reports_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_progress"
            referencedColumns: ["order_id"]
          },
        ]
      }
      schedules: {
        Row: {
          created_at: string
          id: string
          location_id: string
          notes: string | null
          order_id: string
          pic_user_id: string | null
          scheduled_date: string
          scheduled_time: string | null
          status: Database["public"]["Enums"]["schedule_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          notes?: string | null
          order_id: string
          pic_user_id?: string | null
          scheduled_date: string
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          notes?: string | null
          order_id?: string
          pic_user_id?: string | null
          scheduled_date?: string
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "schedules_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_open_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "schedules_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_order_progress"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "schedules_pic_user_id_fkey"
            columns: ["pic_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_pic_user_id_fkey"
            columns: ["pic_user_id"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["pic_user_id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          margin_amount: number
          meta: Json
          name: string
          price: number
          slug: string
          sort_order: number
          type: Database["public"]["Enums"]["service_type"]
          updated_at: string
          vendor_price: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          margin_amount?: number
          meta?: Json
          name: string
          price?: number
          slug: string
          sort_order?: number
          type: Database["public"]["Enums"]["service_type"]
          updated_at?: string
          vendor_price?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          margin_amount?: number
          meta?: Json
          name?: string
          price?: number
          slug?: string
          sort_order?: number
          type?: Database["public"]["Enums"]["service_type"]
          updated_at?: string
          vendor_price?: number
        }
        Relationships: []
      }
      slaughter_records: {
        Row: {
          animal_id: string
          created_at: string
          id: string
          notes: string | null
          performed_at: string
          performed_by: string | null
          updated_at: string
        }
        Insert: {
          animal_id: string
          created_at?: string
          id?: string
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          updated_at?: string
        }
        Update: {
          animal_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slaughter_records_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slaughter_records_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slaughter_records_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["pic_user_id"]
          },
        ]
      }
    }
    Views: {
      v_branch_kpi: {
        Row: {
          branch_code: string | null
          branch_id: string | null
          branch_name: string | null
          completed_orders: number | null
          on_hold_orders: number | null
          open_issues: number | null
          open_orders: number | null
          paid_amount: number | null
          pct_distribution: number | null
          pct_documentation: number | null
          pct_report: number | null
          pct_slaughter: number | null
          total_amount: number | null
          total_orders: number | null
          unpaid_orders: number | null
        }
        Relationships: []
      }
      v_open_orders: {
        Row: {
          age_days: number | null
          animals_distributed: number | null
          animals_slaughtered: number | null
          animals_total: number | null
          branch_code: string | null
          branch_id: string | null
          branch_name: string | null
          created_at: string | null
          docs_pending_review: number | null
          latest_issue_title: string | null
          location_address: string | null
          location_id: string | null
          location_lat: number | null
          location_lng: number | null
          location_name: string | null
          max_open_severity:
            | Database["public"]["Enums"]["issue_severity"]
            | null
          open_issues: number | null
          order_id: string | null
          order_number: string | null
          paid_amount: number | null
          participant_id: string | null
          participant_name: string | null
          participant_phone: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          pct_distribution: number | null
          pct_documentation: number | null
          pct_slaughter: number | null
          pic_name: string | null
          pic_phone: string | null
          pic_user_id: string | null
          report_sent: boolean | null
          schedule_id: string | null
          schedule_status: Database["public"]["Enums"]["schedule_status"] | null
          scheduled_date: string | null
          scheduled_time: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          total_amount: number | null
        }
        Relationships: []
      }
      v_order_progress: {
        Row: {
          animals_distributed: number | null
          animals_slaughtered: number | null
          animals_total: number | null
          branch_id: string | null
          created_at: string | null
          distribution_count: number | null
          docs_approved: number | null
          docs_pending_review: number | null
          docs_total: number | null
          documentation_ready: boolean | null
          max_open_severity:
            | Database["public"]["Enums"]["issue_severity"]
            | null
          open_issues: number | null
          order_id: string | null
          order_number: string | null
          packages_total: number | null
          paid_amount: number | null
          participant_id: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          pct_distribution: number | null
          pct_documentation: number | null
          pct_slaughter: number | null
          report_count: number | null
          report_generated: boolean | null
          report_sent: boolean | null
          report_sent_at: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_branch_kpi"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "orders_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["participant_id"]
          },
        ]
      }
    }
    Functions: {
      auth_branch_id: { Args: never; Returns: string }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      can_read_order: { Args: { p_order_id: string }; Returns: boolean }
      can_write_order: { Args: { p_order_id: string }; Returns: boolean }
      create_order: { Args: { p_payload: Json }; Returns: Json }
      get_public_report: { Args: { p_token: string }; Returns: Json }
      is_central: { Args: never; Returns: boolean }
      is_order_pic: { Args: { p_order_id: string }; Returns: boolean }
      is_supervisor: { Args: never; Returns: boolean }
      min_dp_ratio: { Args: never; Returns: number }
      next_order_number: { Args: { p_at?: string }; Returns: string }
    }
    Enums: {
      animal_species: "kambing" | "domba" | "sapi"
      animal_status: "registered" | "prepared" | "slaughtered" | "distributed"
      doc_stage: "slaughter" | "distribution" | "general"
      doc_status: "pending" | "approved_supervisor" | "approved" | "rejected"
      doc_type: "photo" | "video" | "note"
      issue_severity: "low" | "medium" | "high"
      issue_status: "open" | "in_progress" | "resolved"
      notif_channel: "whatsapp" | "email" | "dashboard"
      notif_status: "queued" | "sent" | "failed"
      order_status:
        | "new"
        | "paid"
        | "scheduled"
        | "preparation"
        | "slaughtering"
        | "distribution"
        | "documentation"
        | "reporting"
        | "completed"
        | "on_hold"
        | "cancelled"
      payment_status: "unpaid" | "partial" | "paid"
      payment_verification_status: "pending" | "verified" | "rejected"
      schedule_status: "planned" | "ongoing" | "done"
      service_type: "aqiqah" | "qurban" | "sedekah_daging" | "nasi_box"
      user_role:
        | "direktur"
        | "manager_program"
        | "admin_pusat"
        | "admin_cabang"
        | "petugas_lapangan"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      animal_species: ["kambing", "domba", "sapi"],
      animal_status: ["registered", "prepared", "slaughtered", "distributed"],
      doc_stage: ["slaughter", "distribution", "general"],
      doc_status: ["pending", "approved_supervisor", "approved", "rejected"],
      doc_type: ["photo", "video", "note"],
      issue_severity: ["low", "medium", "high"],
      issue_status: ["open", "in_progress", "resolved"],
      notif_channel: ["whatsapp", "email", "dashboard"],
      notif_status: ["queued", "sent", "failed"],
      order_status: [
        "new",
        "paid",
        "scheduled",
        "preparation",
        "slaughtering",
        "distribution",
        "documentation",
        "reporting",
        "completed",
        "on_hold",
        "cancelled",
      ],
      payment_status: ["unpaid", "partial", "paid"],
      payment_verification_status: ["pending", "verified", "rejected"],
      schedule_status: ["planned", "ongoing", "done"],
      service_type: ["aqiqah", "qurban", "sedekah_daging", "nasi_box"],
      user_role: [
        "direktur",
        "manager_program",
        "admin_pusat",
        "admin_cabang",
        "petugas_lapangan",
      ],
    },
  },
} as const
