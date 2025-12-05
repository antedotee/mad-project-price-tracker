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
      searches: {
        Row: {
          id: string
          created_at: string
          last_scraped_at: string | null
          query: string
          status: 'Pending' | 'Scraping' | 'Done' | 'Failed'
          snapshot_id: string | null
          user_id: string
          is_tracked: boolean | null
        }
        Insert: {
          id?: string
          created_at?: string
          last_scraped_at?: string | null
          query: string
          status?: 'Pending' | 'Scraping' | 'Done' | 'Failed'
          snapshot_id?: string | null
          user_id: string
          is_tracked?: boolean | null
        }
        Update: {
          id?: string
          created_at?: string
          last_scraped_at?: string | null
          query?: string
          status?: 'Pending' | 'Scraping' | 'Done' | 'Failed'
          snapshot_id?: string | null
          user_id?: string
          is_tracked?: boolean | null
        }
      }
      products: {
        Row: {
          asin: string
          created_at: string
          updated_at: string
          name: string
          image: string | null
          url: string | null
          final_price: number | null
          currency: string
        }
        Insert: {
          asin: string
          created_at?: string
          updated_at?: string
          name: string
          image?: string | null
          url?: string | null
          final_price?: number | null
          currency?: string
        }
        Update: {
          asin?: string
          created_at?: string
          updated_at?: string
          name?: string
          image?: string | null
          url?: string | null
          final_price?: number | null
          currency?: string
        }
      }
      product_search: {
        Row: {
          asin: string
          search_id: string
        }
        Insert: {
          asin: string
          search_id: string
        }
        Update: {
          asin?: string
          search_id?: string
        }
      }
      product_snapshot: {
        Row: {
          id: number
          created_at: string
          asin: string
          final_price: number
        }
        Insert: {
          id?: number
          created_at?: string
          asin: string
          final_price: number
        }
        Update: {
          id?: number
          created_at?: string
          asin?: string
          final_price?: number
        }
      }
      profiles: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          display_name: string | null
          profile_photo_url: string | null
          bio: string | null
        }
        Insert: {
          id: string
          created_at?: string
          updated_at?: string
          display_name?: string | null
          profile_photo_url?: string | null
          bio?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          display_name?: string | null
          profile_photo_url?: string | null
          bio?: string | null
        }
      }
      price_drop_alerts: {
        Row: {
          id: string
          created_at: string
          search_id: string
          asin: string
          product_name: string
          product_url: string | null
          old_price: number
          new_price: number
          price_drop_amount: number
          price_drop_percent: number
          is_read: boolean
          user_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          search_id: string
          asin: string
          product_name: string
          product_url?: string | null
          old_price: number
          new_price: number
          price_drop_amount: number
          price_drop_percent: number
          is_read?: boolean
          user_id: string
        }
        Update: {
          id?: string
          created_at?: string
          search_id?: string
          asin?: string
          product_name?: string
          product_url?: string | null
          old_price?: number
          new_price?: number
          price_drop_amount?: number
          price_drop_percent?: number
          is_read?: boolean
          user_id?: string
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

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

