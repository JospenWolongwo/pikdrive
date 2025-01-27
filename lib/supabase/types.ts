export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          phone: string
          role: 'user' | 'driver' | 'admin'
          created_at: string
          updated_at: string
          full_name: string | null
          avatar_url: string | null
          verified: boolean
        }
        Insert: {
          id?: string
          phone: string
          role?: 'user' | 'driver' | 'admin'
          created_at?: string
          updated_at?: string
          full_name?: string | null
          avatar_url?: string | null
          verified?: boolean
        }
        Update: {
          id?: string
          phone?: string
          role?: 'user' | 'driver' | 'admin'
          created_at?: string
          updated_at?: string
          full_name?: string | null
          avatar_url?: string | null
          verified?: boolean
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
