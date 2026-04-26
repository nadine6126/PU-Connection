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
      ai_summaries: {
        Row: {
          created_at: string
          id: string
          input_text: string
          key_points: string[] | null
          source_name: string | null
          source_type: string
          summary_text: string
          topics: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_text: string
          key_points?: string[] | null
          source_name?: string | null
          source_type?: string
          summary_text: string
          topics?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input_text?: string
          key_points?: string[] | null
          source_name?: string | null
          source_type?: string
          summary_text?: string
          topics?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      answers: {
        Row: {
          body: string
          created_at: string
          id: string
          is_accepted: boolean
          is_anonymous: boolean
          question_id: string
          updated_at: string
          upvotes_count: number
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_accepted?: boolean
          is_anonymous?: boolean
          question_id: string
          updated_at?: string
          upvotes_count?: number
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_accepted?: boolean
          is_anonymous?: boolean
          question_id?: string
          updated_at?: string
          upvotes_count?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          end_at: string | null
          event_id: string | null
          group_id: string | null
          id: string
          reminded: boolean
          reminder_minutes: number | null
          start_at: string
          task_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          event_id?: string | null
          group_id?: string | null
          id?: string
          reminded?: boolean
          reminder_minutes?: number | null
          start_at: string
          task_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          event_id?: string | null
          group_id?: string | null
          id?: string
          reminded?: boolean
          reminder_minutes?: number | null
          start_at?: string
          task_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chatbot_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_sessions: {
        Row: {
          id: string
          started_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          started_at?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          started_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      community_posts: {
        Row: {
          body: string
          category: string
          comments_count: number
          created_at: string
          id: string
          image_url: string | null
          is_pinned: boolean
          title: string | null
          updated_at: string
          upvotes_count: number
          user_id: string
        }
        Insert: {
          body: string
          category?: string
          comments_count?: number
          created_at?: string
          id?: string
          image_url?: string | null
          is_pinned?: boolean
          title?: string | null
          updated_at?: string
          upvotes_count?: number
          user_id: string
        }
        Update: {
          body?: string
          category?: string
          comments_count?: number
          created_at?: string
          id?: string
          image_url?: string | null
          is_pinned?: boolean
          title?: string | null
          updated_at?: string
          upvotes_count?: number
          user_id?: string
        }
        Relationships: []
      }
      event_rsvps: {
        Row: {
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          end_at: string | null
          event_type: string
          external_register_url: string | null
          id: string
          is_verified: boolean
          location_or_link: string | null
          organizer_contact: string | null
          organizer_name: string | null
          payment_status: string
          posted_by: string
          start_at: string
          status: string
          title: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          event_type?: string
          external_register_url?: string | null
          id?: string
          is_verified?: boolean
          location_or_link?: string | null
          organizer_contact?: string | null
          organizer_name?: string | null
          payment_status?: string
          posted_by: string
          start_at: string
          status?: string
          title: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          event_type?: string
          external_register_url?: string | null
          id?: string
          is_verified?: boolean
          location_or_link?: string | null
          organizer_contact?: string | null
          organizer_name?: string | null
          payment_status?: string
          posted_by?: string
          start_at?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      faculties: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: number
          name: string
        }
        Update: {
          id?: number
          name?: string
        }
        Relationships: []
      }
      group_messages: {
        Row: {
          content: string
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      majors: {
        Row: {
          faculty_id: number
          id: number
          name: string
        }
        Insert: {
          faculty_id: number
          id?: number
          name: string
        }
        Update: {
          faculty_id?: number
          id?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "majors_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          dashboard_color: string | null
          email: string | null
          faculty_id: number | null
          full_name: string
          id: string
          major_id: number | null
          student_id: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          dashboard_color?: string | null
          email?: string | null
          faculty_id?: number | null
          full_name?: string
          id?: string
          major_id?: number | null
          student_id?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          dashboard_color?: string | null
          email?: string | null
          faculty_id?: number | null
          full_name?: string
          id?: string
          major_id?: number | null
          student_id?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_major_id_fkey"
            columns: ["major_id"]
            isOneToOne: false
            referencedRelation: "majors"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          body: string
          created_at: string
          id: string
          is_anonymous: boolean
          is_answered: boolean
          tags: string[] | null
          title: string
          updated_at: string
          upvotes_count: number
          user_id: string | null
          views_count: number
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          is_answered?: boolean
          tags?: string[] | null
          title: string
          updated_at?: string
          upvotes_count?: number
          user_id?: string | null
          views_count?: number
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          is_answered?: boolean
          tags?: string[] | null
          title?: string
          updated_at?: string
          upvotes_count?: number
          user_id?: string | null
          views_count?: number
        }
        Relationships: []
      }
      study_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      study_groups: {
        Row: {
          course_name: string | null
          cover_image_url: string | null
          created_at: string
          creator_id: string
          description: string | null
          faculty_id: number | null
          id: string
          max_members: number
          name: string
          slug: string | null
          status: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          course_name?: string | null
          cover_image_url?: string | null
          created_at?: string
          creator_id: string
          description?: string | null
          faculty_id?: number | null
          id?: string
          max_members?: number
          name: string
          slug?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          course_name?: string | null
          cover_image_url?: string | null
          created_at?: string
          creator_id?: string
          description?: string | null
          faculty_id?: number | null
          id?: string
          max_members?: number
          name?: string
          slug?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_groups_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculties"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          group_id: string | null
          id: string
          priority: string
          reminder_at: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          group_id?: string | null
          id?: string
          priority?: string
          reminder_at?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          group_id?: string | null
          id?: string
          priority?: string
          reminder_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
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
          role?: Database["public"]["Enums"]["app_role"]
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
      is_group_member: {
        Args: { _group: string; _user: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "student"
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
      app_role: ["admin", "student"],
    },
  },
} as const
