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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          company_id: string | null
          created_at: string
          dismissed: boolean
          id: string
          message: string
          run_id: string | null
          severity: string
          truck_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          dismissed?: boolean
          id?: string
          message: string
          run_id?: string | null
          severity?: string
          truck_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          dismissed?: boolean
          id?: string
          message?: string
          run_id?: string | null
          severity?: string
          truck_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          notes: string | null
          old_data: Json | null
          record_id: string | null
          table_name: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          notes?: string | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          notes?: string | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
        }
        Relationships: []
      }
      billing_overrides: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          overridden_at: string
          overridden_by: string | null
          override_reason: string
          previous_blockers: string[] | null
          previous_blockers_snapshot: Json | null
          reason: string | null
          snapshot: Json | null
          trip_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          overridden_at?: string
          overridden_by?: string | null
          override_reason: string
          previous_blockers?: string[] | null
          previous_blockers_snapshot?: Json | null
          reason?: string | null
          snapshot?: Json | null
          trip_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          overridden_at?: string
          overridden_by?: string | null
          override_reason?: string
          previous_blockers?: string[] | null
          previous_blockers_snapshot?: Json | null
          reason?: string | null
          snapshot?: Json | null
          trip_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_overrides_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_records"
            referencedColumns: ["id"]
          },
        ]
      }
      charge_master: {
        Row: {
          bariatric_fee: number | null
          base_rate: number
          company_id: string | null
          extra_attendant_fee: number | null
          id: string
          mileage_rate: number
          oxygen_fee: number | null
          payer_type: string
          updated_at: string
          wait_rate_per_min: number | null
        }
        Insert: {
          bariatric_fee?: number | null
          base_rate?: number
          company_id?: string | null
          extra_attendant_fee?: number | null
          id?: string
          mileage_rate?: number
          oxygen_fee?: number | null
          payer_type?: string
          updated_at?: string
          wait_rate_per_min?: number | null
        }
        Update: {
          bariatric_fee?: number | null
          base_rate?: number
          company_id?: string | null
          extra_attendant_fee?: number | null
          id?: string
          mileage_rate?: number
          oxygen_fee?: number | null
          payer_type?: string
          updated_at?: string
          wait_rate_per_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "charge_master_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_records: {
        Row: {
          amount_paid: number | null
          auth_number: string | null
          base_charge: number | null
          claim_build_date: string | null
          company_id: string | null
          cpt_codes: string[] | null
          created_at: string
          denial_category: string | null
          denial_code: string | null
          denial_reason: string | null
          destination_type: string | null
          destination_zip: string | null
          expected_revenue: number | null
          extras_charge: number | null
          hcpcs_codes: string[] | null
          hcpcs_modifiers: string[] | null
          icd10_codes: string[] | null
          id: string
          is_simulated: boolean
          member_id: string | null
          mileage_charge: number | null
          notes: string | null
          origin_type: string | null
          origin_zip: string | null
          paid_at: string | null
          patient_id: string | null
          payer_name: string | null
          payer_type: string | null
          resubmitted_at: string | null
          run_date: string
          simulation_run_id: string | null
          status: Database["public"]["Enums"]["claim_status"]
          submitted_at: string | null
          total_charge: number | null
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          amount_paid?: number | null
          auth_number?: string | null
          base_charge?: number | null
          claim_build_date?: string | null
          company_id?: string | null
          cpt_codes?: string[] | null
          created_at?: string
          denial_category?: string | null
          denial_code?: string | null
          denial_reason?: string | null
          destination_type?: string | null
          destination_zip?: string | null
          expected_revenue?: number | null
          extras_charge?: number | null
          hcpcs_codes?: string[] | null
          hcpcs_modifiers?: string[] | null
          icd10_codes?: string[] | null
          id?: string
          is_simulated?: boolean
          member_id?: string | null
          mileage_charge?: number | null
          notes?: string | null
          origin_type?: string | null
          origin_zip?: string | null
          paid_at?: string | null
          patient_id?: string | null
          payer_name?: string | null
          payer_type?: string | null
          resubmitted_at?: string | null
          run_date: string
          simulation_run_id?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          submitted_at?: string | null
          total_charge?: number | null
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_paid?: number | null
          auth_number?: string | null
          base_charge?: number | null
          claim_build_date?: string | null
          company_id?: string | null
          cpt_codes?: string[] | null
          created_at?: string
          denial_category?: string | null
          denial_code?: string | null
          denial_reason?: string | null
          destination_type?: string | null
          destination_zip?: string | null
          expected_revenue?: number | null
          extras_charge?: number | null
          hcpcs_codes?: string[] | null
          hcpcs_modifiers?: string[] | null
          icd10_codes?: string[] | null
          id?: string
          is_simulated?: boolean
          member_id?: string | null
          mileage_charge?: number | null
          notes?: string | null
          origin_type?: string | null
          origin_zip?: string | null
          paid_at?: string | null
          patient_id?: string | null
          payer_name?: string | null
          payer_type?: string | null
          resubmitted_at?: string | null
          run_date?: string
          simulation_run_id?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          submitted_at?: string | null
          total_charge?: number | null
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_records_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_records"
            referencedColumns: ["id"]
          },
        ]
      }
      comms_events: {
        Row: {
          company_id: string
          created_at: string
          event_type: string
          facility_id: string | null
          id: string
          payload: Json | null
          simulation_run_id: string | null
          status: string
          trip_id: string
          truck_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          event_type: string
          facility_id?: string | null
          id?: string
          payload?: Json | null
          simulation_run_id?: string | null
          status?: string
          trip_id: string
          truck_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          event_type?: string
          facility_id?: string | null
          id?: string
          payload?: Json | null
          simulation_run_id?: string | null
          status?: string
          trip_id?: string
          truck_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comms_events_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comms_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comms_events_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          is_sandbox: boolean
          name: string
          onboarding_status: Database["public"]["Enums"]["onboarding_status"]
          owner_email: string | null
          owner_user_id: string | null
          rejected_at: string | null
          rejected_reason: string | null
          suspended_reason: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          is_sandbox?: boolean
          name: string
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"]
          owner_email?: string | null
          owner_user_id?: string | null
          rejected_at?: string | null
          rejected_reason?: string | null
          suspended_reason?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          is_sandbox?: boolean
          name?: string
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"]
          owner_email?: string | null
          owner_user_id?: string | null
          rejected_at?: string | null
          rejected_reason?: string | null
          suspended_reason?: string | null
        }
        Relationships: []
      }
      company_memberships: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["membership_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          company_name: string
          dialysis_b_leg_buffer_minutes: number
          discharge_buffer_minutes: number
          facility_delay_minutes: number
          grace_window_minutes: number
          id: string
          load_time_minutes: number
          session_timeout_minutes: number
          session_warning_enabled: boolean
          unload_time_minutes: number
          updated_at: string
        }
        Insert: {
          company_name?: string
          dialysis_b_leg_buffer_minutes?: number
          discharge_buffer_minutes?: number
          facility_delay_minutes?: number
          grace_window_minutes?: number
          id?: string
          load_time_minutes?: number
          session_timeout_minutes?: number
          session_warning_enabled?: boolean
          unload_time_minutes?: number
          updated_at?: string
        }
        Update: {
          company_name?: string
          dialysis_b_leg_buffer_minutes?: number
          discharge_buffer_minutes?: number
          facility_delay_minutes?: number
          grace_window_minutes?: number
          id?: string
          load_time_minutes?: number
          session_timeout_minutes?: number
          session_warning_enabled?: boolean
          unload_time_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      crew_share_tokens: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          id: string
          token: string
          truck_id: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          id?: string
          token?: string
          truck_id: string
          valid_from?: string
          valid_until?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          id?: string
          token?: string
          truck_id?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_share_tokens_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      crews: {
        Row: {
          active_date: string
          company_id: string | null
          created_at: string
          id: string
          is_simulated: boolean
          member1_id: string | null
          member2_id: string | null
          simulation_run_id: string | null
          truck_id: string
        }
        Insert: {
          active_date?: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_simulated?: boolean
          member1_id?: string | null
          member2_id?: string | null
          simulation_run_id?: string | null
          truck_id: string
        }
        Update: {
          active_date?: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_simulated?: boolean
          member1_id?: string | null
          member2_id?: string | null
          simulation_run_id?: string | null
          truck_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crews_member1_id_fkey"
            columns: ["member1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crews_member2_id_fkey"
            columns: ["member2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crews_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          active: boolean | null
          address: string | null
          company_id: string | null
          contact_name: string | null
          contract_payer_type: string | null
          created_at: string
          facility_type: string
          id: string
          invoice_preference: string | null
          is_simulated: boolean
          name: string
          notes: string | null
          phone: string | null
          rate_type: string | null
          simulation_run_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          company_id?: string | null
          contact_name?: string | null
          contract_payer_type?: string | null
          created_at?: string
          facility_type?: string
          id?: string
          invoice_preference?: string | null
          is_simulated?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          rate_type?: string | null
          simulation_run_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          address?: string | null
          company_id?: string | null
          contact_name?: string | null
          contract_payer_type?: string | null
          created_at?: string
          facility_type?: string
          id?: string
          invoice_preference?: string | null
          is_simulated?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          rate_type?: string | null
          simulation_run_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facilities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      hold_timers: {
        Row: {
          company_id: string
          created_at: string
          current_level: string
          hold_type: string
          id: string
          is_active: boolean
          last_escalated_at: string | null
          resolved_at: string | null
          simulation_run_id: string | null
          slot_id: string | null
          started_at: string
          trip_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          current_level?: string
          hold_type: string
          id?: string
          is_active?: boolean
          last_escalated_at?: string | null
          resolved_at?: string | null
          simulation_run_id?: string | null
          slot_id?: string | null
          started_at: string
          trip_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          current_level?: string
          hold_type?: string
          id?: string
          is_active?: boolean
          last_escalated_at?: string | null
          resolved_at?: string | null
          simulation_run_id?: string | null
          slot_id?: string | null
          started_at?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hold_timers_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "truck_run_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hold_timers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_records"
            referencedColumns: ["id"]
          },
        ]
      }
      import_mapping_templates: {
        Row: {
          company_id: string
          created_at: string
          data_type: string
          id: string
          mapping: Json
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          data_type?: string
          id?: string
          mapping?: Json
          name?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          data_type?: string
          id?: string
          mapping?: Json
          name?: string
        }
        Relationships: []
      }
      import_sessions: {
        Row: {
          column_mapping: Json | null
          company_id: string
          created_at: string
          created_by: string | null
          data_type: string
          error_count: number
          file_name: string
          id: string
          imported_rows: number
          is_historical: boolean
          is_test_mode: boolean
          raw_headers: string[] | null
          status: string
          total_rows: number
          updated_at: string
          warning_count: number
          warnings: Json | null
        }
        Insert: {
          column_mapping?: Json | null
          company_id: string
          created_at?: string
          created_by?: string | null
          data_type?: string
          error_count?: number
          file_name: string
          id?: string
          imported_rows?: number
          is_historical?: boolean
          is_test_mode?: boolean
          raw_headers?: string[] | null
          status?: string
          total_rows?: number
          updated_at?: string
          warning_count?: number
          warnings?: Json | null
        }
        Update: {
          column_mapping?: Json | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          data_type?: string
          error_count?: number
          file_name?: string
          id?: string
          imported_rows?: number
          is_historical?: boolean
          is_test_mode?: boolean
          raw_headers?: string[] | null
          status?: string
          total_rows?: number
          updated_at?: string
          warning_count?: number
          warnings?: Json | null
        }
        Relationships: []
      }
      leg_exceptions: {
        Row: {
          created_at: string
          destination_location: string | null
          id: string
          notes: string | null
          pickup_location: string | null
          pickup_time: string | null
          run_date: string
          scheduling_leg_id: string
        }
        Insert: {
          created_at?: string
          destination_location?: string | null
          id?: string
          notes?: string | null
          pickup_location?: string | null
          pickup_time?: string | null
          run_date: string
          scheduling_leg_id: string
        }
        Update: {
          created_at?: string
          destination_location?: string | null
          id?: string
          notes?: string | null
          pickup_location?: string | null
          pickup_time?: string | null
          run_date?: string
          scheduling_leg_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leg_exceptions_scheduling_leg_id_fkey"
            columns: ["scheduling_leg_id"]
            isOneToOne: false
            referencedRelation: "scheduling_legs"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          accepted_ip: string | null
          agreement_type: string
          agreement_version: string
          company_id: string
          id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          accepted_ip?: string | null
          agreement_type: string
          agreement_version?: string
          company_id: string
          id?: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          accepted_ip?: string | null
          agreement_type?: string
          agreement_version?: string
          company_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_acceptances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_settings: {
        Row: {
          company_id: string
          created_at: string
          id: string
          parallel_mode: boolean
          start_forward_mode: boolean
          updated_at: string
          wizard_completed: boolean
          wizard_step: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          parallel_mode?: boolean
          start_forward_mode?: boolean
          updated_at?: string
          wizard_completed?: boolean
          wizard_step?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          parallel_mode?: boolean
          start_forward_mode?: boolean
          updated_at?: string
          wizard_completed?: boolean
          wizard_step?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          created_at: string
          id: string
          message: string
          user_id: string
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          created_at?: string
          id?: string
          message: string
          user_id: string
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          created_at?: string
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_events: {
        Row: {
          actor_email: string | null
          actor_user_id: string | null
          company_id: string
          created_at: string
          details: Json | null
          event_type: string
          id: string
          reason: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_user_id?: string | null
          company_id: string
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          reason?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_user_id?: string | null
          company_id?: string
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_alerts: {
        Row: {
          alert_type: string
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          leg_id: string
          note: string | null
          resolved_at: string | null
          resolved_by: string | null
          run_date: string
          status: string
          truck_id: string
        }
        Insert: {
          alert_type?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          leg_id: string
          note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          run_date?: string
          status?: string
          truck_id: string
        }
        Update: {
          alert_type?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          leg_id?: string
          note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          run_date?: string
          status?: string
          truck_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_alerts_leg_id_fkey"
            columns: ["leg_id"]
            isOneToOne: false
            referencedRelation: "scheduling_legs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_alerts_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          auth_expiration: string | null
          auth_required: boolean | null
          bariatric: boolean | null
          chair_time: string | null
          company_id: string | null
          created_at: string
          dialysis_window_minutes: number
          dob: string | null
          dropoff_facility: string | null
          first_name: string
          id: string
          is_simulated: boolean
          last_name: string
          member_id: string | null
          mobility: string | null
          must_arrive_by: string | null
          notes: string | null
          oxygen_lpm: number | null
          oxygen_required: boolean | null
          phone: string | null
          pickup_address: string | null
          primary_payer: string | null
          recurrence_end_date: string | null
          recurrence_start_date: string | null
          run_duration_minutes: number | null
          schedule_days: Database["public"]["Enums"]["schedule_days"] | null
          secondary_payer: string | null
          simulation_run_id: string | null
          special_equipment_required: string
          special_handling: string | null
          stair_chair_required: boolean | null
          stairs_required: string
          standing_order: boolean | null
          status: Database["public"]["Enums"]["patient_status"]
          transport_type: Database["public"]["Enums"]["transport_type"]
          trips_per_week_limit: number | null
          updated_at: string
          weight_lbs: number | null
        }
        Insert: {
          auth_expiration?: string | null
          auth_required?: boolean | null
          bariatric?: boolean | null
          chair_time?: string | null
          company_id?: string | null
          created_at?: string
          dialysis_window_minutes?: number
          dob?: string | null
          dropoff_facility?: string | null
          first_name: string
          id?: string
          is_simulated?: boolean
          last_name: string
          member_id?: string | null
          mobility?: string | null
          must_arrive_by?: string | null
          notes?: string | null
          oxygen_lpm?: number | null
          oxygen_required?: boolean | null
          phone?: string | null
          pickup_address?: string | null
          primary_payer?: string | null
          recurrence_end_date?: string | null
          recurrence_start_date?: string | null
          run_duration_minutes?: number | null
          schedule_days?: Database["public"]["Enums"]["schedule_days"] | null
          secondary_payer?: string | null
          simulation_run_id?: string | null
          special_equipment_required?: string
          special_handling?: string | null
          stair_chair_required?: boolean | null
          stairs_required?: string
          standing_order?: boolean | null
          status?: Database["public"]["Enums"]["patient_status"]
          transport_type?: Database["public"]["Enums"]["transport_type"]
          trips_per_week_limit?: number | null
          updated_at?: string
          weight_lbs?: number | null
        }
        Update: {
          auth_expiration?: string | null
          auth_required?: boolean | null
          bariatric?: boolean | null
          chair_time?: string | null
          company_id?: string | null
          created_at?: string
          dialysis_window_minutes?: number
          dob?: string | null
          dropoff_facility?: string | null
          first_name?: string
          id?: string
          is_simulated?: boolean
          last_name?: string
          member_id?: string | null
          mobility?: string | null
          must_arrive_by?: string | null
          notes?: string | null
          oxygen_lpm?: number | null
          oxygen_required?: boolean | null
          phone?: string | null
          pickup_address?: string | null
          primary_payer?: string | null
          recurrence_end_date?: string | null
          recurrence_start_date?: string | null
          run_duration_minutes?: number | null
          schedule_days?: Database["public"]["Enums"]["schedule_days"] | null
          secondary_payer?: string | null
          simulation_run_id?: string | null
          special_equipment_required?: string
          special_handling?: string | null
          stair_chair_required?: boolean | null
          stairs_required?: string
          standing_order?: boolean | null
          status?: Database["public"]["Enums"]["patient_status"]
          transport_type?: Database["public"]["Enums"]["transport_type"]
          trips_per_week_limit?: number | null
          updated_at?: string
          weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payer_billing_rules: {
        Row: {
          company_id: string | null
          id: string
          payer_type: string
          requires_auth: boolean | null
          requires_miles: boolean | null
          requires_necessity_note: boolean | null
          requires_pcs: boolean | null
          requires_signature: boolean | null
          requires_timestamps: boolean | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          id?: string
          payer_type?: string
          requires_auth?: boolean | null
          requires_miles?: boolean | null
          requires_necessity_note?: boolean | null
          requires_pcs?: boolean | null
          requires_signature?: boolean | null
          requires_timestamps?: boolean | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          id?: string
          payer_type?: string
          requires_auth?: boolean | null
          requires_miles?: boolean | null
          requires_necessity_note?: boolean | null
          requires_pcs?: boolean | null
          requires_signature?: boolean | null
          requires_timestamps?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payer_billing_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          bariatric_trained: boolean
          cert_level: Database["public"]["Enums"]["cert_level"]
          company_id: string | null
          created_at: string
          full_name: string
          id: string
          is_simulated: boolean
          lift_assist_ok: boolean
          max_safe_team_lift_lbs: number
          oxygen_handling_trained: boolean
          phone_number: string | null
          sex: Database["public"]["Enums"]["sex_type"]
          simulation_run_id: string | null
          stair_chair_trained: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          bariatric_trained?: boolean
          cert_level?: Database["public"]["Enums"]["cert_level"]
          company_id?: string | null
          created_at?: string
          full_name: string
          id?: string
          is_simulated?: boolean
          lift_assist_ok?: boolean
          max_safe_team_lift_lbs?: number
          oxygen_handling_trained?: boolean
          phone_number?: string | null
          sex?: Database["public"]["Enums"]["sex_type"]
          simulation_run_id?: string | null
          stair_chair_trained?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          bariatric_trained?: boolean
          cert_level?: Database["public"]["Enums"]["cert_level"]
          company_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_simulated?: boolean
          lift_assist_ok?: boolean
          max_safe_team_lift_lbs?: number
          oxygen_handling_trained?: boolean
          phone_number?: string | null
          sex?: Database["public"]["Enums"]["sex_type"]
          simulation_run_id?: string | null
          stair_chair_trained?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      qa_reviews: {
        Row: {
          claim_id: string | null
          company_id: string | null
          created_at: string
          flag_reason: string
          id: string
          qa_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          trip_id: string | null
        }
        Insert: {
          claim_id?: string | null
          company_id?: string | null
          created_at?: string
          flag_reason: string
          id?: string
          qa_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          trip_id?: string | null
        }
        Update: {
          claim_id?: string | null
          company_id?: string | null
          created_at?: string
          flag_reason?: string
          id?: string
          qa_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_reviews_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claim_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_reviews_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_records"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          company_id: string | null
          created_at: string
          crew_id: string | null
          id: string
          notes: string | null
          patient_id: string
          pickup_time: string | null
          run_date: string
          sort_order: number
          status: Database["public"]["Enums"]["run_status"]
          trip_type: Database["public"]["Enums"]["trip_type"]
          truck_id: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          crew_id?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          pickup_time?: string | null
          run_date?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["run_status"]
          trip_type?: Database["public"]["Enums"]["trip_type"]
          truck_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          crew_id?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          pickup_time?: string | null
          run_date?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["run_status"]
          trip_type?: Database["public"]["Enums"]["trip_type"]
          truck_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_overrides: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          leg_id: string | null
          overridden_at: string
          overridden_by: string
          override_reason: string
          override_status: string
          reasons: string[]
          slot_id: string | null
          trip_record_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          leg_id?: string | null
          overridden_at?: string
          overridden_by: string
          override_reason: string
          override_status: string
          reasons?: string[]
          slot_id?: string | null
          trip_record_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          leg_id?: string | null
          overridden_at?: string
          overridden_by?: string
          override_reason?: string
          override_status?: string
          reasons?: string[]
          slot_id?: string | null
          trip_record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_overrides_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_overrides_leg_id_fkey"
            columns: ["leg_id"]
            isOneToOne: false
            referencedRelation: "scheduling_legs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_overrides_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "truck_run_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_overrides_trip_record_id_fkey"
            columns: ["trip_record_id"]
            isOneToOne: false
            referencedRelation: "trip_records"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_previews: {
        Row: {
          id: string
          message: string
          preview_date: string
          sent_at: string
          sent_by: string
          target_user_id: string
        }
        Insert: {
          id?: string
          message: string
          preview_date: string
          sent_at?: string
          sent_by: string
          target_user_id: string
        }
        Update: {
          id?: string
          message?: string
          preview_date?: string
          sent_at?: string
          sent_by?: string
          target_user_id?: string
        }
        Relationships: []
      }
      scheduling_legs: {
        Row: {
          chair_time: string | null
          company_id: string | null
          created_at: string
          destination_location: string
          estimated_duration_minutes: number | null
          id: string
          is_simulated: boolean
          leg_type: Database["public"]["Enums"]["leg_type"]
          notes: string | null
          patient_id: string
          pickup_location: string
          pickup_time: string | null
          run_date: string
          simulation_run_id: string | null
          trip_type: Database["public"]["Enums"]["trip_type"]
          updated_at: string
        }
        Insert: {
          chair_time?: string | null
          company_id?: string | null
          created_at?: string
          destination_location: string
          estimated_duration_minutes?: number | null
          id?: string
          is_simulated?: boolean
          leg_type: Database["public"]["Enums"]["leg_type"]
          notes?: string | null
          patient_id: string
          pickup_location: string
          pickup_time?: string | null
          run_date?: string
          simulation_run_id?: string | null
          trip_type?: Database["public"]["Enums"]["trip_type"]
          updated_at?: string
        }
        Update: {
          chair_time?: string | null
          company_id?: string | null
          created_at?: string
          destination_location?: string
          estimated_duration_minutes?: number | null
          id?: string
          is_simulated?: boolean
          leg_type?: Database["public"]["Enums"]["leg_type"]
          notes?: string | null
          patient_id?: string
          pickup_location?: string
          pickup_time?: string | null
          run_date?: string
          simulation_run_id?: string | null
          trip_type?: Database["public"]["Enums"]["trip_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduling_legs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduling_legs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_runs: {
        Row: {
          config: Json | null
          created_at: string
          created_by: string
          id: string
          scenario_name: string
          status: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          created_by: string
          id?: string
          scenario_name: string
          status?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          created_by?: string
          id?: string
          scenario_name?: string
          status?: string
        }
        Relationships: []
      }
      simulation_snapshots: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          snapshot_data: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          snapshot_data?: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          snapshot_data?: Json
        }
        Relationships: []
      }
      status_updates: {
        Row: {
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          run_id: string
          status: Database["public"]["Enums"]["run_status"]
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          run_id: string
          status: Database["public"]["Enums"]["run_status"]
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          run_id?: string
          status?: Database["public"]["Enums"]["run_status"]
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "status_updates_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_records: {
        Row: {
          company_id: string
          created_at: string
          current_period_end: string | null
          id: string
          last_payment_at: string | null
          last_payment_status: string | null
          monthly_amount_cents: number
          plan_id: string
          provider: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          subscription_status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          last_payment_at?: string | null
          last_payment_status?: string | null
          monthly_amount_cents?: number
          plan_id?: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          subscription_status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          last_payment_at?: string | null
          last_payment_status?: string | null
          monthly_amount_cents?: number
          plan_id?: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          subscription_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      system_creators: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      trip_events: {
        Row: {
          company_id: string
          created_at: string
          crew_id: string | null
          event_time: string
          event_type: string
          id: string
          meta: Json | null
          simulation_run_id: string | null
          slot_id: string | null
          source: string
          trip_id: string
          truck_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          crew_id?: string | null
          event_time?: string
          event_type: string
          id?: string
          meta?: Json | null
          simulation_run_id?: string | null
          slot_id?: string | null
          source?: string
          trip_id: string
          truck_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          crew_id?: string | null
          event_time?: string
          event_type?: string
          id?: string
          meta?: Json | null
          simulation_run_id?: string | null
          slot_id?: string | null
          source?: string
          trip_id?: string
          truck_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_events_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_events_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "truck_run_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_events_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_projection_state: {
        Row: {
          company_id: string
          confidence: number
          late_probability: number
          projected_complete_at: string | null
          projected_next_arrival_at: string | null
          reason_codes: string[]
          risk_color: string
          simulation_run_id: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          confidence?: number
          late_probability?: number
          projected_complete_at?: string | null
          projected_next_arrival_at?: string | null
          reason_codes?: string[]
          risk_color?: string
          simulation_run_id?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          confidence?: number
          late_probability?: number
          projected_complete_at?: string | null
          projected_next_arrival_at?: string | null
          reason_codes?: string[]
          risk_color?: string
          simulation_run_id?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_projection_state_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trip_records"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_records: {
        Row: {
          arrived_dropoff_at: string | null
          arrived_pickup_at: string | null
          bed_confined: boolean | null
          billing_blocked_reason: string | null
          blockers: string[] | null
          blood_pressure: string | null
          cannot_transfer_safely: boolean | null
          claim_ready: boolean | null
          clinical_note: string | null
          company_id: string | null
          created_at: string
          crew_id: string | null
          crew_ids: string[] | null
          crew_names: string | null
          destination_location: string | null
          destination_type: string | null
          dispatch_time: string | null
          documentation_complete: boolean | null
          dropped_at: string | null
          esrd_dialysis: boolean | null
          expected_revenue: number | null
          fall_risk: boolean | null
          general_weakness: boolean | null
          hcpcs_codes: string[] | null
          hcpcs_modifiers: string[] | null
          heart_rate: number | null
          id: string
          is_simulated: boolean
          leg_id: string | null
          loaded_at: string | null
          loaded_miles: number | null
          mobility_method: string | null
          necessity_notes: string | null
          origin_type: string | null
          oxygen_during_transport: boolean | null
          oxygen_saturation: number | null
          patient_id: string | null
          pcr_type: string | null
          pcs_attached: boolean | null
          pickup_location: string | null
          requires_monitoring: boolean | null
          respiration_rate: number | null
          run_date: string
          scheduled_dropoff_time: string | null
          scheduled_pickup_time: string | null
          service_level: string | null
          signature_obtained: boolean | null
          simulation_run_id: string | null
          slot_id: string | null
          status: Database["public"]["Enums"]["trip_status"]
          stretcher_required: boolean | null
          trip_type: Database["public"]["Enums"]["trip_type"] | null
          truck_id: string | null
          updated_at: string
          vitals_taken_at: string | null
          wait_time_minutes: number | null
        }
        Insert: {
          arrived_dropoff_at?: string | null
          arrived_pickup_at?: string | null
          bed_confined?: boolean | null
          billing_blocked_reason?: string | null
          blockers?: string[] | null
          blood_pressure?: string | null
          cannot_transfer_safely?: boolean | null
          claim_ready?: boolean | null
          clinical_note?: string | null
          company_id?: string | null
          created_at?: string
          crew_id?: string | null
          crew_ids?: string[] | null
          crew_names?: string | null
          destination_location?: string | null
          destination_type?: string | null
          dispatch_time?: string | null
          documentation_complete?: boolean | null
          dropped_at?: string | null
          esrd_dialysis?: boolean | null
          expected_revenue?: number | null
          fall_risk?: boolean | null
          general_weakness?: boolean | null
          hcpcs_codes?: string[] | null
          hcpcs_modifiers?: string[] | null
          heart_rate?: number | null
          id?: string
          is_simulated?: boolean
          leg_id?: string | null
          loaded_at?: string | null
          loaded_miles?: number | null
          mobility_method?: string | null
          necessity_notes?: string | null
          origin_type?: string | null
          oxygen_during_transport?: boolean | null
          oxygen_saturation?: number | null
          patient_id?: string | null
          pcr_type?: string | null
          pcs_attached?: boolean | null
          pickup_location?: string | null
          requires_monitoring?: boolean | null
          respiration_rate?: number | null
          run_date?: string
          scheduled_dropoff_time?: string | null
          scheduled_pickup_time?: string | null
          service_level?: string | null
          signature_obtained?: boolean | null
          simulation_run_id?: string | null
          slot_id?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          stretcher_required?: boolean | null
          trip_type?: Database["public"]["Enums"]["trip_type"] | null
          truck_id?: string | null
          updated_at?: string
          vitals_taken_at?: string | null
          wait_time_minutes?: number | null
        }
        Update: {
          arrived_dropoff_at?: string | null
          arrived_pickup_at?: string | null
          bed_confined?: boolean | null
          billing_blocked_reason?: string | null
          blockers?: string[] | null
          blood_pressure?: string | null
          cannot_transfer_safely?: boolean | null
          claim_ready?: boolean | null
          clinical_note?: string | null
          company_id?: string | null
          created_at?: string
          crew_id?: string | null
          crew_ids?: string[] | null
          crew_names?: string | null
          destination_location?: string | null
          destination_type?: string | null
          dispatch_time?: string | null
          documentation_complete?: boolean | null
          dropped_at?: string | null
          esrd_dialysis?: boolean | null
          expected_revenue?: number | null
          fall_risk?: boolean | null
          general_weakness?: boolean | null
          hcpcs_codes?: string[] | null
          hcpcs_modifiers?: string[] | null
          heart_rate?: number | null
          id?: string
          is_simulated?: boolean
          leg_id?: string | null
          loaded_at?: string | null
          loaded_miles?: number | null
          mobility_method?: string | null
          necessity_notes?: string | null
          origin_type?: string | null
          oxygen_during_transport?: boolean | null
          oxygen_saturation?: number | null
          patient_id?: string | null
          pcr_type?: string | null
          pcs_attached?: boolean | null
          pickup_location?: string | null
          requires_monitoring?: boolean | null
          respiration_rate?: number | null
          run_date?: string
          scheduled_dropoff_time?: string | null
          scheduled_pickup_time?: string | null
          service_level?: string | null
          signature_obtained?: boolean | null
          simulation_run_id?: string | null
          slot_id?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          stretcher_required?: boolean | null
          trip_type?: Database["public"]["Enums"]["trip_type"] | null
          truck_id?: string | null
          updated_at?: string
          vitals_taken_at?: string | null
          wait_time_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_records_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_records_leg_id_fkey"
            columns: ["leg_id"]
            isOneToOne: false
            referencedRelation: "scheduling_legs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_records_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "truck_run_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_records_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      truck_availability: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          reason: string | null
          start_date: string
          status: string
          truck_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
          status?: string
          truck_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
          status?: string
          truck_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "truck_availability_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_availability_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      truck_builder_templates: {
        Row: {
          company_id: string
          created_at: string
          day_type: string
          id: string
          mapping: Json
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          day_type: string
          id?: string
          mapping?: Json
          name?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          day_type?: string
          id?: string
          mapping?: Json
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      truck_risk_state: {
        Row: {
          collapse_index: number
          company_id: string
          late_probability: number
          risk_color: string
          simulation_run_id: string | null
          truck_id: string
          updated_at: string
        }
        Insert: {
          collapse_index?: number
          company_id: string
          late_probability?: number
          risk_color?: string
          simulation_run_id?: string | null
          truck_id: string
          updated_at?: string
        }
        Update: {
          collapse_index?: number
          company_id?: string
          late_probability?: number
          risk_color?: string
          simulation_run_id?: string | null
          truck_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "truck_risk_state_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: true
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      truck_run_slots: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          is_simulated: boolean
          leg_id: string
          run_date: string
          simulation_run_id: string | null
          slot_order: number
          status: Database["public"]["Enums"]["run_status"]
          truck_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_simulated?: boolean
          leg_id: string
          run_date?: string
          simulation_run_id?: string | null
          slot_order?: number
          status?: Database["public"]["Enums"]["run_status"]
          truck_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_simulated?: boolean
          leg_id?: string
          run_date?: string
          simulation_run_id?: string | null
          slot_order?: number
          status?: Database["public"]["Enums"]["run_status"]
          truck_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "truck_run_slots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_run_slots_leg_id_fkey"
            columns: ["leg_id"]
            isOneToOne: false
            referencedRelation: "scheduling_legs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_run_slots_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      trucks: {
        Row: {
          active: boolean
          company_id: string | null
          created_at: string
          has_bariatric_kit: boolean
          has_oxygen_mount: boolean
          has_power_stretcher: boolean
          has_stair_chair: boolean
          id: string
          is_simulated: boolean
          name: string
          simulation_run_id: string | null
        }
        Insert: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          has_bariatric_kit?: boolean
          has_oxygen_mount?: boolean
          has_power_stretcher?: boolean
          has_stair_chair?: boolean
          id?: string
          is_simulated?: boolean
          name: string
          simulation_run_id?: string | null
        }
        Update: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          has_bariatric_kit?: boolean
          has_oxygen_mount?: boolean
          has_power_stretcher?: boolean
          has_stair_chair?: boolean
          id?: string
          is_simulated?: boolean
          name?: string
          simulation_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trucks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_billing_override: {
        Args: { p_reason: string; p_trip_id: string }
        Returns: Json
      }
      get_my_company_id: { Args: never; Returns: string }
      get_my_role: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_billing: { Args: never; Returns: boolean }
      is_company_owner_or_creator: {
        Args: { _company_id: string }
        Returns: boolean
      }
      is_dispatcher: { Args: never; Returns: boolean }
      is_system_creator: { Args: never; Returns: boolean }
      write_audit_log: {
        Args: {
          _action: string
          _actor_email: string
          _actor_user_id: string
          _new_data?: Json
          _notes?: string
          _old_data?: Json
          _record_id?: string
          _table_name?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "crew" | "dispatcher" | "billing"
      cert_level: "EMT-B" | "EMT-A" | "EMT-P" | "AEMT" | "Other"
      claim_status:
        | "ready_to_bill"
        | "submitted"
        | "paid"
        | "denied"
        | "needs_correction"
      leg_type: "A" | "B"
      membership_role: "creator" | "owner" | "dispatcher" | "biller" | "crew"
      onboarding_status:
        | "signup_started"
        | "agreements_accepted"
        | "payment_pending"
        | "payment_confirmed"
        | "pending_approval"
        | "active"
        | "rejected"
        | "suspended"
        | "payment_issue"
      patient_status:
        | "active"
        | "in_hospital"
        | "out_of_hospital"
        | "vacation"
        | "paused"
      run_status:
        | "pending"
        | "en_route"
        | "arrived"
        | "with_patient"
        | "transporting"
        | "completed"
      schedule_days: "MWF" | "TTS"
      sex_type: "M" | "F"
      transport_type: "dialysis" | "outpatient" | "adhoc"
      trip_status:
        | "scheduled"
        | "assigned"
        | "en_route"
        | "loaded"
        | "completed"
        | "ready_for_billing"
        | "cancelled"
        | "arrived_pickup"
        | "arrived_dropoff"
        | "no_show"
        | "patient_not_ready"
        | "facility_delay"
      trip_type:
        | "dialysis"
        | "discharge"
        | "outpatient"
        | "hospital"
        | "private_pay"
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
      app_role: ["admin", "crew", "dispatcher", "billing"],
      cert_level: ["EMT-B", "EMT-A", "EMT-P", "AEMT", "Other"],
      claim_status: [
        "ready_to_bill",
        "submitted",
        "paid",
        "denied",
        "needs_correction",
      ],
      leg_type: ["A", "B"],
      membership_role: ["creator", "owner", "dispatcher", "biller", "crew"],
      onboarding_status: [
        "signup_started",
        "agreements_accepted",
        "payment_pending",
        "payment_confirmed",
        "pending_approval",
        "active",
        "rejected",
        "suspended",
        "payment_issue",
      ],
      patient_status: [
        "active",
        "in_hospital",
        "out_of_hospital",
        "vacation",
        "paused",
      ],
      run_status: [
        "pending",
        "en_route",
        "arrived",
        "with_patient",
        "transporting",
        "completed",
      ],
      schedule_days: ["MWF", "TTS"],
      sex_type: ["M", "F"],
      transport_type: ["dialysis", "outpatient", "adhoc"],
      trip_status: [
        "scheduled",
        "assigned",
        "en_route",
        "loaded",
        "completed",
        "ready_for_billing",
        "cancelled",
        "arrived_pickup",
        "arrived_dropoff",
        "no_show",
        "patient_not_ready",
        "facility_delay",
      ],
      trip_type: [
        "dialysis",
        "discharge",
        "outpatient",
        "hospital",
        "private_pay",
      ],
    },
  },
} as const
