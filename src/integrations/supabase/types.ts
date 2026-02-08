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
          created_at: string
          dismissed: boolean
          id: string
          message: string
          run_id: string | null
          severity: string
          truck_id: string | null
        }
        Insert: {
          created_at?: string
          dismissed?: boolean
          id?: string
          message: string
          run_id?: string | null
          severity?: string
          truck_id?: string | null
        }
        Update: {
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
      company_settings: {
        Row: {
          company_name: string
          id: string
          updated_at: string
        }
        Insert: {
          company_name?: string
          id?: string
          updated_at?: string
        }
        Update: {
          company_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      crews: {
        Row: {
          active_date: string
          created_at: string
          id: string
          member1_id: string | null
          member2_id: string | null
          truck_id: string
        }
        Insert: {
          active_date?: string
          created_at?: string
          id?: string
          member1_id?: string | null
          member2_id?: string | null
          truck_id: string
        }
        Update: {
          active_date?: string
          created_at?: string
          id?: string
          member1_id?: string | null
          member2_id?: string | null
          truck_id?: string
        }
        Relationships: [
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
      patients: {
        Row: {
          chair_time: string | null
          created_at: string
          dob: string | null
          dropoff_facility: string | null
          first_name: string
          id: string
          last_name: string
          notes: string | null
          phone: string | null
          pickup_address: string | null
          run_duration_minutes: number | null
          schedule_days: Database["public"]["Enums"]["schedule_days"] | null
          updated_at: string
          weight_lbs: number | null
        }
        Insert: {
          chair_time?: string | null
          created_at?: string
          dob?: string | null
          dropoff_facility?: string | null
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          phone?: string | null
          pickup_address?: string | null
          run_duration_minutes?: number | null
          schedule_days?: Database["public"]["Enums"]["schedule_days"] | null
          updated_at?: string
          weight_lbs?: number | null
        }
        Update: {
          chair_time?: string | null
          created_at?: string
          dob?: string | null
          dropoff_facility?: string | null
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          phone?: string | null
          pickup_address?: string | null
          run_duration_minutes?: number | null
          schedule_days?: Database["public"]["Enums"]["schedule_days"] | null
          updated_at?: string
          weight_lbs?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cert_level: Database["public"]["Enums"]["cert_level"]
          created_at: string
          full_name: string
          id: string
          sex: Database["public"]["Enums"]["sex_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cert_level?: Database["public"]["Enums"]["cert_level"]
          created_at?: string
          full_name: string
          id?: string
          sex?: Database["public"]["Enums"]["sex_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cert_level?: Database["public"]["Enums"]["cert_level"]
          created_at?: string
          full_name?: string
          id?: string
          sex?: Database["public"]["Enums"]["sex_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      runs: {
        Row: {
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
      trucks: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "crew"
      cert_level: "EMT-B" | "EMT-A" | "EMT-P" | "AEMT" | "Other"
      run_status:
        | "pending"
        | "en_route"
        | "arrived"
        | "with_patient"
        | "transporting"
        | "completed"
      schedule_days: "MWF" | "TTS"
      sex_type: "M" | "F"
      trip_type: "dialysis" | "discharge" | "outpatient"
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
      app_role: ["admin", "crew"],
      cert_level: ["EMT-B", "EMT-A", "EMT-P", "AEMT", "Other"],
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
      trip_type: ["dialysis", "discharge", "outpatient"],
    },
  },
} as const
