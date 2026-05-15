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
      admin_actions: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string
          before_snapshot: Json | null
          company_id: string | null
          company_name: string | null
          created_at: string
          id: string
          reason: string | null
          stripe_cancel_status: string | null
          was_protected: boolean
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id: string
          before_snapshot?: Json | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          stripe_cancel_status?: string | null
          was_protected?: boolean
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string
          before_snapshot?: Json | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          stripe_cancel_status?: string | null
          was_protected?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          company_id: string
          created_at: string
          dismissed: boolean
          id: string
          message: string
          run_id: string | null
          severity: string
          truck_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          dismissed?: boolean
          id?: string
          message: string
          run_id?: string | null
          severity?: string
          truck_id?: string | null
        }
        Update: {
          company_id?: string
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
      ar_followup_notes: {
        Row: {
          claim_id: string
          company_id: string
          created_at: string
          created_by: string
          created_by_name: string | null
          id: string
          note_text: string
        }
        Insert: {
          claim_id: string
          company_id: string
          created_at?: string
          created_by: string
          created_by_name?: string | null
          id?: string
          note_text: string
        }
        Update: {
          claim_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          created_by_name?: string | null
          id?: string
          note_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "ar_followup_notes_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claim_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_followup_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          notes?: string | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      biller_tasks: {
        Row: {
          assigned_to: string | null
          claim_id: string | null
          company_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          dismiss_reason: string | null
          due_date: string
          id: string
          priority: number
          status: string
          task_type: string
          title: string
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          claim_id?: string | null
          company_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          dismiss_reason?: string | null
          due_date?: string
          id?: string
          priority?: number
          status?: string
          task_type: string
          title: string
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          claim_id?: string | null
          company_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          dismiss_reason?: string | null
          due_date?: string
          id?: string
          priority?: number
          status?: string
          task_type?: string
          title?: string
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "biller_tasks_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claim_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biller_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biller_tasks_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_records"
            referencedColumns: ["id"]
          },
        ]
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
          company_id: string
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
          company_id: string
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
          company_id?: string
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
      claim_acknowledgments: {
        Row: {
          ack_file_id: string | null
          claim_record_id: string | null
          company_id: string | null
          created_at: string
          file_type: string
          id: string
          outcome: string
          patient_control_number: string | null
          payer_claim_control_number: string | null
          raw_segment: string | null
          received_at: string
          rejection_codes: string[] | null
          rejection_reason: string | null
        }
        Insert: {
          ack_file_id?: string | null
          claim_record_id?: string | null
          company_id?: string | null
          created_at?: string
          file_type: string
          id?: string
          outcome: string
          patient_control_number?: string | null
          payer_claim_control_number?: string | null
          raw_segment?: string | null
          received_at?: string
          rejection_codes?: string[] | null
          rejection_reason?: string | null
        }
        Update: {
          ack_file_id?: string | null
          claim_record_id?: string | null
          company_id?: string | null
          created_at?: string
          file_type?: string
          id?: string
          outcome?: string
          patient_control_number?: string | null
          payer_claim_control_number?: string | null
          raw_segment?: string | null
          received_at?: string
          rejection_codes?: string[] | null
          rejection_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_acknowledgments_ack_file_id_fkey"
            columns: ["ack_file_id"]
            isOneToOne: false
            referencedRelation: "clearinghouse_ack_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_acknowledgments_claim_record_id_fkey"
            columns: ["claim_record_id"]
            isOneToOne: false
            referencedRelation: "claim_records"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_adjustments: {
        Row: {
          changed_by: string
          company_id: string
          created_at: string
          field_changed: string
          id: string
          new_value: string | null
          old_value: string | null
          reason: string | null
          trip_id: string
        }
        Insert: {
          changed_by: string
          company_id: string
          created_at?: string
          field_changed: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
          trip_id: string
        }
        Update: {
          changed_by?: string
          company_id?: string
          created_at?: string
          field_changed?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_adjustments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_creation_failures: {
        Row: {
          company_id: string
          created_at: string
          error_message: string
          id: string
          resolved_at: string | null
          resolved_by: string | null
          sqlstate: string | null
          trip_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          error_message: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          sqlstate?: string | null
          trip_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          error_message?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          sqlstate?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_creation_failures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_creation_failures_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_creation_failures_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_records"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_payments: {
        Row: {
          adjustment_codes: string[] | null
          allowed_amount: number | null
          amount: number
          applied_at: string
          claim_record_id: string
          clp_status_code: string | null
          company_id: string
          created_at: string
          denial_code: string | null
          denial_reason: string | null
          event_type: string
          id: string
          patient_responsibility: number
          payer_claim_control_number: string | null
          payment_date: string | null
          remittance_file_id: string | null
          write_off: number
        }
        Insert: {
          adjustment_codes?: string[] | null
          allowed_amount?: number | null
          amount?: number
          applied_at?: string
          claim_record_id: string
          clp_status_code?: string | null
          company_id: string
          created_at?: string
          denial_code?: string | null
          denial_reason?: string | null
          event_type: string
          id?: string
          patient_responsibility?: number
          payer_claim_control_number?: string | null
          payment_date?: string | null
          remittance_file_id?: string | null
          write_off?: number
        }
        Update: {
          adjustment_codes?: string[] | null
          allowed_amount?: number | null
          amount?: number
          applied_at?: string
          claim_record_id?: string
          clp_status_code?: string | null
          company_id?: string
          created_at?: string
          denial_code?: string | null
          denial_reason?: string | null
          event_type?: string
          id?: string
          patient_responsibility?: number
          payer_claim_control_number?: string | null
          payment_date?: string | null
          remittance_file_id?: string | null
          write_off?: number
        }
        Relationships: [
          {
            foreignKeyName: "claim_payments_claim_record_id_fkey"
            columns: ["claim_record_id"]
            isOneToOne: false
            referencedRelation: "claim_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_records: {
        Row: {
          acknowledged_at: string | null
          acknowledgment_status: string | null
          adjustment_codes: string[] | null
          allowed_amount: number | null
          amount_paid: number | null
          auth_number: string | null
          base_charge: number | null
          chief_complaint: string | null
          claim_build_date: string | null
          clearinghouse_id: string | null
          clearinghouse_status: string | null
          company_id: string
          cpt_codes: string[] | null
          created_at: string
          denial_category: string | null
          denial_code: string | null
          denial_reason: string | null
          destination_address: string | null
          destination_city: string | null
          destination_state: string | null
          destination_type: string | null
          destination_zip: string | null
          edi_acknowledgment_code: string | null
          emergency_billing_override: string | null
          emergency_billing_recommendation: string | null
          emergency_billing_reviewed_at: string | null
          emergency_billing_reviewed_by: string | null
          emergency_event_summary: string | null
          expected_revenue: number | null
          exported_at: string | null
          extras_charge: number | null
          has_emergency_event: boolean
          hcpcs_codes: string[] | null
          hcpcs_manually_set: boolean
          hcpcs_modifiers: string[] | null
          icd10_codes: string[] | null
          id: string
          is_simulated: boolean
          is_test_submission: boolean
          isolation_precautions: Json | null
          last_contacted_at: string | null
          last_rejection_byte: number | null
          last_rejection_loop: string | null
          last_rejection_raw: string | null
          last_rejection_recorded_at: string | null
          last_rejection_recorded_by: string | null
          last_rejection_segment: string | null
          last_submission_artifact_id: string | null
          medical_necessity_reason: string | null
          member_id: string | null
          mileage_charge: number | null
          notes: string | null
          odometer_at_destination: number | null
          odometer_at_scene: number | null
          odometer_in_service: number | null
          origin_address: string | null
          origin_city: string | null
          origin_state: string | null
          origin_type: string | null
          origin_zip: string | null
          original_claim_id: string | null
          paid_at: string | null
          patient_id: string | null
          patient_mobility: string | null
          patient_responsibility_amount: number | null
          patient_sex: string | null
          payer_claim_control_number: string | null
          payer_name: string | null
          payer_type: string | null
          pcs_attachment_control_number: string | null
          pcs_certification_date: string | null
          pcs_completed_at: string | null
          pcs_completed_by: string | null
          pcs_diagnosis: string | null
          pcs_document_on_file: boolean | null
          pcs_physician_name: string | null
          pcs_physician_npi: string | null
          primary_impression: string | null
          rejection_codes: string[] | null
          rejection_reason: string | null
          remittance_date: string | null
          resubmission_count: number | null
          resubmitted_at: string | null
          run_date: string
          secondary_claim_generated: boolean | null
          secondary_claim_id: string | null
          service_level: string | null
          sftp_sent_at: string | null
          simulation_run_id: string | null
          status: Database["public"]["Enums"]["claim_status"]
          stretcher_placement: string | null
          submitted_at: string | null
          total_charge: number | null
          trip_id: string | null
          updated_at: string
          vehicle_id: string | null
          write_off_amount: number | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledgment_status?: string | null
          adjustment_codes?: string[] | null
          allowed_amount?: number | null
          amount_paid?: number | null
          auth_number?: string | null
          base_charge?: number | null
          chief_complaint?: string | null
          claim_build_date?: string | null
          clearinghouse_id?: string | null
          clearinghouse_status?: string | null
          company_id: string
          cpt_codes?: string[] | null
          created_at?: string
          denial_category?: string | null
          denial_code?: string | null
          denial_reason?: string | null
          destination_address?: string | null
          destination_city?: string | null
          destination_state?: string | null
          destination_type?: string | null
          destination_zip?: string | null
          edi_acknowledgment_code?: string | null
          emergency_billing_override?: string | null
          emergency_billing_recommendation?: string | null
          emergency_billing_reviewed_at?: string | null
          emergency_billing_reviewed_by?: string | null
          emergency_event_summary?: string | null
          expected_revenue?: number | null
          exported_at?: string | null
          extras_charge?: number | null
          has_emergency_event?: boolean
          hcpcs_codes?: string[] | null
          hcpcs_manually_set?: boolean
          hcpcs_modifiers?: string[] | null
          icd10_codes?: string[] | null
          id?: string
          is_simulated?: boolean
          is_test_submission?: boolean
          isolation_precautions?: Json | null
          last_contacted_at?: string | null
          last_rejection_byte?: number | null
          last_rejection_loop?: string | null
          last_rejection_raw?: string | null
          last_rejection_recorded_at?: string | null
          last_rejection_recorded_by?: string | null
          last_rejection_segment?: string | null
          last_submission_artifact_id?: string | null
          medical_necessity_reason?: string | null
          member_id?: string | null
          mileage_charge?: number | null
          notes?: string | null
          odometer_at_destination?: number | null
          odometer_at_scene?: number | null
          odometer_in_service?: number | null
          origin_address?: string | null
          origin_city?: string | null
          origin_state?: string | null
          origin_type?: string | null
          origin_zip?: string | null
          original_claim_id?: string | null
          paid_at?: string | null
          patient_id?: string | null
          patient_mobility?: string | null
          patient_responsibility_amount?: number | null
          patient_sex?: string | null
          payer_claim_control_number?: string | null
          payer_name?: string | null
          payer_type?: string | null
          pcs_attachment_control_number?: string | null
          pcs_certification_date?: string | null
          pcs_completed_at?: string | null
          pcs_completed_by?: string | null
          pcs_diagnosis?: string | null
          pcs_document_on_file?: boolean | null
          pcs_physician_name?: string | null
          pcs_physician_npi?: string | null
          primary_impression?: string | null
          rejection_codes?: string[] | null
          rejection_reason?: string | null
          remittance_date?: string | null
          resubmission_count?: number | null
          resubmitted_at?: string | null
          run_date: string
          secondary_claim_generated?: boolean | null
          secondary_claim_id?: string | null
          service_level?: string | null
          sftp_sent_at?: string | null
          simulation_run_id?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          stretcher_placement?: string | null
          submitted_at?: string | null
          total_charge?: number | null
          trip_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
          write_off_amount?: number | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledgment_status?: string | null
          adjustment_codes?: string[] | null
          allowed_amount?: number | null
          amount_paid?: number | null
          auth_number?: string | null
          base_charge?: number | null
          chief_complaint?: string | null
          claim_build_date?: string | null
          clearinghouse_id?: string | null
          clearinghouse_status?: string | null
          company_id?: string
          cpt_codes?: string[] | null
          created_at?: string
          denial_category?: string | null
          denial_code?: string | null
          denial_reason?: string | null
          destination_address?: string | null
          destination_city?: string | null
          destination_state?: string | null
          destination_type?: string | null
          destination_zip?: string | null
          edi_acknowledgment_code?: string | null
          emergency_billing_override?: string | null
          emergency_billing_recommendation?: string | null
          emergency_billing_reviewed_at?: string | null
          emergency_billing_reviewed_by?: string | null
          emergency_event_summary?: string | null
          expected_revenue?: number | null
          exported_at?: string | null
          extras_charge?: number | null
          has_emergency_event?: boolean
          hcpcs_codes?: string[] | null
          hcpcs_manually_set?: boolean
          hcpcs_modifiers?: string[] | null
          icd10_codes?: string[] | null
          id?: string
          is_simulated?: boolean
          is_test_submission?: boolean
          isolation_precautions?: Json | null
          last_contacted_at?: string | null
          last_rejection_byte?: number | null
          last_rejection_loop?: string | null
          last_rejection_raw?: string | null
          last_rejection_recorded_at?: string | null
          last_rejection_recorded_by?: string | null
          last_rejection_segment?: string | null
          last_submission_artifact_id?: string | null
          medical_necessity_reason?: string | null
          member_id?: string | null
          mileage_charge?: number | null
          notes?: string | null
          odometer_at_destination?: number | null
          odometer_at_scene?: number | null
          odometer_in_service?: number | null
          origin_address?: string | null
          origin_city?: string | null
          origin_state?: string | null
          origin_type?: string | null
          origin_zip?: string | null
          original_claim_id?: string | null
          paid_at?: string | null
          patient_id?: string | null
          patient_mobility?: string | null
          patient_responsibility_amount?: number | null
          patient_sex?: string | null
          payer_claim_control_number?: string | null
          payer_name?: string | null
          payer_type?: string | null
          pcs_attachment_control_number?: string | null
          pcs_certification_date?: string | null
          pcs_completed_at?: string | null
          pcs_completed_by?: string | null
          pcs_diagnosis?: string | null
          pcs_document_on_file?: boolean | null
          pcs_physician_name?: string | null
          pcs_physician_npi?: string | null
          primary_impression?: string | null
          rejection_codes?: string[] | null
          rejection_reason?: string | null
          remittance_date?: string | null
          resubmission_count?: number | null
          resubmitted_at?: string | null
          run_date?: string
          secondary_claim_generated?: boolean | null
          secondary_claim_id?: string | null
          service_level?: string | null
          sftp_sent_at?: string | null
          simulation_run_id?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          stretcher_placement?: string | null
          submitted_at?: string | null
          total_charge?: number | null
          trip_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
          write_off_amount?: number | null
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
            foreignKeyName: "claim_records_last_submission_artifact_id_fkey"
            columns: ["last_submission_artifact_id"]
            isOneToOne: false
            referencedRelation: "claim_submission_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_records_original_claim_id_fkey"
            columns: ["original_claim_id"]
            isOneToOne: false
            referencedRelation: "claim_records"
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
            foreignKeyName: "claim_records_secondary_claim_id_fkey"
            columns: ["secondary_claim_id"]
            isOneToOne: false
            referencedRelation: "claim_records"
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
      claim_submission_artifacts: {
        Row: {
          byte_size: number
          claim_ids: string[]
          company_id: string
          edi_content: string
          filename: string
          generated_at: string
          generated_by: string | null
          id: string
          is_test_submission: boolean
          oatest_run_id: string | null
          oatest_scenario_id: string | null
        }
        Insert: {
          byte_size?: number
          claim_ids?: string[]
          company_id: string
          edi_content: string
          filename: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          is_test_submission?: boolean
          oatest_run_id?: string | null
          oatest_scenario_id?: string | null
        }
        Update: {
          byte_size?: number
          claim_ids?: string[]
          company_id?: string
          edi_content?: string
          filename?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          is_test_submission?: boolean
          oatest_run_id?: string | null
          oatest_scenario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_submission_artifacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_submission_artifacts_oatest_run_id_fkey"
            columns: ["oatest_run_id"]
            isOneToOne: false
            referencedRelation: "oatest_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_submission_artifacts_oatest_scenario_id_fkey"
            columns: ["oatest_scenario_id"]
            isOneToOne: false
            referencedRelation: "oatest_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_submission_queue: {
        Row: {
          attempts: number
          claim_ids: string[]
          company_id: string
          created_at: string
          edi_content: string
          error_message: string | null
          filename: string
          id: string
          is_test: boolean
          oatest_run_id: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          claim_ids?: string[]
          company_id: string
          created_at?: string
          edi_content: string
          error_message?: string | null
          filename: string
          id?: string
          is_test?: boolean
          oatest_run_id?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          claim_ids?: string[]
          company_id?: string
          created_at?: string
          edi_content?: string
          error_message?: string | null
          filename?: string
          id?: string
          is_test?: boolean
          oatest_run_id?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_submission_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_submission_queue_oatest_run_id_fkey"
            columns: ["oatest_run_id"]
            isOneToOne: false
            referencedRelation: "oatest_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      clearinghouse_ack_files: {
        Row: {
          claims_matched: number
          claims_updated: number
          created_at: string
          file_type: string
          filename: string
          id: string
          parse_error: string | null
          parsed_summary: Json | null
          processed_at: string | null
          raw_content: string
          received_at: string
          source_file_id: string | null
          submitted_filename: string | null
          unmatched_count: number
        }
        Insert: {
          claims_matched?: number
          claims_updated?: number
          created_at?: string
          file_type: string
          filename: string
          id?: string
          parse_error?: string | null
          parsed_summary?: Json | null
          processed_at?: string | null
          raw_content: string
          received_at?: string
          source_file_id?: string | null
          submitted_filename?: string | null
          unmatched_count?: number
        }
        Update: {
          claims_matched?: number
          claims_updated?: number
          created_at?: string
          file_type?: string
          filename?: string
          id?: string
          parse_error?: string | null
          parsed_summary?: Json | null
          processed_at?: string | null
          raw_content?: string
          received_at?: string
          source_file_id?: string | null
          submitted_filename?: string | null
          unmatched_count?: number
        }
        Relationships: []
      }
      clearinghouse_credentials: {
        Row: {
          company_id: string
          created_at: string
          id: string
          sftp_password: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          sftp_password: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          sftp_password?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clearinghouse_credentials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      clearinghouse_settings: {
        Row: {
          auto_receive_enabled: boolean
          auto_send_enabled: boolean
          clearinghouse_name: string
          company_id: string
          created_at: string
          id: string
          inbound_folder: string
          is_active: boolean
          is_configured: boolean
          last_error: string | null
          last_receive_at: string | null
          last_send_at: string | null
          outbound_folder: string
          sftp_host: string
          sftp_password_encrypted: string | null
          sftp_port: number
          sftp_username: string | null
          updated_at: string
        }
        Insert: {
          auto_receive_enabled?: boolean
          auto_send_enabled?: boolean
          clearinghouse_name?: string
          company_id: string
          created_at?: string
          id?: string
          inbound_folder?: string
          is_active?: boolean
          is_configured?: boolean
          last_error?: string | null
          last_receive_at?: string | null
          last_send_at?: string | null
          outbound_folder?: string
          sftp_host?: string
          sftp_password_encrypted?: string | null
          sftp_port?: number
          sftp_username?: string | null
          updated_at?: string
        }
        Update: {
          auto_receive_enabled?: boolean
          auto_send_enabled?: boolean
          clearinghouse_name?: string
          company_id?: string
          created_at?: string
          id?: string
          inbound_folder?: string
          is_active?: boolean
          is_configured?: boolean
          last_error?: string | null
          last_receive_at?: string | null
          last_send_at?: string | null
          outbound_folder?: string
          sftp_host?: string
          sftp_password_encrypted?: string | null
          sftp_port?: number
          sftp_username?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clearinghouse_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      comms_events: {
        Row: {
          call_status: string | null
          call_type: string | null
          called_at: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          eta_used: string | null
          event_type: string
          facility_id: string | null
          facility_name: string | null
          from_number: string | null
          id: string
          message_text: string | null
          patient_name: string | null
          payload: Json | null
          queued_at: string | null
          queued_by: string | null
          simulation_run_id: string | null
          status: string
          trip_id: string
          truck_id: string
          twilio_call_sid: string | null
        }
        Insert: {
          call_status?: string | null
          call_type?: string | null
          called_at?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          eta_used?: string | null
          event_type: string
          facility_id?: string | null
          facility_name?: string | null
          from_number?: string | null
          id?: string
          message_text?: string | null
          patient_name?: string | null
          payload?: Json | null
          queued_at?: string | null
          queued_by?: string | null
          simulation_run_id?: string | null
          status?: string
          trip_id: string
          truck_id: string
          twilio_call_sid?: string | null
        }
        Update: {
          call_status?: string | null
          call_type?: string | null
          called_at?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          eta_used?: string | null
          event_type?: string
          facility_id?: string | null
          facility_name?: string | null
          from_number?: string | null
          id?: string
          message_text?: string | null
          patient_name?: string | null
          payload?: Json | null
          queued_at?: string | null
          queued_by?: string | null
          simulation_run_id?: string | null
          status?: string
          trip_id?: string
          truck_id?: string
          twilio_call_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comms_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          address_city: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          creator_test_tenant: boolean
          current_software: string | null
          deleted_at: string | null
          deleted_by: string | null
          ein_number: string | null
          has_inhouse_biller: boolean | null
          hipaa_privacy_officer: string | null
          id: string
          is_sandbox: boolean
          medicare_enrolled: boolean | null
          medicare_specialty: string | null
          name: string
          npi_number: string | null
          npi_registered_name: string | null
          npi_verified: boolean | null
          oig_excluded: boolean | null
          oig_exclusion_details: string | null
          onboarding_status: Database["public"]["Enums"]["onboarding_status"]
          owner_email: string | null
          owner_user_id: string | null
          payer_mix_facility: number | null
          payer_mix_medicaid: number | null
          payer_mix_medicare: number | null
          payer_mix_private: number | null
          rejected_at: string | null
          rejected_reason: string | null
          service_area_type: string | null
          state_of_operation: string | null
          suspended_at: string | null
          suspended_by: string | null
          suspended_reason: string | null
          truck_count: number | null
          verification_checked_at: string | null
          verified_by: string | null
          years_in_operation: number | null
        }
        Insert: {
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          creator_test_tenant?: boolean
          current_software?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          ein_number?: string | null
          has_inhouse_biller?: boolean | null
          hipaa_privacy_officer?: string | null
          id?: string
          is_sandbox?: boolean
          medicare_enrolled?: boolean | null
          medicare_specialty?: string | null
          name: string
          npi_number?: string | null
          npi_registered_name?: string | null
          npi_verified?: boolean | null
          oig_excluded?: boolean | null
          oig_exclusion_details?: string | null
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"]
          owner_email?: string | null
          owner_user_id?: string | null
          payer_mix_facility?: number | null
          payer_mix_medicaid?: number | null
          payer_mix_medicare?: number | null
          payer_mix_private?: number | null
          rejected_at?: string | null
          rejected_reason?: string | null
          service_area_type?: string | null
          state_of_operation?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_reason?: string | null
          truck_count?: number | null
          verification_checked_at?: string | null
          verified_by?: string | null
          years_in_operation?: number | null
        }
        Update: {
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          creator_test_tenant?: boolean
          current_software?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          ein_number?: string | null
          has_inhouse_biller?: boolean | null
          hipaa_privacy_officer?: string | null
          id?: string
          is_sandbox?: boolean
          medicare_enrolled?: boolean | null
          medicare_specialty?: string | null
          name?: string
          npi_number?: string | null
          npi_registered_name?: string | null
          npi_verified?: boolean | null
          oig_excluded?: boolean | null
          oig_exclusion_details?: string | null
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"]
          owner_email?: string | null
          owner_user_id?: string | null
          payer_mix_facility?: number | null
          payer_mix_medicaid?: number | null
          payer_mix_medicare?: number | null
          payer_mix_private?: number | null
          rejected_at?: string | null
          rejected_reason?: string | null
          service_area_type?: string | null
          state_of_operation?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_reason?: string | null
          truck_count?: number | null
          verification_checked_at?: string | null
          verified_by?: string | null
          years_in_operation?: number | null
        }
        Relationships: []
      }
      company_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by_user_id: string
          id: string
          profile_id: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by_user_id: string
          id?: string
          profile_id?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by_user_id?: string
          id?: string
          profile_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_invites_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          company_id: string
          company_name: string
          dialysis_b_leg_buffer_minutes: number
          discharge_buffer_minutes: number
          facility_delay_minutes: number
          grace_window_minutes: number
          id: string
          load_time_minutes: number
          retention_policy_years: number
          session_timeout_minutes: number
          session_warning_enabled: boolean
          unload_time_minutes: number
          updated_at: string
          verified_caller_id: string | null
        }
        Insert: {
          company_id: string
          company_name?: string
          dialysis_b_leg_buffer_minutes?: number
          discharge_buffer_minutes?: number
          facility_delay_minutes?: number
          grace_window_minutes?: number
          id?: string
          load_time_minutes?: number
          retention_policy_years?: number
          session_timeout_minutes?: number
          session_warning_enabled?: boolean
          unload_time_minutes?: number
          updated_at?: string
          verified_caller_id?: string | null
        }
        Update: {
          company_id?: string
          company_name?: string
          dialysis_b_leg_buffer_minutes?: number
          discharge_buffer_minutes?: number
          facility_delay_minutes?: number
          grace_window_minutes?: number
          id?: string
          load_time_minutes?: number
          retention_policy_years?: number
          session_timeout_minutes?: number
          session_warning_enabled?: boolean
          unload_time_minutes?: number
          updated_at?: string
          verified_caller_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_verifications: {
        Row: {
          approved_at: string
          approver_email: string | null
          approver_user_id: string
          company_id: string
          created_at: string
          id: string
          manual_notes: string | null
          medicare_enrolled: boolean
          medicare_result: Json | null
          npi_result: Json | null
          npi_verified: boolean
          oig_clear: boolean
          oig_result: Json | null
        }
        Insert: {
          approved_at?: string
          approver_email?: string | null
          approver_user_id: string
          company_id: string
          created_at?: string
          id?: string
          manual_notes?: string | null
          medicare_enrolled?: boolean
          medicare_result?: Json | null
          npi_result?: Json | null
          npi_verified?: boolean
          oig_clear?: boolean
          oig_result?: Json | null
        }
        Update: {
          approved_at?: string
          approver_email?: string | null
          approver_user_id?: string
          company_id?: string
          created_at?: string
          id?: string
          manual_notes?: string | null
          medicare_enrolled?: boolean
          medicare_result?: Json | null
          npi_result?: Json | null
          npi_verified?: boolean
          oig_clear?: boolean
          oig_result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "company_verifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_recovery_attempts: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          notes: string | null
          outcome: string
          slug_provided_hash: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          outcome: string
          slug_provided_hash?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          outcome?: string
          slug_provided_hash?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      creator_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      crew_share_tokens: {
        Row: {
          active: boolean
          company_id: string
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
          company_id: string
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
          company_id?: string
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
            foreignKeyName: "crew_share_tokens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          company_id: string
          created_at: string
          id: string
          is_simulated: boolean
          member1_id: string | null
          member2_id: string | null
          member3_id: string | null
          simulation_run_id: string | null
          truck_id: string
        }
        Insert: {
          active_date?: string
          company_id: string
          created_at?: string
          id?: string
          is_simulated?: boolean
          member1_id?: string | null
          member2_id?: string | null
          member3_id?: string | null
          simulation_run_id?: string | null
          truck_id: string
        }
        Update: {
          active_date?: string
          company_id?: string
          created_at?: string
          id?: string
          is_simulated?: boolean
          member1_id?: string | null
          member2_id?: string | null
          member3_id?: string | null
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
            foreignKeyName: "crews_member3_id_fkey"
            columns: ["member3_id"]
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
      customer_payer_enrollments: {
        Row: {
          company_id: string
          created_at: string
          edi_enrolled: boolean
          edi_enrolled_at: string | null
          eft_enrolled: boolean
          eft_enrolled_at: string | null
          era_enrolled: boolean
          era_enrolled_at: string | null
          id: string
          notes: string | null
          payer_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          edi_enrolled?: boolean
          edi_enrolled_at?: string | null
          eft_enrolled?: boolean
          eft_enrolled_at?: string | null
          era_enrolled?: boolean
          era_enrolled_at?: string | null
          id?: string
          notes?: string | null
          payer_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          edi_enrolled?: boolean
          edi_enrolled_at?: string | null
          eft_enrolled?: boolean
          eft_enrolled_at?: string | null
          era_enrolled?: boolean
          era_enrolled_at?: string | null
          id?: string
          notes?: string | null
          payer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_payer_enrollments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payer_enrollments_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payer_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_truck_metrics: {
        Row: {
          avg_facility_wait_min: number
          company_id: string
          id: string
          late_causes: Json
          late_count: number
          on_time_count: number
          on_time_pct: number
          operational_risk_score: number
          run_date: string
          simulation_run_id: string | null
          total_trips: number
          total_wait_min: number
          truck_id: string
          updated_at: string
        }
        Insert: {
          avg_facility_wait_min?: number
          company_id: string
          id?: string
          late_causes?: Json
          late_count?: number
          on_time_count?: number
          on_time_pct?: number
          operational_risk_score?: number
          run_date: string
          simulation_run_id?: string | null
          total_trips?: number
          total_wait_min?: number
          truck_id: string
          updated_at?: string
        }
        Update: {
          avg_facility_wait_min?: number
          company_id?: string
          id?: string
          late_causes?: Json
          late_count?: number
          on_time_count?: number
          on_time_pct?: number
          operational_risk_score?: number
          run_date?: string
          simulation_run_id?: string | null
          total_trips?: number
          total_wait_min?: number
          truck_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_truck_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_truck_metrics_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      document_attachments: {
        Row: {
          company_id: string
          created_at: string
          document_type: string
          file_name: string
          file_path: string
          id: string
          record_id: string
          record_type: string
          uploaded_by: string
          uploaded_by_name: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          document_type?: string
          file_name: string
          file_path: string
          id?: string
          record_id: string
          record_type: string
          uploaded_by: string
          uploaded_by_name?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          document_type?: string
          file_name?: string
          file_path?: string
          id?: string
          record_id?: string
          record_type?: string
          uploaded_by?: string
          uploaded_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_function_rate_limits: {
        Row: {
          created_at: string | null
          function_name: string
          id: string
          identifier: string
          request_count: number
          window_start: string
        }
        Insert: {
          created_at?: string | null
          function_name: string
          id?: string
          identifier: string
          request_count?: number
          window_start?: string
        }
        Update: {
          created_at?: string | null
          function_name?: string
          id?: string
          identifier?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      eligibility_checks: {
        Row: {
          checked_at: string
          checked_by: string | null
          company_id: string
          coverage_end: string | null
          coverage_start: string | null
          id: string
          is_eligible: boolean | null
          patient_id: string
          payer_type: string | null
          raw_response: Json | null
          response_summary: string | null
        }
        Insert: {
          checked_at?: string
          checked_by?: string | null
          company_id: string
          coverage_end?: string | null
          coverage_start?: string | null
          id?: string
          is_eligible?: boolean | null
          patient_id: string
          payer_type?: string | null
          raw_response?: Json | null
          response_summary?: string | null
        }
        Update: {
          checked_at?: string
          checked_by?: string | null
          company_id?: string
          coverage_end?: string | null
          coverage_start?: string | null
          id?: string
          is_eligible?: boolean | null
          patient_id?: string
          payer_type?: string | null
          raw_response?: Json | null
          response_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eligibility_checks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_checks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          attempted_at: string
          company_id: string
          created_at: string
          email_type: Database["public"]["Enums"]["email_type"]
          error_message: string | null
          from_address: string
          from_name: string | null
          id: string
          recipient_email: string
          recipient_user_id: string | null
          resend_email_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_send_status"]
          subject: string
        }
        Insert: {
          attempted_at?: string
          company_id: string
          created_at?: string
          email_type?: Database["public"]["Enums"]["email_type"]
          error_message?: string | null
          from_address: string
          from_name?: string | null
          id?: string
          recipient_email: string
          recipient_user_id?: string | null
          resend_email_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_send_status"]
          subject: string
        }
        Update: {
          attempted_at?: string
          company_id?: string
          created_at?: string
          email_type?: Database["public"]["Enums"]["email_type"]
          error_message?: string | null
          from_address?: string
          from_name?: string | null
          id?: string
          recipient_email?: string
          recipient_user_id?: string | null
          resend_email_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_send_status"]
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_send_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          active: boolean | null
          address: string | null
          company_id: string
          contact_name: string | null
          contract_payer_type: string | null
          created_at: string
          dialysis_subtype: string | null
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
          company_id: string
          contact_name?: string | null
          contract_payer_type?: string | null
          created_at?: string
          dialysis_subtype?: string | null
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
          company_id?: string
          contact_name?: string | null
          contract_payer_type?: string | null
          created_at?: string
          dialysis_subtype?: string | null
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
            foreignKeyName: "hold_timers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
        Relationships: [
          {
            foreignKeyName: "import_mapping_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "import_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_reports: {
        Row: {
          additional_personnel: string | null
          company_id: string
          created_at: string
          crew_names: string | null
          description: string | null
          emergency_services_contacted: boolean
          id: string
          incident_date: string
          incident_type: string
          patient_affected: string | null
          patient_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string
          trip_id: string | null
          truck_id: string | null
          updated_at: string
        }
        Insert: {
          additional_personnel?: string | null
          company_id: string
          created_at?: string
          crew_names?: string | null
          description?: string | null
          emergency_services_contacted?: boolean
          id?: string
          incident_date: string
          incident_type?: string
          patient_affected?: string | null
          patient_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by: string
          trip_id?: string | null
          truck_id?: string | null
          updated_at?: string
        }
        Update: {
          additional_personnel?: string | null
          company_id?: string
          created_at?: string
          crew_names?: string | null
          description?: string | null
          emergency_services_contacted?: boolean
          id?: string
          incident_date?: string
          incident_type?: string
          patient_affected?: string | null
          patient_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string
          trip_id?: string | null
          truck_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_reports_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_reports_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_reports_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
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
      loadtest_reports: {
        Row: {
          created_at: string
          errors: Json | null
          finished_at: string | null
          id: string
          isolation_results: Json | null
          latency_results: Json | null
          manifest: Json | null
          scenario_seconds: number | null
          started_at: string
          status: string
          summary: Json | null
          tenant_count: number | null
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          errors?: Json | null
          finished_at?: string | null
          id?: string
          isolation_results?: Json | null
          latency_results?: Json | null
          manifest?: Json | null
          scenario_seconds?: number | null
          started_at?: string
          status?: string
          summary?: Json | null
          tenant_count?: number | null
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          errors?: Json | null
          finished_at?: string | null
          id?: string
          isolation_results?: Json | null
          latency_results?: Json | null
          manifest?: Json | null
          scenario_seconds?: number | null
          started_at?: string
          status?: string
          summary?: Json | null
          tenant_count?: number | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      migration_settings: {
        Row: {
          company_id: string
          created_at: string
          id: string
          onboarding_dismissed: boolean
          parallel_mode: boolean
          start_forward_mode: boolean
          step_0_skipped: boolean
          step_1_skipped: boolean
          step_2_skipped: boolean
          step_3_skipped: boolean
          step_4_skipped: boolean
          step_5_skipped: boolean
          step_clearinghouse_connected: boolean
          step_company_info_verified: boolean
          step_first_trip: boolean
          step_patients_added: boolean
          step_rates_verified: boolean
          step_team_invited: boolean
          step_trucks_added: boolean
          updated_at: string
          wizard_completed: boolean
          wizard_step: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          onboarding_dismissed?: boolean
          parallel_mode?: boolean
          start_forward_mode?: boolean
          step_0_skipped?: boolean
          step_1_skipped?: boolean
          step_2_skipped?: boolean
          step_3_skipped?: boolean
          step_4_skipped?: boolean
          step_5_skipped?: boolean
          step_clearinghouse_connected?: boolean
          step_company_info_verified?: boolean
          step_first_trip?: boolean
          step_patients_added?: boolean
          step_rates_verified?: boolean
          step_team_invited?: boolean
          step_trucks_added?: boolean
          updated_at?: string
          wizard_completed?: boolean
          wizard_step?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          onboarding_dismissed?: boolean
          parallel_mode?: boolean
          start_forward_mode?: boolean
          step_0_skipped?: boolean
          step_1_skipped?: boolean
          step_2_skipped?: boolean
          step_3_skipped?: boolean
          step_4_skipped?: boolean
          step_5_skipped?: boolean
          step_clearinghouse_connected?: boolean
          step_company_info_verified?: boolean
          step_first_trip?: boolean
          step_patients_added?: boolean
          step_rates_verified?: boolean
          step_team_invited?: boolean
          step_trucks_added?: boolean
          updated_at?: string
          wizard_completed?: boolean
          wizard_step?: number
        }
        Relationships: [
          {
            foreignKeyName: "migration_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          created_at: string
          id: string
          message: string
          notification_type: string | null
          related_run_id: string | null
          user_id: string
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          created_at?: string
          id?: string
          message: string
          notification_type?: string | null
          related_run_id?: string | null
          user_id: string
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          created_at?: string
          id?: string
          message?: string
          notification_type?: string | null
          related_run_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      oatest_runs: {
        Row: {
          ack_277ca_raw: string | null
          ack_277ca_status: string | null
          ack_999_raw: string | null
          ack_999_status: string | null
          artifact_id: string | null
          claim_id: string | null
          completed_at: string | null
          failure_stage: string | null
          failure_summary: string | null
          filename: string | null
          id: string
          ik3_error_code: string | null
          ik3_loop: string | null
          ik3_segment: string | null
          queue_id: string | null
          readiness_issues: Json | null
          scenario_id: string
          started_at: string
          status: string
          triggered_by: string | null
          trip_id: string | null
        }
        Insert: {
          ack_277ca_raw?: string | null
          ack_277ca_status?: string | null
          ack_999_raw?: string | null
          ack_999_status?: string | null
          artifact_id?: string | null
          claim_id?: string | null
          completed_at?: string | null
          failure_stage?: string | null
          failure_summary?: string | null
          filename?: string | null
          id?: string
          ik3_error_code?: string | null
          ik3_loop?: string | null
          ik3_segment?: string | null
          queue_id?: string | null
          readiness_issues?: Json | null
          scenario_id: string
          started_at?: string
          status?: string
          triggered_by?: string | null
          trip_id?: string | null
        }
        Update: {
          ack_277ca_raw?: string | null
          ack_277ca_status?: string | null
          ack_999_raw?: string | null
          ack_999_status?: string | null
          artifact_id?: string | null
          claim_id?: string | null
          completed_at?: string | null
          failure_stage?: string | null
          failure_summary?: string | null
          filename?: string | null
          id?: string
          ik3_error_code?: string | null
          ik3_loop?: string | null
          ik3_segment?: string | null
          queue_id?: string | null
          readiness_issues?: Json | null
          scenario_id?: string
          started_at?: string
          status?: string
          triggered_by?: string | null
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oatest_runs_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "claim_submission_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oatest_runs_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "oatest_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      oatest_scenarios: {
        Row: {
          created_at: string
          description: string
          destination_modifier: string | null
          enabled: boolean
          expected_hcpcs: string | null
          expected_modifiers: string[] | null
          id: string
          name: string
          notes: string | null
          origin_modifier: string | null
          payer_type: string
          scenario_template: Json
          slug: string
          transport_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          destination_modifier?: string | null
          enabled?: boolean
          expected_hcpcs?: string | null
          expected_modifiers?: string[] | null
          id?: string
          name: string
          notes?: string | null
          origin_modifier?: string | null
          payer_type: string
          scenario_template: Json
          slug: string
          transport_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          destination_modifier?: string | null
          enabled?: boolean
          expected_hcpcs?: string | null
          expected_modifiers?: string[] | null
          id?: string
          name?: string
          notes?: string | null
          origin_modifier?: string | null
          payer_type?: string
          scenario_template?: Json
          slug?: string
          transport_type?: string
          updated_at?: string
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
          company_id: string
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
          company_id: string
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
          company_id?: string
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
      patient_schedule_overrides: {
        Row: {
          chair_time: string | null
          company_id: string
          created_at: string
          duration_hours: number | null
          duration_minutes: number | null
          id: string
          patient_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          chair_time?: string | null
          company_id: string
          created_at?: string
          duration_hours?: number | null
          duration_minutes?: number | null
          id?: string
          patient_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          chair_time?: string | null
          company_id?: string
          created_at?: string
          duration_hours?: number | null
          duration_minutes?: number | null
          id?: string
          patient_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "patient_schedule_overrides_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_schedule_overrides_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          a_leg_pickup_time: string | null
          auth_expiration: string | null
          auth_required: boolean | null
          bariatric: boolean | null
          chair_time: string | null
          chair_time_duration_hours: number | null
          chair_time_duration_minutes: number | null
          company_id: string
          created_at: string
          default_bed_confined: boolean | null
          default_bh_authorization_type: string | null
          default_bh_authorizing_facility: string | null
          default_bh_authorizing_physician_name: string | null
          default_bh_authorizing_physician_npi: string | null
          default_cannot_transfer: boolean | null
          default_chief_complaint: string | null
          default_medical_necessity_reason: string | null
          default_oxygen_transport: boolean | null
          default_primary_impression: string | null
          default_requires_monitoring: boolean | null
          default_wound_location: string | null
          default_wound_stage: string | null
          default_wound_type: string | null
          dialysis_window_minutes: number
          dob: string | null
          dropoff_facility: string | null
          facility_id: string | null
          first_name: string
          icd10_codes: string[] | null
          id: string
          is_simulated: boolean
          is_template: boolean
          last_name: string
          location_type: string | null
          member_id: string | null
          mobility: string | null
          must_arrive_by: string | null
          notes: string | null
          oxygen_lpm: number | null
          oxygen_required: boolean | null
          pcs_expiration_date: string | null
          pcs_on_file: boolean | null
          pcs_signed_date: string | null
          phone: string | null
          pickup_address: string | null
          primary_payer: string | null
          prior_auth_expiration: string | null
          prior_auth_number: string | null
          prior_auth_on_file: boolean | null
          recurrence_days: number[] | null
          recurrence_end_date: string | null
          recurrence_start_date: string | null
          run_duration_minutes: number | null
          schedule_days: Database["public"]["Enums"]["schedule_days"] | null
          secondary_group_number: string | null
          secondary_member_id: string | null
          secondary_payer: string | null
          secondary_payer_id: string | null
          secondary_payer_phone: string | null
          sex: string | null
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
          a_leg_pickup_time?: string | null
          auth_expiration?: string | null
          auth_required?: boolean | null
          bariatric?: boolean | null
          chair_time?: string | null
          chair_time_duration_hours?: number | null
          chair_time_duration_minutes?: number | null
          company_id: string
          created_at?: string
          default_bed_confined?: boolean | null
          default_bh_authorization_type?: string | null
          default_bh_authorizing_facility?: string | null
          default_bh_authorizing_physician_name?: string | null
          default_bh_authorizing_physician_npi?: string | null
          default_cannot_transfer?: boolean | null
          default_chief_complaint?: string | null
          default_medical_necessity_reason?: string | null
          default_oxygen_transport?: boolean | null
          default_primary_impression?: string | null
          default_requires_monitoring?: boolean | null
          default_wound_location?: string | null
          default_wound_stage?: string | null
          default_wound_type?: string | null
          dialysis_window_minutes?: number
          dob?: string | null
          dropoff_facility?: string | null
          facility_id?: string | null
          first_name: string
          icd10_codes?: string[] | null
          id?: string
          is_simulated?: boolean
          is_template?: boolean
          last_name: string
          location_type?: string | null
          member_id?: string | null
          mobility?: string | null
          must_arrive_by?: string | null
          notes?: string | null
          oxygen_lpm?: number | null
          oxygen_required?: boolean | null
          pcs_expiration_date?: string | null
          pcs_on_file?: boolean | null
          pcs_signed_date?: string | null
          phone?: string | null
          pickup_address?: string | null
          primary_payer?: string | null
          prior_auth_expiration?: string | null
          prior_auth_number?: string | null
          prior_auth_on_file?: boolean | null
          recurrence_days?: number[] | null
          recurrence_end_date?: string | null
          recurrence_start_date?: string | null
          run_duration_minutes?: number | null
          schedule_days?: Database["public"]["Enums"]["schedule_days"] | null
          secondary_group_number?: string | null
          secondary_member_id?: string | null
          secondary_payer?: string | null
          secondary_payer_id?: string | null
          secondary_payer_phone?: string | null
          sex?: string | null
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
          a_leg_pickup_time?: string | null
          auth_expiration?: string | null
          auth_required?: boolean | null
          bariatric?: boolean | null
          chair_time?: string | null
          chair_time_duration_hours?: number | null
          chair_time_duration_minutes?: number | null
          company_id?: string
          created_at?: string
          default_bed_confined?: boolean | null
          default_bh_authorization_type?: string | null
          default_bh_authorizing_facility?: string | null
          default_bh_authorizing_physician_name?: string | null
          default_bh_authorizing_physician_npi?: string | null
          default_cannot_transfer?: boolean | null
          default_chief_complaint?: string | null
          default_medical_necessity_reason?: string | null
          default_oxygen_transport?: boolean | null
          default_primary_impression?: string | null
          default_requires_monitoring?: boolean | null
          default_wound_location?: string | null
          default_wound_stage?: string | null
          default_wound_type?: string | null
          dialysis_window_minutes?: number
          dob?: string | null
          dropoff_facility?: string | null
          facility_id?: string | null
          first_name?: string
          icd10_codes?: string[] | null
          id?: string
          is_simulated?: boolean
          is_template?: boolean
          last_name?: string
          location_type?: string | null
          member_id?: string | null
          mobility?: string | null
          must_arrive_by?: string | null
          notes?: string | null
          oxygen_lpm?: number | null
          oxygen_required?: boolean | null
          pcs_expiration_date?: string | null
          pcs_on_file?: boolean | null
          pcs_signed_date?: string | null
          phone?: string | null
          pickup_address?: string | null
          primary_payer?: string | null
          prior_auth_expiration?: string | null
          prior_auth_number?: string | null
          prior_auth_on_file?: boolean | null
          recurrence_days?: number[] | null
          recurrence_end_date?: string | null
          recurrence_start_date?: string | null
          run_duration_minutes?: number | null
          schedule_days?: Database["public"]["Enums"]["schedule_days"] | null
          secondary_group_number?: string | null
          secondary_member_id?: string | null
          secondary_payer?: string | null
          secondary_payer_id?: string | null
          secondary_payer_phone?: string | null
          sex?: string | null
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
          {
            foreignKeyName: "patients_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      payer_billing_rules: {
        Row: {
          company_id: string
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
          company_id: string
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
          company_id?: string
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
      payer_directory: {
        Row: {
          claims_address: string | null
          company_id: string
          created_at: string
          fax_number: string | null
          id: string
          notes: string | null
          payer_name: string
          payer_type: string | null
          phone_number: string | null
          portal_url: string | null
          timely_filing_days: number | null
          updated_at: string
        }
        Insert: {
          claims_address?: string | null
          company_id: string
          created_at?: string
          fax_number?: string | null
          id?: string
          notes?: string | null
          payer_name: string
          payer_type?: string | null
          phone_number?: string | null
          portal_url?: string | null
          timely_filing_days?: number | null
          updated_at?: string
        }
        Update: {
          claims_address?: string | null
          company_id?: string
          created_at?: string
          fax_number?: string | null
          id?: string
          notes?: string | null
          payer_name?: string
          payer_type?: string | null
          phone_number?: string | null
          portal_url?: string | null
          timely_filing_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payer_directory_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      plb_adjustments: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          fiscal_period: string | null
          id: string
          provider_npi: string | null
          reason_code: string
          reference_id: string | null
          remittance_file_id: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          fiscal_period?: string | null
          id?: string
          provider_npi?: string | null
          reason_code: string
          reference_id?: string | null
          remittance_file_id: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          fiscal_period?: string | null
          id?: string
          provider_npi?: string | null
          reason_code?: string
          reference_id?: string | null
          remittance_file_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plb_adjustments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plb_adjustments_remittance_file_id_fkey"
            columns: ["remittance_file_id"]
            isOneToOne: false
            referencedRelation: "remittance_files"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          active_company_id: string | null
          bariatric_trained: boolean
          cert_level: Database["public"]["Enums"]["cert_level"]
          company_id: string | null
          created_at: string
          email: string | null
          employment_type: string
          full_name: string
          id: string
          invitation_status: Database["public"]["Enums"]["invitation_status"]
          is_simulated: boolean
          lift_assist_ok: boolean
          max_safe_team_lift_lbs: number
          oxygen_handling_trained: boolean
          pending_role: Database["public"]["Enums"]["membership_role"] | null
          phone_number: string | null
          sex: Database["public"]["Enums"]["sex_type"]
          simulation_run_id: string | null
          stair_chair_trained: boolean
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          active_company_id?: string | null
          bariatric_trained?: boolean
          cert_level?: Database["public"]["Enums"]["cert_level"]
          company_id?: string | null
          created_at?: string
          email?: string | null
          employment_type?: string
          full_name: string
          id?: string
          invitation_status?: Database["public"]["Enums"]["invitation_status"]
          is_simulated?: boolean
          lift_assist_ok?: boolean
          max_safe_team_lift_lbs?: number
          oxygen_handling_trained?: boolean
          pending_role?: Database["public"]["Enums"]["membership_role"] | null
          phone_number?: string | null
          sex?: Database["public"]["Enums"]["sex_type"]
          simulation_run_id?: string | null
          stair_chair_trained?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          active_company_id?: string | null
          bariatric_trained?: boolean
          cert_level?: Database["public"]["Enums"]["cert_level"]
          company_id?: string | null
          created_at?: string
          email?: string | null
          employment_type?: string
          full_name?: string
          id?: string
          invitation_status?: Database["public"]["Enums"]["invitation_status"]
          is_simulated?: boolean
          lift_assist_ok?: boolean
          max_safe_team_lift_lbs?: number
          oxygen_handling_trained?: boolean
          pending_role?: Database["public"]["Enums"]["membership_role"] | null
          phone_number?: string | null
          sex?: Database["public"]["Enums"]["sex_type"]
          simulation_run_id?: string | null
          stair_chair_trained?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_company_id_fkey"
            columns: ["active_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          company_id: string
          created_at: string
          flag_reason: string
          flag_type: string | null
          id: string
          qa_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          status: string
          trip_id: string | null
        }
        Insert: {
          claim_id?: string | null
          company_id: string
          created_at?: string
          flag_reason: string
          flag_type?: string | null
          id?: string
          qa_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          trip_id?: string | null
        }
        Update: {
          claim_id?: string | null
          company_id?: string
          created_at?: string
          flag_reason?: string
          flag_type?: string | null
          id?: string
          qa_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
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
      remittance_files: {
        Row: {
          bpr_total_paid: number | null
          claims_matched: number
          claims_updated: number
          company_id: string
          eft_trace_number: string | null
          file_content: string
          file_identifier: string | null
          file_name: string
          id: string
          imported_at: string
          imported_by: string | null
          payer_name: string | null
          payment_date: string | null
          reconciled: boolean
          reconciliation_variance: number
          status: string
          total_paid: number
        }
        Insert: {
          bpr_total_paid?: number | null
          claims_matched?: number
          claims_updated?: number
          company_id: string
          eft_trace_number?: string | null
          file_content: string
          file_identifier?: string | null
          file_name: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          payer_name?: string | null
          payment_date?: string | null
          reconciled?: boolean
          reconciliation_variance?: number
          status?: string
          total_paid?: number
        }
        Update: {
          bpr_total_paid?: number | null
          claims_matched?: number
          claims_updated?: number
          company_id?: string
          eft_trace_number?: string | null
          file_content?: string
          file_identifier?: string | null
          file_name?: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          payer_name?: string | null
          payment_date?: string | null
          reconciled?: boolean
          reconciliation_variance?: number
          status?: string
          total_paid?: number
        }
        Relationships: [
          {
            foreignKeyName: "remittance_files_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      remittance_quarantine: {
        Row: {
          billing_npi_in_file: string | null
          claim_status_code: string | null
          created_at: string
          expected_billing_npi: string | null
          file_name: string | null
          file_type: string
          id: string
          importing_company_id: string | null
          matched_company_id: string | null
          paid_amount: number | null
          patient_control_number: string | null
          patient_responsibility: number | null
          payer_claim_control_number: string | null
          posted_to_claim_id: string | null
          quarantine_reason: string
          raw_clp_segment: string | null
          remittance_file_id: string | null
          resolution_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          billing_npi_in_file?: string | null
          claim_status_code?: string | null
          created_at?: string
          expected_billing_npi?: string | null
          file_name?: string | null
          file_type?: string
          id?: string
          importing_company_id?: string | null
          matched_company_id?: string | null
          paid_amount?: number | null
          patient_control_number?: string | null
          patient_responsibility?: number | null
          payer_claim_control_number?: string | null
          posted_to_claim_id?: string | null
          quarantine_reason: string
          raw_clp_segment?: string | null
          remittance_file_id?: string | null
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          billing_npi_in_file?: string | null
          claim_status_code?: string | null
          created_at?: string
          expected_billing_npi?: string | null
          file_name?: string | null
          file_type?: string
          id?: string
          importing_company_id?: string | null
          matched_company_id?: string | null
          paid_amount?: number | null
          patient_control_number?: string | null
          patient_responsibility?: number | null
          payer_claim_control_number?: string | null
          posted_to_claim_id?: string | null
          quarantine_reason?: string
          raw_clp_segment?: string | null
          remittance_file_id?: string | null
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "remittance_quarantine_importing_company_id_fkey"
            columns: ["importing_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remittance_quarantine_matched_company_id_fkey"
            columns: ["matched_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remittance_quarantine_posted_to_claim_id_fkey"
            columns: ["posted_to_claim_id"]
            isOneToOne: false
            referencedRelation: "claim_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remittance_quarantine_remittance_file_id_fkey"
            columns: ["remittance_file_id"]
            isOneToOne: false
            referencedRelation: "remittance_files"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          company_id: string
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
          company_id: string
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
          company_id?: string
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
          company_id: string
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
          company_id: string
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
          company_id?: string
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
      schedule_change_log: {
        Row: {
          change_summary: string
          change_type: string
          changed_by: string
          company_id: string
          created_at: string
          id: string
          leg_id: string | null
          new_value: string | null
          notified_at: string | null
          old_value: string | null
          truck_id: string | null
        }
        Insert: {
          change_summary: string
          change_type: string
          changed_by: string
          company_id: string
          created_at?: string
          id?: string
          leg_id?: string | null
          new_value?: string | null
          notified_at?: string | null
          old_value?: string | null
          truck_id?: string | null
        }
        Update: {
          change_summary?: string
          change_type?: string
          changed_by?: string
          company_id?: string
          created_at?: string
          id?: string
          leg_id?: string | null
          new_value?: string | null
          notified_at?: string | null
          old_value?: string | null
          truck_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_change_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_change_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_change_log_leg_id_fkey"
            columns: ["leg_id"]
            isOneToOne: false
            referencedRelation: "scheduling_legs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_change_log_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_previews: {
        Row: {
          company_id: string
          id: string
          message: string
          preview_date: string
          sent_at: string
          sent_by: string
          target_user_id: string
        }
        Insert: {
          company_id: string
          id?: string
          message: string
          preview_date: string
          sent_at?: string
          sent_by: string
          target_user_id: string
        }
        Update: {
          company_id?: string
          id?: string
          message?: string
          preview_date?: string
          sent_at?: string
          sent_by?: string
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_previews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduling_legs: {
        Row: {
          chair_time: string | null
          company_id: string
          created_at: string
          destination_location: string
          destination_type: string | null
          estimated_duration_minutes: number | null
          id: string
          is_oneoff: boolean
          is_simulated: boolean
          is_unscheduled: boolean | null
          leg_type: Database["public"]["Enums"]["leg_type"]
          notes: string | null
          oneoff_bh_1013_received: boolean | null
          oneoff_bh_authorization_type: string | null
          oneoff_bh_authorizing_facility: string | null
          oneoff_bh_authorizing_physician_name: string | null
          oneoff_discharge_reason: string | null
          oneoff_dob: string | null
          oneoff_dropoff_address: string | null
          oneoff_law_enforcement_present: boolean | null
          oneoff_member_id: string | null
          oneoff_mobility: string | null
          oneoff_name: string | null
          oneoff_notes: string | null
          oneoff_oxygen: boolean | null
          oneoff_pcs_obtained: boolean | null
          oneoff_pickup_address: string | null
          oneoff_primary_payer: string | null
          oneoff_sending_facility_name: string | null
          oneoff_sending_physician_name: string | null
          oneoff_sending_physician_npi: string | null
          oneoff_sex: string | null
          oneoff_weight_lbs: number | null
          oneoff_wound_location: string | null
          oneoff_wound_stage: string | null
          oneoff_wound_type: string | null
          origin_type: string | null
          patient_id: string | null
          pickup_location: string
          pickup_time: string | null
          run_date: string
          service_level: string | null
          simulation_run_id: string | null
          trip_type: Database["public"]["Enums"]["trip_type"]
          updated_at: string
        }
        Insert: {
          chair_time?: string | null
          company_id: string
          created_at?: string
          destination_location: string
          destination_type?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          is_oneoff?: boolean
          is_simulated?: boolean
          is_unscheduled?: boolean | null
          leg_type: Database["public"]["Enums"]["leg_type"]
          notes?: string | null
          oneoff_bh_1013_received?: boolean | null
          oneoff_bh_authorization_type?: string | null
          oneoff_bh_authorizing_facility?: string | null
          oneoff_bh_authorizing_physician_name?: string | null
          oneoff_discharge_reason?: string | null
          oneoff_dob?: string | null
          oneoff_dropoff_address?: string | null
          oneoff_law_enforcement_present?: boolean | null
          oneoff_member_id?: string | null
          oneoff_mobility?: string | null
          oneoff_name?: string | null
          oneoff_notes?: string | null
          oneoff_oxygen?: boolean | null
          oneoff_pcs_obtained?: boolean | null
          oneoff_pickup_address?: string | null
          oneoff_primary_payer?: string | null
          oneoff_sending_facility_name?: string | null
          oneoff_sending_physician_name?: string | null
          oneoff_sending_physician_npi?: string | null
          oneoff_sex?: string | null
          oneoff_weight_lbs?: number | null
          oneoff_wound_location?: string | null
          oneoff_wound_stage?: string | null
          oneoff_wound_type?: string | null
          origin_type?: string | null
          patient_id?: string | null
          pickup_location: string
          pickup_time?: string | null
          run_date?: string
          service_level?: string | null
          simulation_run_id?: string | null
          trip_type?: Database["public"]["Enums"]["trip_type"]
          updated_at?: string
        }
        Update: {
          chair_time?: string | null
          company_id?: string
          created_at?: string
          destination_location?: string
          destination_type?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          is_oneoff?: boolean
          is_simulated?: boolean
          is_unscheduled?: boolean | null
          leg_type?: Database["public"]["Enums"]["leg_type"]
          notes?: string | null
          oneoff_bh_1013_received?: boolean | null
          oneoff_bh_authorization_type?: string | null
          oneoff_bh_authorizing_facility?: string | null
          oneoff_bh_authorizing_physician_name?: string | null
          oneoff_discharge_reason?: string | null
          oneoff_dob?: string | null
          oneoff_dropoff_address?: string | null
          oneoff_law_enforcement_present?: boolean | null
          oneoff_member_id?: string | null
          oneoff_mobility?: string | null
          oneoff_name?: string | null
          oneoff_notes?: string | null
          oneoff_oxygen?: boolean | null
          oneoff_pcs_obtained?: boolean | null
          oneoff_pickup_address?: string | null
          oneoff_primary_payer?: string | null
          oneoff_sending_facility_name?: string | null
          oneoff_sending_physician_name?: string | null
          oneoff_sending_physician_npi?: string | null
          oneoff_sex?: string | null
          oneoff_weight_lbs?: number | null
          oneoff_wound_location?: string | null
          oneoff_wound_stage?: string | null
          oneoff_wound_type?: string | null
          origin_type?: string | null
          patient_id?: string | null
          pickup_location?: string
          pickup_time?: string | null
          run_date?: string
          service_level?: string | null
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
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string
          trial_ends_at: string | null
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
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
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
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
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
      subscription_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          company_id: string
          id: string
          monthly_amount_cents: number | null
          new_status: string
          old_status: string | null
          subscription_record_id: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          company_id: string
          id?: string
          monthly_amount_cents?: number | null
          new_status: string
          old_status?: string | null
          subscription_record_id?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          company_id?: string
          id?: string
          monthly_amount_cents?: number | null
          new_status?: string
          old_status?: string | null
          subscription_record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_status_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string | null
          client_context: Json | null
          company_id: string
          created_at: string
          creator_notes: string | null
          id: string
          page_path: string | null
          resolved_at: string | null
          severity: string
          status: string
          subject: string | null
          ticket_number: string | null
          trying_to_do: string | null
          updated_at: string
          user_id: string
          what_happened: string | null
        }
        Insert: {
          category?: string | null
          client_context?: Json | null
          company_id: string
          created_at?: string
          creator_notes?: string | null
          id?: string
          page_path?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          subject?: string | null
          ticket_number?: string | null
          trying_to_do?: string | null
          updated_at?: string
          user_id: string
          what_happened?: string | null
        }
        Update: {
          category?: string | null
          client_context?: Json | null
          company_id?: string
          created_at?: string
          creator_notes?: string | null
          id?: string
          page_path?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          subject?: string | null
          ticket_number?: string | null
          trying_to_do?: string | null
          updated_at?: string
          user_id?: string
          what_happened?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      system_creators: {
        Row: {
          created_at: string
          id: string
          recovery_configured_at: string | null
          recovery_passphrase_hash: string | null
          recovery_slug_hash: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          recovery_configured_at?: string | null
          recovery_passphrase_hash?: string | null
          recovery_slug_hash?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          recovery_configured_at?: string | null
          recovery_passphrase_hash?: string | null
          recovery_slug_hash?: string | null
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
            foreignKeyName: "trip_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          actual_arrival_at: string | null
          company_id: string
          confidence: number
          late_probability: number
          late_root_cause: string | null
          on_time_status: string
          projected_complete_at: string | null
          projected_next_arrival_at: string | null
          reason_codes: string[]
          risk_color: string
          scheduled_pickup_time: string | null
          simulation_run_id: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          actual_arrival_at?: string | null
          company_id: string
          confidence?: number
          late_probability?: number
          late_root_cause?: string | null
          on_time_status?: string
          projected_complete_at?: string | null
          projected_next_arrival_at?: string | null
          reason_codes?: string[]
          risk_color?: string
          scheduled_pickup_time?: string | null
          simulation_run_id?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          actual_arrival_at?: string | null
          company_id?: string
          confidence?: number
          late_probability?: number
          late_root_cause?: string | null
          on_time_status?: string
          projected_complete_at?: string | null
          projected_next_arrival_at?: string | null
          reason_codes?: string[]
          risk_color?: string
          scheduled_pickup_time?: string | null
          simulation_run_id?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_projection_state_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          aed_used: boolean | null
          airway_json: Json | null
          arrived_dropoff_at: string | null
          arrived_pickup_at: string | null
          assessment_json: Json | null
          at_scene_time: string | null
          attending_medic_cert: string | null
          attending_medic_id: string | null
          attending_medic_name: string | null
          bed_confined: boolean | null
          bh_1013_received: boolean | null
          bh_authorization_type: string | null
          bh_authorizing_facility: string | null
          bh_authorizing_physician_name: string | null
          bh_authorizing_physician_npi: string | null
          bh_behavioral_assessment: string[] | null
          bh_form_signed_at: string | null
          bh_law_enforcement_present: boolean | null
          bh_neurovascular_check_times: string | null
          bh_neurovascular_checks_documented: boolean | null
          bh_officer_agency: string | null
          bh_officer_badge: string | null
          bh_officer_name: string | null
          bh_patient_response_to_restraints: string | null
          bh_psych_medications: string | null
          bh_receiving_clinician: string | null
          bh_receiving_facility: string | null
          bh_recent_medication_changes: boolean | null
          bh_recent_medication_changes_detail: string | null
          bh_report_given_to: string | null
          bh_report_time: string | null
          bh_restraint_applied_at: string | null
          bh_restraint_reason: string | null
          bh_restraint_type: string | null
          billing_blocked_reason: string | null
          blockers: string[] | null
          blood_pressure: string | null
          cancellation_dispatcher_note: string | null
          cancellation_disputed: boolean | null
          cancellation_documentation: Json | null
          cancellation_reason: string | null
          cancellation_source: string | null
          cancellation_verified_at: string | null
          cancellation_verified_by: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cannot_transfer_safely: boolean | null
          chief_complaint: string | null
          claim_creation_status: string | null
          claim_ready: boolean | null
          clinical_note: string | null
          company_id: string
          condition_at_destination: string | null
          condition_on_arrival: Json | null
          created_at: string
          crew_id: string | null
          crew_ids: string[] | null
          crew_names: string | null
          crew_updated_fields: Json | null
          destination_location: string | null
          destination_type: string | null
          discharge_instructions_received: boolean | null
          dispatch_time: string | null
          disposition: string | null
          documentation_complete: boolean | null
          dropped_at: string | null
          emergency_billing_override: string | null
          emergency_billing_recommendation: string | null
          emergency_billing_reviewed_at: string | null
          emergency_billing_reviewed_by: string | null
          emergency_pcr_trip_id: string | null
          emergency_upgrade_at: string | null
          emergency_upgrade_resolution: string | null
          emergency_upgrade_resolved_at: string | null
          emergency_upgrade_voided: boolean
          emergency_upgrade_voided_at: string | null
          emergency_upgrade_voided_by: string | null
          equipment_used_json: Json | null
          esrd_dialysis: boolean | null
          expected_revenue: number | null
          fall_risk: boolean | null
          general_weakness: boolean | null
          handoff_accepted_at: string | null
          handoff_initiated_at: string | null
          handoff_status: string | null
          handoff_target_crew_id: string | null
          handoff_target_truck_id: string | null
          hcpcs_codes: string[] | null
          hcpcs_modifiers: string[] | null
          heart_rate: number | null
          hospital_outcome_json: Json | null
          icd10_codes: string[] | null
          id: string
          in_service_time: string | null
          is_emergency_pcr: boolean
          is_simulated: boolean
          is_unscheduled: boolean | null
          isolation_precautions: Json | null
          iv_access_json: Json | null
          kickback_note: string | null
          kickback_reasons: Json | null
          kicked_back_at: string | null
          kicked_back_by: string | null
          left_scene_time: string | null
          leg_id: string | null
          level_of_consciousness: string | null
          loaded_at: string | null
          loaded_miles: number | null
          medical_necessity_reason: string | null
          medications_json: Json | null
          member_id: string | null
          mobility_method: string | null
          mobility_override: string | null
          narrative: string | null
          necessity_notes: string | null
          odometer_at_destination: number | null
          odometer_at_scene: number | null
          odometer_in_service: number | null
          origin_type: string | null
          original_crew_id: string | null
          original_trip_id: string | null
          oxygen_during_transport: boolean | null
          oxygen_required: boolean | null
          oxygen_saturation: number | null
          patient_contact_time: string | null
          patient_dob_override: string | null
          patient_id: string | null
          patient_mobility: string | null
          patient_name_override: string | null
          patient_position: string | null
          patient_sex_override: string | null
          pcr_completed_at: string | null
          pcr_status: string
          pcr_submitted_by: string | null
          pcr_type: string | null
          pcs_attached: boolean | null
          physical_exam_json: Json | null
          pickup_location: string | null
          pre_handoff_signatures_snapshot: Json | null
          primary_impression: string | null
          primary_payer: string | null
          procedures_json: Json | null
          requires_monitoring: boolean | null
          respiration_rate: number | null
          restraints_applied: boolean | null
          revenue_risk_score: number | null
          run_date: string
          scheduled_dropoff_time: string | null
          scheduled_pickup_time: string | null
          secondary_impressions: Json | null
          sending_facility_json: Json | null
          service_level: string | null
          signature_obtained: boolean | null
          signatures_json: Json | null
          simulation_run_id: string | null
          skin_condition: string | null
          slot_id: string | null
          status: Database["public"]["Enums"]["trip_status"]
          stretcher_placement: string | null
          stretcher_required: boolean | null
          transport_condition: string | null
          trip_type: Database["public"]["Enums"]["trip_type"] | null
          truck_id: string | null
          updated_at: string
          updated_by: string | null
          vehicle_id: string | null
          vitals_json: Json | null
          vitals_taken_at: string | null
          wait_time_minutes: number | null
          weight_lbs: number | null
          wound_location: string | null
          wound_size: string | null
          wound_stage: string | null
          wound_type: string | null
        }
        Insert: {
          aed_used?: boolean | null
          airway_json?: Json | null
          arrived_dropoff_at?: string | null
          arrived_pickup_at?: string | null
          assessment_json?: Json | null
          at_scene_time?: string | null
          attending_medic_cert?: string | null
          attending_medic_id?: string | null
          attending_medic_name?: string | null
          bed_confined?: boolean | null
          bh_1013_received?: boolean | null
          bh_authorization_type?: string | null
          bh_authorizing_facility?: string | null
          bh_authorizing_physician_name?: string | null
          bh_authorizing_physician_npi?: string | null
          bh_behavioral_assessment?: string[] | null
          bh_form_signed_at?: string | null
          bh_law_enforcement_present?: boolean | null
          bh_neurovascular_check_times?: string | null
          bh_neurovascular_checks_documented?: boolean | null
          bh_officer_agency?: string | null
          bh_officer_badge?: string | null
          bh_officer_name?: string | null
          bh_patient_response_to_restraints?: string | null
          bh_psych_medications?: string | null
          bh_receiving_clinician?: string | null
          bh_receiving_facility?: string | null
          bh_recent_medication_changes?: boolean | null
          bh_recent_medication_changes_detail?: string | null
          bh_report_given_to?: string | null
          bh_report_time?: string | null
          bh_restraint_applied_at?: string | null
          bh_restraint_reason?: string | null
          bh_restraint_type?: string | null
          billing_blocked_reason?: string | null
          blockers?: string[] | null
          blood_pressure?: string | null
          cancellation_dispatcher_note?: string | null
          cancellation_disputed?: boolean | null
          cancellation_documentation?: Json | null
          cancellation_reason?: string | null
          cancellation_source?: string | null
          cancellation_verified_at?: string | null
          cancellation_verified_by?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cannot_transfer_safely?: boolean | null
          chief_complaint?: string | null
          claim_creation_status?: string | null
          claim_ready?: boolean | null
          clinical_note?: string | null
          company_id: string
          condition_at_destination?: string | null
          condition_on_arrival?: Json | null
          created_at?: string
          crew_id?: string | null
          crew_ids?: string[] | null
          crew_names?: string | null
          crew_updated_fields?: Json | null
          destination_location?: string | null
          destination_type?: string | null
          discharge_instructions_received?: boolean | null
          dispatch_time?: string | null
          disposition?: string | null
          documentation_complete?: boolean | null
          dropped_at?: string | null
          emergency_billing_override?: string | null
          emergency_billing_recommendation?: string | null
          emergency_billing_reviewed_at?: string | null
          emergency_billing_reviewed_by?: string | null
          emergency_pcr_trip_id?: string | null
          emergency_upgrade_at?: string | null
          emergency_upgrade_resolution?: string | null
          emergency_upgrade_resolved_at?: string | null
          emergency_upgrade_voided?: boolean
          emergency_upgrade_voided_at?: string | null
          emergency_upgrade_voided_by?: string | null
          equipment_used_json?: Json | null
          esrd_dialysis?: boolean | null
          expected_revenue?: number | null
          fall_risk?: boolean | null
          general_weakness?: boolean | null
          handoff_accepted_at?: string | null
          handoff_initiated_at?: string | null
          handoff_status?: string | null
          handoff_target_crew_id?: string | null
          handoff_target_truck_id?: string | null
          hcpcs_codes?: string[] | null
          hcpcs_modifiers?: string[] | null
          heart_rate?: number | null
          hospital_outcome_json?: Json | null
          icd10_codes?: string[] | null
          id?: string
          in_service_time?: string | null
          is_emergency_pcr?: boolean
          is_simulated?: boolean
          is_unscheduled?: boolean | null
          isolation_precautions?: Json | null
          iv_access_json?: Json | null
          kickback_note?: string | null
          kickback_reasons?: Json | null
          kicked_back_at?: string | null
          kicked_back_by?: string | null
          left_scene_time?: string | null
          leg_id?: string | null
          level_of_consciousness?: string | null
          loaded_at?: string | null
          loaded_miles?: number | null
          medical_necessity_reason?: string | null
          medications_json?: Json | null
          member_id?: string | null
          mobility_method?: string | null
          mobility_override?: string | null
          narrative?: string | null
          necessity_notes?: string | null
          odometer_at_destination?: number | null
          odometer_at_scene?: number | null
          odometer_in_service?: number | null
          origin_type?: string | null
          original_crew_id?: string | null
          original_trip_id?: string | null
          oxygen_during_transport?: boolean | null
          oxygen_required?: boolean | null
          oxygen_saturation?: number | null
          patient_contact_time?: string | null
          patient_dob_override?: string | null
          patient_id?: string | null
          patient_mobility?: string | null
          patient_name_override?: string | null
          patient_position?: string | null
          patient_sex_override?: string | null
          pcr_completed_at?: string | null
          pcr_status?: string
          pcr_submitted_by?: string | null
          pcr_type?: string | null
          pcs_attached?: boolean | null
          physical_exam_json?: Json | null
          pickup_location?: string | null
          pre_handoff_signatures_snapshot?: Json | null
          primary_impression?: string | null
          primary_payer?: string | null
          procedures_json?: Json | null
          requires_monitoring?: boolean | null
          respiration_rate?: number | null
          restraints_applied?: boolean | null
          revenue_risk_score?: number | null
          run_date?: string
          scheduled_dropoff_time?: string | null
          scheduled_pickup_time?: string | null
          secondary_impressions?: Json | null
          sending_facility_json?: Json | null
          service_level?: string | null
          signature_obtained?: boolean | null
          signatures_json?: Json | null
          simulation_run_id?: string | null
          skin_condition?: string | null
          slot_id?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          stretcher_placement?: string | null
          stretcher_required?: boolean | null
          transport_condition?: string | null
          trip_type?: Database["public"]["Enums"]["trip_type"] | null
          truck_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
          vitals_json?: Json | null
          vitals_taken_at?: string | null
          wait_time_minutes?: number | null
          weight_lbs?: number | null
          wound_location?: string | null
          wound_size?: string | null
          wound_stage?: string | null
          wound_type?: string | null
        }
        Update: {
          aed_used?: boolean | null
          airway_json?: Json | null
          arrived_dropoff_at?: string | null
          arrived_pickup_at?: string | null
          assessment_json?: Json | null
          at_scene_time?: string | null
          attending_medic_cert?: string | null
          attending_medic_id?: string | null
          attending_medic_name?: string | null
          bed_confined?: boolean | null
          bh_1013_received?: boolean | null
          bh_authorization_type?: string | null
          bh_authorizing_facility?: string | null
          bh_authorizing_physician_name?: string | null
          bh_authorizing_physician_npi?: string | null
          bh_behavioral_assessment?: string[] | null
          bh_form_signed_at?: string | null
          bh_law_enforcement_present?: boolean | null
          bh_neurovascular_check_times?: string | null
          bh_neurovascular_checks_documented?: boolean | null
          bh_officer_agency?: string | null
          bh_officer_badge?: string | null
          bh_officer_name?: string | null
          bh_patient_response_to_restraints?: string | null
          bh_psych_medications?: string | null
          bh_receiving_clinician?: string | null
          bh_receiving_facility?: string | null
          bh_recent_medication_changes?: boolean | null
          bh_recent_medication_changes_detail?: string | null
          bh_report_given_to?: string | null
          bh_report_time?: string | null
          bh_restraint_applied_at?: string | null
          bh_restraint_reason?: string | null
          bh_restraint_type?: string | null
          billing_blocked_reason?: string | null
          blockers?: string[] | null
          blood_pressure?: string | null
          cancellation_dispatcher_note?: string | null
          cancellation_disputed?: boolean | null
          cancellation_documentation?: Json | null
          cancellation_reason?: string | null
          cancellation_source?: string | null
          cancellation_verified_at?: string | null
          cancellation_verified_by?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cannot_transfer_safely?: boolean | null
          chief_complaint?: string | null
          claim_creation_status?: string | null
          claim_ready?: boolean | null
          clinical_note?: string | null
          company_id?: string
          condition_at_destination?: string | null
          condition_on_arrival?: Json | null
          created_at?: string
          crew_id?: string | null
          crew_ids?: string[] | null
          crew_names?: string | null
          crew_updated_fields?: Json | null
          destination_location?: string | null
          destination_type?: string | null
          discharge_instructions_received?: boolean | null
          dispatch_time?: string | null
          disposition?: string | null
          documentation_complete?: boolean | null
          dropped_at?: string | null
          emergency_billing_override?: string | null
          emergency_billing_recommendation?: string | null
          emergency_billing_reviewed_at?: string | null
          emergency_billing_reviewed_by?: string | null
          emergency_pcr_trip_id?: string | null
          emergency_upgrade_at?: string | null
          emergency_upgrade_resolution?: string | null
          emergency_upgrade_resolved_at?: string | null
          emergency_upgrade_voided?: boolean
          emergency_upgrade_voided_at?: string | null
          emergency_upgrade_voided_by?: string | null
          equipment_used_json?: Json | null
          esrd_dialysis?: boolean | null
          expected_revenue?: number | null
          fall_risk?: boolean | null
          general_weakness?: boolean | null
          handoff_accepted_at?: string | null
          handoff_initiated_at?: string | null
          handoff_status?: string | null
          handoff_target_crew_id?: string | null
          handoff_target_truck_id?: string | null
          hcpcs_codes?: string[] | null
          hcpcs_modifiers?: string[] | null
          heart_rate?: number | null
          hospital_outcome_json?: Json | null
          icd10_codes?: string[] | null
          id?: string
          in_service_time?: string | null
          is_emergency_pcr?: boolean
          is_simulated?: boolean
          is_unscheduled?: boolean | null
          isolation_precautions?: Json | null
          iv_access_json?: Json | null
          kickback_note?: string | null
          kickback_reasons?: Json | null
          kicked_back_at?: string | null
          kicked_back_by?: string | null
          left_scene_time?: string | null
          leg_id?: string | null
          level_of_consciousness?: string | null
          loaded_at?: string | null
          loaded_miles?: number | null
          medical_necessity_reason?: string | null
          medications_json?: Json | null
          member_id?: string | null
          mobility_method?: string | null
          mobility_override?: string | null
          narrative?: string | null
          necessity_notes?: string | null
          odometer_at_destination?: number | null
          odometer_at_scene?: number | null
          odometer_in_service?: number | null
          origin_type?: string | null
          original_crew_id?: string | null
          original_trip_id?: string | null
          oxygen_during_transport?: boolean | null
          oxygen_required?: boolean | null
          oxygen_saturation?: number | null
          patient_contact_time?: string | null
          patient_dob_override?: string | null
          patient_id?: string | null
          patient_mobility?: string | null
          patient_name_override?: string | null
          patient_position?: string | null
          patient_sex_override?: string | null
          pcr_completed_at?: string | null
          pcr_status?: string
          pcr_submitted_by?: string | null
          pcr_type?: string | null
          pcs_attached?: boolean | null
          physical_exam_json?: Json | null
          pickup_location?: string | null
          pre_handoff_signatures_snapshot?: Json | null
          primary_impression?: string | null
          primary_payer?: string | null
          procedures_json?: Json | null
          requires_monitoring?: boolean | null
          respiration_rate?: number | null
          restraints_applied?: boolean | null
          revenue_risk_score?: number | null
          run_date?: string
          scheduled_dropoff_time?: string | null
          scheduled_pickup_time?: string | null
          secondary_impressions?: Json | null
          sending_facility_json?: Json | null
          service_level?: string | null
          signature_obtained?: boolean | null
          signatures_json?: Json | null
          simulation_run_id?: string | null
          skin_condition?: string | null
          slot_id?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          stretcher_placement?: string | null
          stretcher_required?: boolean | null
          transport_condition?: string | null
          trip_type?: Database["public"]["Enums"]["trip_type"] | null
          truck_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
          vitals_json?: Json | null
          vitals_taken_at?: string | null
          wait_time_minutes?: number | null
          weight_lbs?: number | null
          wound_location?: string | null
          wound_size?: string | null
          wound_stage?: string | null
          wound_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_records_attending_medic_id_fkey"
            columns: ["attending_medic_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "trip_records_emergency_pcr_trip_id_fkey"
            columns: ["emergency_pcr_trip_id"]
            isOneToOne: false
            referencedRelation: "trip_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_records_handoff_target_crew_id_fkey"
            columns: ["handoff_target_crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_records_handoff_target_truck_id_fkey"
            columns: ["handoff_target_truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
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
            foreignKeyName: "trip_records_original_crew_id_fkey"
            columns: ["original_crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_records_original_trip_id_fkey"
            columns: ["original_trip_id"]
            isOneToOne: false
            referencedRelation: "trip_records"
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
            foreignKeyName: "trip_records_pcr_submitted_by_fkey"
            columns: ["pcr_submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      trip_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          company_id: string
          id: string
          new_status: string
          notes: string | null
          old_status: string | null
          trip_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          company_id: string
          id?: string
          new_status: string
          notes?: string | null
          old_status?: string | null
          trip_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          company_id?: string
          id?: string
          new_status?: string
          notes?: string | null
          old_status?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_status_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      truck_availability: {
        Row: {
          company_id: string
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
          company_id: string
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
          company_id?: string
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
        Relationships: [
          {
            foreignKeyName: "truck_builder_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "truck_risk_state_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          company_id: string
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
          company_id: string
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
          company_id?: string
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
          company_id: string
          created_at: string
          has_bariatric_kit: boolean
          has_bariatric_stretcher: boolean
          has_oxygen_mount: boolean
          has_power_stretcher: boolean
          has_stair_chair: boolean
          id: string
          is_simulated: boolean
          name: string
          simulation_run_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          has_bariatric_kit?: boolean
          has_bariatric_stretcher?: boolean
          has_oxygen_mount?: boolean
          has_power_stretcher?: boolean
          has_stair_chair?: boolean
          id?: string
          is_simulated?: boolean
          name: string
          simulation_run_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          has_bariatric_kit?: boolean
          has_bariatric_stretcher?: boolean
          has_oxygen_mount?: boolean
          has_power_stretcher?: boolean
          has_stair_chair?: boolean
          id?: string
          is_simulated?: boolean
          name?: string
          simulation_run_id?: string | null
          vehicle_id?: string | null
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
      vehicle_inspection_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          acknowledged_by_name: string | null
          company_id: string
          created_at: string
          crew_note: string | null
          dispatcher_note: string | null
          dispatcher_response: string | null
          id: string
          inspection_id: string
          missing_item_key: string
          missing_item_label: string
          run_date: string
          truck_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          acknowledged_by_name?: string | null
          company_id: string
          created_at?: string
          crew_note?: string | null
          dispatcher_note?: string | null
          dispatcher_response?: string | null
          id?: string
          inspection_id: string
          missing_item_key: string
          missing_item_label: string
          run_date: string
          truck_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          acknowledged_by_name?: string | null
          company_id?: string
          created_at?: string
          crew_note?: string | null
          dispatcher_note?: string | null
          dispatcher_response?: string | null
          id?: string
          inspection_id?: string
          missing_item_key?: string
          missing_item_label?: string
          run_date?: string
          truck_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_inspection_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_inspection_alerts_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vehicle_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_inspection_alerts_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_inspection_templates: {
        Row: {
          company_id: string
          enabled_items: Json
          gate_enabled: boolean
          id: string
          truck_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          enabled_items?: Json
          gate_enabled?: boolean
          id?: string
          truck_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          enabled_items?: Json
          gate_enabled?: boolean
          id?: string
          truck_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_inspection_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_inspection_templates_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_inspections: {
        Row: {
          company_id: string
          id: string
          items_checked: Json
          missing_count: number
          run_date: string
          status: string
          submitted_at: string
          submitted_by: string
          submitted_by_name: string | null
          total_items: number
          truck_id: string
        }
        Insert: {
          company_id: string
          id?: string
          items_checked?: Json
          missing_count?: number
          run_date?: string
          status?: string
          submitted_at?: string
          submitted_by: string
          submitted_by_name?: string | null
          total_items?: number
          truck_id: string
        }
        Update: {
          company_id?: string
          id?: string
          items_checked?: Json
          missing_count?: number
          run_date?: string
          status?: string
          submitted_at?: string
          submitted_by?: string
          submitted_by_name?: string | null
          total_items?: number
          truck_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_inspections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_inspections_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_clearinghouse_settings: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          notes: string | null
          receiver_id: string
          receiver_name: string
          submitter_id: string
          submitter_name: string
          test_mode: boolean
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          receiver_id?: string
          receiver_name?: string
          submitter_id: string
          submitter_name: string
          test_mode?: boolean
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          receiver_id?: string
          receiver_name?: string
          submitter_id?: string
          submitter_name?: string
          test_mode?: boolean
          updated_at?: string
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
      generate_biller_tasks: { Args: never; Returns: undefined }
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
      is_owner_or_creator: { Args: never; Returns: boolean }
      is_protected_record: { Args: { _company_id: string }; Returns: boolean }
      is_system_creator: { Args: never; Returns: boolean }
      is_user_owner_of_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      reap_stale_loadtest_reports: { Args: never; Returns: number }
      safe_assign_crew:
        | {
            Args: {
              p_active_date: string
              p_member1_id?: string
              p_member2_id?: string
              p_truck_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_active_date: string
              p_member1_id?: string
              p_member2_id?: string
              p_member3_id?: string
              p_truck_id: string
            }
            Returns: Json
          }
      safe_update_slot_order: {
        Args: {
          p_expected_updated_at?: string
          p_leg_id: string
          p_run_date: string
          p_slot_order: number
          p_truck_id: string
        }
        Returns: Json
      }
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
        | "needs_review"
        | "pending"
        | "reversal"
        | "forwarded"
      email_send_status:
        | "pending"
        | "sent"
        | "failed"
        | "bounced"
        | "suppressed"
      email_type:
        | "password_reset"
        | "signup_verification"
        | "crew_invite"
        | "crew_schedule"
        | "other"
      invitation_status: "pending_invite" | "invited" | "active" | "inactive"
      leg_type: "A" | "B"
      membership_role:
        | "creator"
        | "owner"
        | "dispatcher"
        | "biller"
        | "crew"
        | "manager"
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
        | "approved_pending_payment"
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
        | "cancelled"
      schedule_days: "MWF" | "TTS"
      sex_type: "M" | "F"
      transport_type:
        | "dialysis"
        | "outpatient"
        | "adhoc"
        | "wound_care"
        | "ift"
        | "discharge"
        | "private_pay"
        | "psych_transport"
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
        | "pending_cancellation"
      trip_type:
        | "dialysis"
        | "discharge"
        | "outpatient"
        | "hospital"
        | "private_pay"
        | "ift"
        | "woundcare"
        | "psych_transport"
        | "wound_care"
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
        "needs_review",
        "pending",
        "reversal",
        "forwarded",
      ],
      email_send_status: ["pending", "sent", "failed", "bounced", "suppressed"],
      email_type: [
        "password_reset",
        "signup_verification",
        "crew_invite",
        "crew_schedule",
        "other",
      ],
      invitation_status: ["pending_invite", "invited", "active", "inactive"],
      leg_type: ["A", "B"],
      membership_role: [
        "creator",
        "owner",
        "dispatcher",
        "biller",
        "crew",
        "manager",
      ],
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
        "approved_pending_payment",
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
        "cancelled",
      ],
      schedule_days: ["MWF", "TTS"],
      sex_type: ["M", "F"],
      transport_type: [
        "dialysis",
        "outpatient",
        "adhoc",
        "wound_care",
        "ift",
        "discharge",
        "private_pay",
        "psych_transport",
      ],
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
        "pending_cancellation",
      ],
      trip_type: [
        "dialysis",
        "discharge",
        "outpatient",
        "hospital",
        "private_pay",
        "ift",
        "woundcare",
        "psych_transport",
        "wound_care",
      ],
    },
  },
} as const
