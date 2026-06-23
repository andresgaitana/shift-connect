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
      postulaciones: {
        Row: {
          agente_id: string
          created_at: string
          estado: Database["public"]["Enums"]["application_status"]
          id: string
          mensaje: string | null
          turno_id: string
          updated_at: string
        }
        Insert: {
          agente_id: string
          created_at?: string
          estado?: Database["public"]["Enums"]["application_status"]
          id?: string
          mensaje?: string | null
          turno_id: string
          updated_at?: string
        }
        Update: {
          agente_id?: string
          created_at?: string
          estado?: Database["public"]["Enums"]["application_status"]
          id?: string
          mensaje?: string | null
          turno_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "postulaciones_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "turnos_vacantes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          negocio: Database["public"]["Enums"]["business_type"] | null
          nombre_completo: string | null
          telefono: string | null
          updated_at: string
          zona_id: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id: string
          negocio?: Database["public"]["Enums"]["business_type"] | null
          nombre_completo?: string | null
          telefono?: string | null
          updated_at?: string
          zona_id?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          negocio?: Database["public"]["Enums"]["business_type"] | null
          nombre_completo?: string | null
          telefono?: string | null
          updated_at?: string
          zona_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_zona_id_fkey"
            columns: ["zona_id"]
            isOneToOne: false
            referencedRelation: "zonas"
            referencedColumns: ["id"]
          },
        ]
      }
      tiendas: {
        Row: {
          activa: boolean
          codigo: string | null
          created_at: string
          direccion: string
          id: string
          latitud: number | null
          longitud: number | null
          nombre: string
          updated_at: string
          zona_id: string
        }
        Insert: {
          activa?: boolean
          codigo?: string | null
          created_at?: string
          direccion: string
          id?: string
          latitud?: number | null
          longitud?: number | null
          nombre: string
          updated_at?: string
          zona_id: string
        }
        Update: {
          activa?: boolean
          codigo?: string | null
          created_at?: string
          direccion?: string
          id?: string
          latitud?: number | null
          longitud?: number | null
          nombre?: string
          updated_at?: string
          zona_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiendas_zona_id_fkey"
            columns: ["zona_id"]
            isOneToOne: false
            referencedRelation: "zonas"
            referencedColumns: ["id"]
          },
        ]
      }
      turnos_vacantes: {
        Row: {
          agente_asignado: string | null
          created_at: string
          estado: Database["public"]["Enums"]["shift_status"]
          fecha: string
          gt_creador: string
          hora_fin: string | null
          hora_inicio: string | null
          id: string
          negocio: Database["public"]["Enums"]["business_type"]
          notas: string | null
          tienda_id: string
          turno: Database["public"]["Enums"]["turno_slot"]
          updated_at: string
        }
        Insert: {
          agente_asignado?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["shift_status"]
          fecha: string
          gt_creador: string
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          negocio: Database["public"]["Enums"]["business_type"]
          notas?: string | null
          tienda_id: string
          turno: Database["public"]["Enums"]["turno_slot"]
          updated_at?: string
        }
        Update: {
          agente_asignado?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["shift_status"]
          fecha?: string
          gt_creador?: string
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          negocio?: Database["public"]["Enums"]["business_type"]
          notas?: string | null
          tienda_id?: string
          turno?: Database["public"]["Enums"]["turno_slot"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "turnos_vacantes_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      zonas: {
        Row: {
          created_at: string
          grupo: Database["public"]["Enums"]["zone_group"]
          id: string
          nombre: string
        }
        Insert: {
          created_at?: string
          grupo: Database["public"]["Enums"]["zone_group"]
          id?: string
          nombre: string
        }
        Update: {
          created_at?: string
          grupo?: Database["public"]["Enums"]["zone_group"]
          id?: string
          nombre?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_admin_if_none: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "gt" | "agente"
      application_status: "pendiente" | "aprobada" | "rechazada"
      business_type: "productos" | "mbk"
      shift_status: "abierto" | "asignado" | "cancelado"
      turno_slot: "AM" | "PM"
      zone_group: "managua" | "foraneas"
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
      app_role: ["admin", "gt", "agente"],
      application_status: ["pendiente", "aprobada", "rechazada"],
      business_type: ["productos", "mbk"],
      shift_status: ["abierto", "asignado", "cancelado"],
      turno_slot: ["AM", "PM"],
      zone_group: ["managua", "foraneas"],
    },
  },
} as const
