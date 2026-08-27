export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          notes: string | null
          on_behalf_of: string | null
          order_id: string
          species: Database["public"]["Enums"]["animal_species"]
          tag_code: string | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          on_behalf_of?: string | null
          order_id: string
          species: Database["public"]["Enums"]["animal_species"]
          tag_code?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          on_behalf_of?: string | null
          order_id?: string
          species?: Database["public"]["Enums"]["animal_species"]
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
          {
            foreignKeyName: "animals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_stages"
            referencedColumns: ["order_id"]
          },
        ]
      }
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          stage_event_id: string | null
          status: Database["public"]["Enums"]["doc_status"]
          storage_path: string
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
          stage_event_id?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path: string
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
          stage_event_id?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path?: string
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
            foreignKeyName: "documentations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_stages"
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
            foreignKeyName: "documentations_stage_event_id_fkey"
            columns: ["stage_event_id"]
            isOneToOne: false
            referencedRelation: "order_stage_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentations_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
            foreignKeyName: "issues_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_stages"
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
            foreignKeyName: "issues_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          deleted_at: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "locations_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_kpi"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "locations_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          attempts: number
          channel: Database["public"]["Enums"]["notif_channel"]
          created_at: string
          error_text: string | null
          event_key: string | null
          id: string
          order_id: string | null
          payload: Json
          recipient: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notif_status"]
          template: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel: Database["public"]["Enums"]["notif_channel"]
          created_at?: string
          error_text?: string | null
          event_key?: string | null
          id?: string
          order_id?: string | null
          payload?: Json
          recipient: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notif_status"]
          template?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel?: Database["public"]["Enums"]["notif_channel"]
          created_at?: string
          error_text?: string | null
          event_key?: string | null
          id?: string
          order_id?: string | null
          payload?: Json
          recipient?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notif_status"]
          template?: string | null
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
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_stages"
            referencedColumns: ["order_id"]
          },
        ]
      }
      order_counters: {
        Row: {
          last_value: number
          period: string
        }
        Insert: {
          last_value?: number
          period: string
        }
        Update: {
          last_value?: number
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
          vendor_unit_price: number | null
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
          vendor_unit_price?: number | null
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
          vendor_unit_price?: number | null
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
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_stages"
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
      order_stage_events: {
        Row: {
          animal_id: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          meta: Json
          notes: string | null
          occurred_at: string | null
          order_id: string
          packages_count: number | null
          recipient_area: string | null
          recipient_name: string | null
          recipient_phone: string | null
          reported_at: string | null
          reported_by: string | null
          review_note: string | null
          seq: number
          stage: Database["public"]["Enums"]["fulfilment_stage"]
          status: Database["public"]["Enums"]["stage_event_status"]
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          weight_kg: number | null
        }
        Insert: {
          animal_id?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          meta?: Json
          notes?: string | null
          occurred_at?: string | null
          order_id: string
          packages_count?: number | null
          recipient_area?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          reported_at?: string | null
          reported_by?: string | null
          review_note?: string | null
          seq: number
          stage: Database["public"]["Enums"]["fulfilment_stage"]
          status?: Database["public"]["Enums"]["stage_event_status"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          weight_kg?: number | null
        }
        Update: {
          animal_id?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          meta?: Json
          notes?: string | null
          occurred_at?: string | null
          order_id?: string
          packages_count?: number | null
          recipient_area?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          reported_at?: string | null
          reported_by?: string | null
          review_note?: string | null
          seq?: number
          stage?: Database["public"]["Enums"]["fulfilment_stage"]
          status?: Database["public"]["Enums"]["stage_event_status"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_stage_events_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_stage_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_stage_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_stage_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_progress"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_stage_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_stages"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_stage_events_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_stage_events_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          aqiqah_for: string | null
          child_birth_date: string | null
          child_birth_place: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_city_code: string | null
          delivery_confirmed_at: string | null
          delivery_confirmed_ip: string | null
          delivery_detail: string | null
          delivery_district: string | null
          delivery_district_code: string | null
          delivery_postal_code: string | null
          delivery_province: string | null
          delivery_province_code: string | null
          delivery_village: string | null
          delivery_village_code: string | null
          distribution_mode:
            | Database["public"]["Enums"]["distribution_mode"]
            | null
          guest_verified_at: string | null
          guest_verified_by: string | null
          id: string
          notes: string | null
          order_number: string
          paid_amount: number
          participant_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          public_token: string
          recipient_institution: string | null
          referral_code: string | null
          requested_date: string | null
          requested_time: string | null
          status: Database["public"]["Enums"]["order_status"]
          status_reason: string | null
          total_amount: number
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          aqiqah_for?: string | null
          child_birth_date?: string | null
          child_birth_place?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_city_code?: string | null
          delivery_confirmed_at?: string | null
          delivery_confirmed_ip?: string | null
          delivery_detail?: string | null
          delivery_district?: string | null
          delivery_district_code?: string | null
          delivery_postal_code?: string | null
          delivery_province?: string | null
          delivery_province_code?: string | null
          delivery_village?: string | null
          delivery_village_code?: string | null
          distribution_mode?:
            | Database["public"]["Enums"]["distribution_mode"]
            | null
          guest_verified_at?: string | null
          guest_verified_by?: string | null
          id?: string
          notes?: string | null
          order_number: string
          paid_amount?: number
          participant_id: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          public_token?: string
          recipient_institution?: string | null
          referral_code?: string | null
          requested_date?: string | null
          requested_time?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          status_reason?: string | null
          total_amount?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          aqiqah_for?: string | null
          child_birth_date?: string | null
          child_birth_place?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_city_code?: string | null
          delivery_confirmed_at?: string | null
          delivery_confirmed_ip?: string | null
          delivery_detail?: string | null
          delivery_district?: string | null
          delivery_district_code?: string | null
          delivery_postal_code?: string | null
          delivery_province?: string | null
          delivery_province_code?: string | null
          delivery_village?: string | null
          delivery_village_code?: string | null
          distribution_mode?:
            | Database["public"]["Enums"]["distribution_mode"]
            | null
          guest_verified_at?: string | null
          guest_verified_by?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          paid_amount?: number
          participant_id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          public_token?: string
          recipient_institution?: string | null
          referral_code?: string | null
          requested_date?: string | null
          requested_time?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          status_reason?: string | null
          total_amount?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_guest_verified_by_fkey"
            columns: ["guest_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_kpi"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
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
          phone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          note: string | null
          order_id: string
          proof_path: string | null
          recorded_by: string | null
          status: Database["public"]["Enums"]["payment_verification_status"]
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method: string
          note?: string | null
          order_id: string
          proof_path?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["payment_verification_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          order_id?: string
          proof_path?: string | null
          recorded_by?: string | null
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
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_stages"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "profiles_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_kpi"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "profiles_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          code: string
          level: number
          name: string
          parent_code: string | null
        }
        Insert: {
          code: string
          level: number
          name: string
          parent_code?: string | null
        }
        Update: {
          code?: string
          level?: number
          name?: string
          parent_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regions_parent_code_fkey"
            columns: ["parent_code"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["code"]
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
          sent_at: string | null
          sent_channel: Database["public"]["Enums"]["notif_channel"] | null
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
          sent_at?: string | null
          sent_channel?: Database["public"]["Enums"]["notif_channel"] | null
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
          sent_at?: string | null
          sent_channel?: Database["public"]["Enums"]["notif_channel"] | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "reports_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_stages"
            referencedColumns: ["order_id"]
          },
        ]
      }
      schedules: {
        Row: {
          created_at: string
          id: string
          location_id: string | null
          notes: string | null
          order_id: string
          scheduled_date: string
          scheduled_time: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          order_id: string
          scheduled_date: string
          scheduled_time?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          order_id?: string
          scheduled_date?: string
          scheduled_time?: string | null
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
            foreignKeyName: "schedules_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_order_stages"
            referencedColumns: ["order_id"]
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
          meta: Json
          name: string
          price: number
          slug: string
          sort_order: number
          type: Database["public"]["Enums"]["service_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          meta?: Json
          name: string
          price?: number
          slug: string
          sort_order?: number
          type: Database["public"]["Enums"]["service_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          meta?: Json
          name?: string
          price?: number
          slug?: string
          sort_order?: number
          type?: Database["public"]["Enums"]["service_type"]
          updated_at?: string
        }
        Relationships: []
      }
      stage_requirements: {
        Row: {
          label: string
          min_docs: number
          requires_geo: boolean
          stage: Database["public"]["Enums"]["fulfilment_stage"]
        }
        Insert: {
          label: string
          min_docs?: number
          requires_geo?: boolean
          stage: Database["public"]["Enums"]["fulfilment_stage"]
        }
        Update: {
          label?: string
          min_docs?: number
          requires_geo?: boolean
          stage?: Database["public"]["Enums"]["fulfilment_stage"]
        }
        Relationships: []
      }
      vendor_coverage: {
        Row: {
          created_at: string
          level: number
          region_code: string
          region_name: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          level: number
          region_code: string
          region_name: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          level?: number
          region_code?: string
          region_name?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_coverage_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_coverage_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_kpi"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_coverage_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_services: {
        Row: {
          created_at: string
          id: string
          is_offered: boolean
          lead_time_hours: number | null
          max_qty: number | null
          meta: Json
          min_qty: number
          notes: string | null
          service_id: string
          updated_at: string
          vendor_id: string
          vendor_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_offered?: boolean
          lead_time_hours?: number | null
          max_qty?: number | null
          meta?: Json
          min_qty?: number
          notes?: string | null
          service_id: string
          updated_at?: string
          vendor_id: string
          vendor_price: number
        }
        Update: {
          created_at?: string
          id?: string
          is_offered?: boolean
          lead_time_hours?: number | null
          max_qty?: number | null
          meta?: Json
          min_qty?: number
          notes?: string | null
          service_id?: string
          updated_at?: string
          vendor_id?: string
          vendor_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendor_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_services_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_services_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_kpi"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_services_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          address_detail: string | null
          agreement_end: string | null
          agreement_number: string | null
          agreement_start: string | null
          bank_account_name: string | null
          bank_account_no: string | null
          bank_name: string | null
          city: string | null
          city_code: string | null
          code: string
          created_at: string
          daily_capacity: number | null
          deleted_at: string | null
          district: string | null
          district_code: string | null
          email: string | null
          id: string
          is_active: boolean
          lat: number | null
          legal_name: string | null
          lng: number | null
          name: string
          notes: string | null
          npwp: string | null
          owner_name: string | null
          phone: string
          postal_code: string | null
          province: string | null
          province_code: string | null
          service_modes: Database["public"]["Enums"]["distribution_mode"][]
          updated_at: string
          village: string | null
          village_code: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          address_detail?: string | null
          agreement_end?: string | null
          agreement_number?: string | null
          agreement_start?: string | null
          bank_account_name?: string | null
          bank_account_no?: string | null
          bank_name?: string | null
          city?: string | null
          city_code?: string | null
          code: string
          created_at?: string
          daily_capacity?: number | null
          deleted_at?: string | null
          district?: string | null
          district_code?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          legal_name?: string | null
          lng?: number | null
          name: string
          notes?: string | null
          npwp?: string | null
          owner_name?: string | null
          phone: string
          postal_code?: string | null
          province?: string | null
          province_code?: string | null
          service_modes?: Database["public"]["Enums"]["distribution_mode"][]
          updated_at?: string
          village?: string | null
          village_code?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          address_detail?: string | null
          agreement_end?: string | null
          agreement_number?: string | null
          agreement_start?: string | null
          bank_account_name?: string | null
          bank_account_no?: string | null
          bank_name?: string | null
          city?: string | null
          city_code?: string | null
          code?: string
          created_at?: string
          daily_capacity?: number | null
          deleted_at?: string | null
          district?: string | null
          district_code?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          legal_name?: string | null
          lng?: number | null
          name?: string
          notes?: string | null
          npwp?: string | null
          owner_name?: string | null
          phone?: string
          postal_code?: string | null
          province?: string | null
          province_code?: string | null
          service_modes?: Database["public"]["Enums"]["distribution_mode"][]
          updated_at?: string
          village?: string | null
          village_code?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_open_orders: {
        Row: {
          age_days: number | null
          age_hours: number | null
          animals_slaughtered: number | null
          animals_total: number | null
          created_at: string | null
          current_stage: Database["public"]["Enums"]["fulfilment_stage"] | null
          distribution_mode:
            | Database["public"]["Enums"]["distribution_mode"]
            | null
          docs_pending_review: number | null
          is_guest_order: boolean | null
          latest_issue_title: string | null
          location_name: string | null
          max_open_severity:
            | Database["public"]["Enums"]["issue_severity"]
            | null
          missing_doc_stages: string[] | null
          needs_verification: boolean | null
          open_issues: number | null
          order_id: string | null
          order_number: string | null
          paid_amount: number | null
          participant_name: string | null
          participant_phone: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          pct_documentation: number | null
          pct_stage: number | null
          requested_date: string | null
          requested_time: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          stages_rejected: number | null
          stages_total: number | null
          stages_validated: number | null
          status: Database["public"]["Enums"]["order_status"] | null
          total_amount: number | null
          vendor_id: string | null
          vendor_name: string | null
          vendor_phone: string | null
        }
        Relationships: []
      }
      v_order_progress: {
        Row: {
          animals_distributed: number | null
          animals_slaughtered: number | null
          animals_total: number | null
          created_at: string | null
          current_stage: Database["public"]["Enums"]["fulfilment_stage"] | null
          delivery_confirmed: boolean | null
          delivery_confirmed_at: string | null
          distribution_mode:
            | Database["public"]["Enums"]["distribution_mode"]
            | null
          docs_approved: number | null
          docs_pending_review: number | null
          docs_total: number | null
          max_open_severity: string | null
          missing_doc_stages: string[] | null
          open_issues: number | null
          order_id: string | null
          order_number: string | null
          paid_amount: number | null
          participant_id: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          pct_documentation: number | null
          pct_stage: number | null
          report_count: number | null
          report_generated: boolean | null
          report_sent: boolean | null
          report_sent_at: string | null
          stages_in_sequence: number | null
          stages_pending: number | null
          stages_rejected: number | null
          stages_reported: number | null
          stages_total: number | null
          stages_validated: number | null
          status: Database["public"]["Enums"]["order_status"] | null
          total_amount: number | null
          vendor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_open_orders"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_kpi"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      v_order_stages: {
        Row: {
          current_stage: Database["public"]["Enums"]["fulfilment_stage"] | null
          distribution_mode:
            | Database["public"]["Enums"]["distribution_mode"]
            | null
          first_reported_at: string | null
          last_validated_at: string | null
          order_id: string | null
          pct_stage: number | null
          stages_in_sequence: number | null
          stages_pending: number | null
          stages_rejected: number | null
          stages_reported: number | null
          stages_total: number | null
          stages_validated: number | null
        }
        Relationships: []
      }
      v_vendor_kpi: {
        Row: {
          avg_cycle_hours: number | null
          is_active: boolean | null
          margin_total: number | null
          orders_completed: number | null
          orders_on_hold: number | null
          orders_open: number | null
          orders_total: number | null
          orders_with_rejection: number | null
          revenue_total: number | null
          vendor_code: string | null
          vendor_cost_total: number | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      auth_vendor_id: { Args: never; Returns: string }
      booking_max_days: { Args: never; Returns: number }
      booking_min_days: { Args: never; Returns: number }
      can_read_order: { Args: { p_order_id: string }; Returns: boolean }
      can_write_order: { Args: { p_order_id: string }; Returns: boolean }
      confirm_delivery: {
        Args: { p_ip?: string; p_token: string }
        Returns: Json
      }
      create_guest_order: { Args: { p_payload: Json }; Returns: Json }
      create_order: { Args: { p_payload: Json }; Returns: Json }
      enqueue_notification: {
        Args: {
          p_channel: Database["public"]["Enums"]["notif_channel"]
          p_event_key: string
          p_order_id: string
          p_payload?: Json
          p_recipient: string
          p_template: string
        }
        Returns: string
      }
      fulfilment_sequence: {
        Args: { p_mode: Database["public"]["Enums"]["distribution_mode"] }
        Returns: Database["public"]["Enums"]["fulfilment_stage"][]
      }
      get_public_report: { Args: { p_token: string }; Returns: Json }
      is_staff: { Args: never; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      min_dp_ratio: { Args: never; Returns: number }
      next_order_number: { Args: never; Returns: string }
    }
    Enums: {
      animal_species: "kambing" | "domba" | "sapi"
      distribution_mode: "salur" | "kirim"
      doc_stage:
        | "persiapan"
        | "sembelih"
        | "masak"
        | "salur"
        | "kirim"
        | "terkirim"
        | "umum"
      doc_status: "pending" | "approved" | "rejected"
      doc_type: "photo" | "video" | "note"
      fulfilment_stage:
        | "persiapan"
        | "sembelih"
        | "masak"
        | "salur"
        | "kirim"
        | "terkirim"
      issue_severity: "low" | "medium" | "high"
      issue_status: "open" | "in_progress" | "resolved"
      notif_channel: "whatsapp" | "email" | "dashboard"
      notif_status: "queued" | "sent" | "failed"
      order_status:
        | "new"
        | "verified"
        | "paid"
        | "assigned"
        | "in_progress"
        | "validation"
        | "reporting"
        | "completed"
        | "on_hold"
        | "cancelled"
      payment_status: "unpaid" | "partial" | "paid"
      payment_verification_status: "pending" | "verified" | "rejected"
      service_type: "aqiqah" | "qurban" | "sedekah_daging" | "nasi_box"
      stage_event_status: "pending" | "reported" | "validated" | "rejected"
      user_role: "superadmin" | "admin" | "vendor"
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
      distribution_mode: ["salur", "kirim"],
      doc_stage: [
        "persiapan",
        "sembelih",
        "masak",
        "salur",
        "kirim",
        "terkirim",
        "umum",
      ],
      doc_status: ["pending", "approved", "rejected"],
      doc_type: ["photo", "video", "note"],
      fulfilment_stage: [
        "persiapan",
        "sembelih",
        "masak",
        "salur",
        "kirim",
        "terkirim",
      ],
      issue_severity: ["low", "medium", "high"],
      issue_status: ["open", "in_progress", "resolved"],
      notif_channel: ["whatsapp", "email", "dashboard"],
      notif_status: ["queued", "sent", "failed"],
      order_status: [
        "new",
        "verified",
        "paid",
        "assigned",
        "in_progress",
        "validation",
        "reporting",
        "completed",
        "on_hold",
        "cancelled",
      ],
      payment_status: ["unpaid", "partial", "paid"],
      payment_verification_status: ["pending", "verified", "rejected"],
      service_type: ["aqiqah", "qurban", "sedekah_daging", "nasi_box"],
      stage_event_status: ["pending", "reported", "validated", "rejected"],
      user_role: ["superadmin", "admin", "vendor"],
    },
  },
} as const

