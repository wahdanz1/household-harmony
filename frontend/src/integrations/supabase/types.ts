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
    PostgrestVersion: "13.0.5"
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
      co_parent_settlements: {
        Row: {
          co_parent_id: string
          created_at: string
          household_id: string
          id: string
          income_received: number
          insurance_paid: number
          month: string
          net_amount: number
          notes: string | null
          settled_at: string | null
          shared_expenses_total: number
          their_share_of_insurance: number
          your_share_of_income: number
        }
        Insert: {
          co_parent_id: string
          created_at?: string
          household_id: string
          id?: string
          income_received?: number
          insurance_paid?: number
          month: string
          net_amount?: number
          notes?: string | null
          settled_at?: string | null
          shared_expenses_total?: number
          their_share_of_insurance?: number
          your_share_of_income?: number
        }
        Update: {
          co_parent_id?: string
          created_at?: string
          household_id?: string
          id?: string
          income_received?: number
          insurance_paid?: number
          month?: string
          net_amount?: number
          notes?: string | null
          settled_at?: string | null
          shared_expenses_total?: number
          their_share_of_insurance?: number
          your_share_of_income?: number
        }
        Relationships: [
          {
            foreignKeyName: "co_parent_settlements_co_parent_id_fkey"
            columns: ["co_parent_id"]
            isOneToOne: false
            referencedRelation: "co_parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "co_parent_settlements_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      co_parents: {
        Row: {
          created_at: string
          household_id: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "co_parents_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_cards: {
        Row: {
          created_at: string | null
          created_by: string
          encrypted_monthly_limit: string | null
          encrypted_name: string | null
          household_id: string
          id: string
          is_active: boolean | null
          is_encrypted: boolean | null
          monthly_limit: number | null
          name: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          encrypted_monthly_limit?: string | null
          encrypted_name?: string | null
          household_id: string
          id?: string
          is_active?: boolean | null
          is_encrypted?: boolean | null
          monthly_limit?: number | null
          name?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          encrypted_monthly_limit?: string | null
          encrypted_name?: string | null
          household_id?: string
          id?: string
          is_active?: boolean | null
          is_encrypted?: boolean | null
          monthly_limit?: number | null
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_cards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_cards_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      email_whitelist: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          category: Database["public"]["Enums"]["expense_category_enum"]
          created_at: string
          created_by: string | null
          credit_card_id: string | null
          encrypted_budget: string | null
          encrypted_name: string | null
          household_id: string
          icon: string | null
          id: string
          is_active: boolean
          is_credit: boolean | null
          is_encrypted: boolean | null
          member_id: string | null
          metadata: Json | null
          sort_order: number
          subject_id: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          category: Database["public"]["Enums"]["expense_category_enum"]
          created_at?: string
          created_by?: string | null
          credit_card_id?: string | null
          encrypted_budget?: string | null
          encrypted_name?: string | null
          household_id: string
          icon?: string | null
          id?: string
          is_active?: boolean
          is_credit?: boolean | null
          is_encrypted?: boolean | null
          member_id?: string | null
          metadata?: Json | null
          sort_order?: number
          subject_id?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          category?: Database["public"]["Enums"]["expense_category_enum"]
          created_at?: string
          created_by?: string | null
          credit_card_id?: string | null
          encrypted_budget?: string | null
          encrypted_name?: string | null
          household_id?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          is_credit?: boolean | null
          is_encrypted?: boolean | null
          member_id?: string | null
          metadata?: Json | null
          sort_order?: number
          subject_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "household_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invites: {
        Row: {
          created_at: string
          created_by: string
          dek_iv: string | null
          dek_salt: string | null
          encrypted_dek: string | null
          expires_at: string
          household_id: string
          id: string
          invite_code: string
          invited_email: string
          is_active: boolean | null
          status: Database["public"]["Enums"]["invite_status"]
        }
        Insert: {
          created_at?: string
          created_by: string
          dek_iv?: string | null
          dek_salt?: string | null
          encrypted_dek?: string | null
          expires_at: string
          household_id: string
          id?: string
          invite_code: string
          invited_email: string
          is_active?: boolean | null
          status?: Database["public"]["Enums"]["invite_status"]
        }
        Update: {
          created_at?: string
          created_by?: string
          dek_iv?: string | null
          dek_salt?: string | null
          encrypted_dek?: string | null
          expires_at?: string
          household_id?: string
          id?: string
          invite_code?: string
          invited_email?: string
          is_active?: boolean | null
          status?: Database["public"]["Enums"]["invite_status"]
        }
        Relationships: [
          {
            foreignKeyName: "household_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          household_id: string
          id: string
          joined_at: string
          pending_exit_at: string | null
          pending_exit_initiated_by: string | null
          role: Database["public"]["Enums"]["household_role"]
          user_id: string
        }
        Insert: {
          household_id: string
          id?: string
          joined_at?: string
          pending_exit_at?: string | null
          pending_exit_initiated_by?: string | null
          role: Database["public"]["Enums"]["household_role"]
          user_id: string
        }
        Update: {
          household_id?: string
          id?: string
          joined_at?: string
          pending_exit_at?: string | null
          pending_exit_initiated_by?: string | null
          role?: Database["public"]["Enums"]["household_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          currency: string
          enable_credit_cards: boolean | null
          enable_shared_expenses: boolean | null
          financial_month_start: number | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          enable_credit_cards?: boolean | null
          enable_shared_expenses?: boolean | null
          financial_month_start?: number | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          enable_credit_cards?: boolean | null
          enable_shared_expenses?: boolean | null
          financial_month_start?: number | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "households_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      income_sources: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          category: Database["public"]["Enums"]["income_category_enum"]
          co_parent_id: string | null
          created_at: string
          custom_tax_rate: number | null
          encrypted_budget: string | null
          encrypted_name: string | null
          encrypted_provider: string | null
          household_id: string
          id: string
          is_active: boolean
          is_encrypted: boolean | null
          is_shared: boolean | null
          owner_id: string
          share_percentage: number | null
          tax_type: Database["public"]["Enums"]["tax_type"] | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          category: Database["public"]["Enums"]["income_category_enum"]
          co_parent_id?: string | null
          created_at?: string
          custom_tax_rate?: number | null
          encrypted_budget?: string | null
          encrypted_name?: string | null
          encrypted_provider?: string | null
          household_id: string
          id?: string
          is_active?: boolean
          is_encrypted?: boolean | null
          is_shared?: boolean | null
          owner_id: string
          share_percentage?: number | null
          tax_type?: Database["public"]["Enums"]["tax_type"] | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          category?: Database["public"]["Enums"]["income_category_enum"]
          co_parent_id?: string | null
          created_at?: string
          custom_tax_rate?: number | null
          encrypted_budget?: string | null
          encrypted_name?: string | null
          encrypted_provider?: string | null
          household_id?: string
          id?: string
          is_active?: boolean
          is_encrypted?: boolean | null
          is_shared?: boolean | null
          owner_id?: string
          share_percentage?: number | null
          tax_type?: Database["public"]["Enums"]["tax_type"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_sources_co_parent_id_fkey"
            columns: ["co_parent_id"]
            isOneToOne: false
            referencedRelation: "co_parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_sources_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_sources_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      insurances: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          billing_cycle: Database["public"]["Enums"]["billing_cycle_enum"]
          billing_day: number | null
          billing_month: number | null
          category: Database["public"]["Enums"]["insurance_category_enum"]
          co_parent_id: string | null
          created_at: string
          created_by: string
          encrypted_budget: string | null
          encrypted_name: string | null
          encrypted_provider: string | null
          household_id: string
          id: string
          is_active: boolean
          is_encrypted: boolean | null
          is_shared: boolean
          member_id: string | null
          notes: string | null
          share_percentage: number
          subject_id: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          billing_cycle?: Database["public"]["Enums"]["billing_cycle_enum"]
          billing_day?: number | null
          billing_month?: number | null
          category: Database["public"]["Enums"]["insurance_category_enum"]
          co_parent_id?: string | null
          created_at?: string
          created_by: string
          encrypted_budget?: string | null
          encrypted_name?: string | null
          encrypted_provider?: string | null
          household_id: string
          id?: string
          is_active?: boolean
          is_encrypted?: boolean | null
          is_shared?: boolean
          member_id?: string | null
          notes?: string | null
          share_percentage?: number
          subject_id?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          billing_cycle?: Database["public"]["Enums"]["billing_cycle_enum"]
          billing_day?: number | null
          billing_month?: number | null
          category?: Database["public"]["Enums"]["insurance_category_enum"]
          co_parent_id?: string | null
          created_at?: string
          created_by?: string
          encrypted_budget?: string | null
          encrypted_name?: string | null
          encrypted_provider?: string | null
          household_id?: string
          id?: string
          is_active?: boolean
          is_encrypted?: boolean | null
          is_shared?: boolean
          member_id?: string | null
          notes?: string | null
          share_percentage?: number
          subject_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurances_co_parent_id_fkey"
            columns: ["co_parent_id"]
            isOneToOne: false
            referencedRelation: "co_parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurances_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurances_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "household_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurances_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_categories: {
        Row: {
          category: string
          confidence: string | null
          created_at: string | null
          household_id: string
          id: string
          merchant_name: string
          times_used: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category: string
          confidence?: string | null
          created_at?: string | null
          household_id: string
          id?: string
          merchant_name: string
          times_used?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          confidence?: string | null
          created_at?: string | null
          household_id?: string
          id?: string
          merchant_name?: string
          times_used?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_expenses: {
        Row: {
          actual_recorded_at: string | null
          budget_changed_at: string | null
          created_at: string
          created_by: string
          electricity_grid: number | null
          electricity_market: number | null
          encrypted_actual_amount: string | null
          encrypted_budget_snapshot: string | null
          encrypted_previous_budget_snapshot: string | null
          expense_id: string | null
          household_id: string
          id: string
          inactivated_at: string | null
          is_encrypted: boolean | null
          member_id: string | null
          month: string
          month_end: string | null
          month_start: string | null
          notes: string | null
          one_time_category: string | null
          one_time_name: string | null
          subject_id: string | null
          updated_at: string | null
        }
        Insert: {
          actual_recorded_at?: string | null
          budget_changed_at?: string | null
          created_at?: string
          created_by: string
          electricity_grid?: number | null
          electricity_market?: number | null
          encrypted_actual_amount?: string | null
          encrypted_budget_snapshot?: string | null
          encrypted_previous_budget_snapshot?: string | null
          expense_id?: string | null
          household_id: string
          id?: string
          inactivated_at?: string | null
          is_encrypted?: boolean | null
          member_id?: string | null
          month: string
          month_end?: string | null
          month_start?: string | null
          notes?: string | null
          one_time_category?: string | null
          one_time_name?: string | null
          subject_id?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_recorded_at?: string | null
          budget_changed_at?: string | null
          created_at?: string
          created_by?: string
          electricity_grid?: number | null
          electricity_market?: number | null
          encrypted_actual_amount?: string | null
          encrypted_budget_snapshot?: string | null
          encrypted_previous_budget_snapshot?: string | null
          expense_id?: string | null
          household_id?: string
          id?: string
          inactivated_at?: string | null
          is_encrypted?: boolean | null
          member_id?: string | null
          month?: string
          month_end?: string | null
          month_start?: string | null
          notes?: string | null
          one_time_category?: string | null
          one_time_name?: string | null
          subject_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_expenses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_expenses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "household_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_expenses_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_incomes: {
        Row: {
          actual_recorded_at: string | null
          budget_changed_at: string | null
          co_parent_id: string | null
          created_at: string
          created_by: string
          encrypted_actual_amount: string | null
          encrypted_budget_snapshot: string | null
          encrypted_previous_budget_snapshot: string | null
          household_id: string
          id: string
          inactivated_at: string | null
          income_source_id: string | null
          is_encrypted: boolean | null
          is_shared: boolean
          month: string
          month_end: string | null
          month_start: string | null
          notes: string | null
          one_time_category: string | null
          one_time_name: string | null
          share_percentage: number
          updated_at: string | null
        }
        Insert: {
          actual_recorded_at?: string | null
          budget_changed_at?: string | null
          co_parent_id?: string | null
          created_at?: string
          created_by: string
          encrypted_actual_amount?: string | null
          encrypted_budget_snapshot?: string | null
          encrypted_previous_budget_snapshot?: string | null
          household_id: string
          id?: string
          inactivated_at?: string | null
          income_source_id?: string | null
          is_encrypted?: boolean | null
          is_shared?: boolean
          month: string
          month_end?: string | null
          month_start?: string | null
          notes?: string | null
          one_time_category?: string | null
          one_time_name?: string | null
          share_percentage?: number
          updated_at?: string | null
        }
        Update: {
          actual_recorded_at?: string | null
          budget_changed_at?: string | null
          co_parent_id?: string | null
          created_at?: string
          created_by?: string
          encrypted_actual_amount?: string | null
          encrypted_budget_snapshot?: string | null
          encrypted_previous_budget_snapshot?: string | null
          household_id?: string
          id?: string
          inactivated_at?: string | null
          income_source_id?: string | null
          is_encrypted?: boolean | null
          is_shared?: boolean
          month?: string
          month_end?: string | null
          month_start?: string | null
          notes?: string | null
          one_time_category?: string | null
          one_time_name?: string | null
          share_percentage?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_incomes_co_parent_id_fkey"
            columns: ["co_parent_id"]
            isOneToOne: false
            referencedRelation: "co_parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_incomes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_incomes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_incomes_income_source_id_fkey"
            columns: ["income_source_id"]
            isOneToOne: false
            referencedRelation: "income_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_insurances: {
        Row: {
          actual_recorded_at: string | null
          budget_changed_at: string | null
          created_at: string
          created_by: string
          encrypted_actual_amount: string | null
          encrypted_budget_snapshot: string | null
          encrypted_previous_budget_snapshot: string | null
          household_id: string
          id: string
          inactivated_at: string | null
          insurance_id: string | null
          is_encrypted: boolean | null
          month: string
          month_end: string | null
          month_start: string | null
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          actual_recorded_at?: string | null
          budget_changed_at?: string | null
          created_at?: string
          created_by: string
          encrypted_actual_amount?: string | null
          encrypted_budget_snapshot?: string | null
          encrypted_previous_budget_snapshot?: string | null
          household_id: string
          id?: string
          inactivated_at?: string | null
          insurance_id?: string | null
          is_encrypted?: boolean | null
          month: string
          month_end?: string | null
          month_start?: string | null
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_recorded_at?: string | null
          budget_changed_at?: string | null
          created_at?: string
          created_by?: string
          encrypted_actual_amount?: string | null
          encrypted_budget_snapshot?: string | null
          encrypted_previous_budget_snapshot?: string | null
          household_id?: string
          id?: string
          inactivated_at?: string | null
          insurance_id?: string | null
          is_encrypted?: boolean | null
          month?: string
          month_end?: string | null
          month_start?: string | null
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_insurances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_insurances_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_insurances_insurance_id_fkey"
            columns: ["insurance_id"]
            isOneToOne: false
            referencedRelation: "insurances"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_review_finalized: {
        Row: {
          finalized_at: string
          finalized_by: string
          household_id: string
          month: string
        }
        Insert: {
          finalized_at?: string
          finalized_by: string
          household_id: string
          month: string
        }
        Update: {
          finalized_at?: string
          finalized_by?: string
          household_id?: string
          month?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_review_finalized_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_review_status: {
        Row: {
          accepted_at: string
          household_id: string
          month: string
          scope: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          household_id: string
          month: string
          scope: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          household_id?: string
          month?: string
          scope?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_review_status_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_subscriptions: {
        Row: {
          actual_recorded_at: string | null
          budget_changed_at: string | null
          created_at: string
          created_by: string
          encrypted_actual_amount: string | null
          encrypted_budget_snapshot: string | null
          encrypted_previous_budget_snapshot: string | null
          household_id: string
          id: string
          inactivated_at: string | null
          is_encrypted: boolean | null
          month: string
          month_end: string | null
          month_start: string | null
          notes: string | null
          subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          actual_recorded_at?: string | null
          budget_changed_at?: string | null
          created_at?: string
          created_by: string
          encrypted_actual_amount?: string | null
          encrypted_budget_snapshot?: string | null
          encrypted_previous_budget_snapshot?: string | null
          household_id: string
          id?: string
          inactivated_at?: string | null
          is_encrypted?: boolean | null
          month: string
          month_end?: string | null
          month_start?: string | null
          notes?: string | null
          subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_recorded_at?: string | null
          budget_changed_at?: string | null
          created_at?: string
          created_by?: string
          encrypted_actual_amount?: string | null
          encrypted_budget_snapshot?: string | null
          encrypted_previous_budget_snapshot?: string | null
          household_id?: string
          id?: string
          inactivated_at?: string | null
          is_encrypted?: boolean | null
          month?: string
          month_end?: string | null
          month_start?: string | null
          notes?: string | null
          subscription_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_subscriptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_subscriptions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_subscriptions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birthdate: string | null
          created_at: string
          email: string
          email_public: boolean | null
          full_name: string | null
          id: string
          is_demo: boolean | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          birthdate?: string | null
          created_at?: string
          email: string
          email_public?: boolean | null
          full_name?: string | null
          id: string
          is_demo?: boolean | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          birthdate?: string | null
          created_at?: string
          email?: string
          email_public?: boolean | null
          full_name?: string | null
          id?: string
          is_demo?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      shared_expenses: {
        Row: {
          co_parent_id: string | null
          created_at: string
          created_by: string
          encrypted_amount: string | null
          encrypted_description: string | null
          household_id: string
          id: string
          is_encrypted: boolean | null
          month: string
          month_end: string | null
          month_start: string | null
          notes: string | null
          paid_by: string | null
        }
        Insert: {
          co_parent_id?: string | null
          created_at?: string
          created_by: string
          encrypted_amount?: string | null
          encrypted_description?: string | null
          household_id: string
          id?: string
          is_encrypted?: boolean | null
          month: string
          month_end?: string | null
          month_start?: string | null
          notes?: string | null
          paid_by?: string | null
        }
        Update: {
          co_parent_id?: string | null
          created_at?: string
          created_by?: string
          encrypted_amount?: string | null
          encrypted_description?: string | null
          household_id?: string
          id?: string
          is_encrypted?: boolean | null
          month?: string
          month_end?: string | null
          month_start?: string | null
          notes?: string | null
          paid_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_expenses_co_parent_id_fkey"
            columns: ["co_parent_id"]
            isOneToOne: false
            referencedRelation: "co_parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_expenses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          household_id: string
          id: string
          name: string
          sort_order: number
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          name: string
          sort_order?: number
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          sort_order?: number
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subjects_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          billing_cycle: Database["public"]["Enums"]["billing_cycle_enum"]
          billing_day: number | null
          billing_month: number | null
          category: Database["public"]["Enums"]["subscription_category_enum"]
          created_at: string
          created_by: string
          encrypted_budget: string | null
          encrypted_name: string | null
          encrypted_service: string | null
          household_id: string
          id: string
          is_active: boolean
          is_encrypted: boolean | null
          member_id: string | null
          notes: string | null
          subject_id: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          billing_cycle?: Database["public"]["Enums"]["billing_cycle_enum"]
          billing_day?: number | null
          billing_month?: number | null
          category: Database["public"]["Enums"]["subscription_category_enum"]
          created_at?: string
          created_by: string
          encrypted_budget?: string | null
          encrypted_name?: string | null
          encrypted_service?: string | null
          household_id: string
          id?: string
          is_active?: boolean
          is_encrypted?: boolean | null
          member_id?: string | null
          notes?: string | null
          subject_id?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          billing_cycle?: Database["public"]["Enums"]["billing_cycle_enum"]
          billing_day?: number | null
          billing_month?: number | null
          category?: Database["public"]["Enums"]["subscription_category_enum"]
          created_at?: string
          created_by?: string
          encrypted_budget?: string | null
          encrypted_name?: string | null
          encrypted_service?: string | null
          household_id?: string
          id?: string
          is_active?: boolean
          is_encrypted?: boolean | null
          member_id?: string | null
          notes?: string | null
          subject_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "household_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      temporary_expenses: {
        Row: {
          category: Database["public"]["Enums"]["temporary_expense_category_enum"]
          created_at: string | null
          created_by: string | null
          description: string | null
          encrypted_amount: string | null
          encrypted_description: string | null
          household_id: string
          id: string
          is_encrypted: boolean | null
          month: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["temporary_expense_category_enum"]
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          encrypted_amount?: string | null
          encrypted_description?: string | null
          household_id: string
          id?: string
          is_encrypted?: boolean | null
          month: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["temporary_expense_category_enum"]
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          encrypted_amount?: string | null
          encrypted_description?: string | null
          household_id?: string
          id?: string
          is_encrypted?: boolean | null
          month?: string
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "temporary_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temporary_expenses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      user_api_keys: {
        Row: {
          created_at: string | null
          encrypted_key: string | null
          household_id: string
          id: string
          is_encrypted: boolean | null
          key_iv: string | null
          provider: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          encrypted_key?: string | null
          household_id: string
          id?: string
          is_encrypted?: boolean | null
          key_iv?: string | null
          provider?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          encrypted_key?: string | null
          household_id?: string
          id?: string
          is_encrypted?: boolean | null
          key_iv?: string | null
          provider?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_api_keys_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      user_vault_keys: {
        Row: {
          created_at: string
          dek_iv: string
          dek_salt: string
          encrypted_dek: string
          encryption_version: number
          household_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dek_iv: string
          dek_salt: string
          encrypted_dek: string
          encryption_version?: number
          household_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dek_iv?: string
          dek_salt?: string
          encrypted_dek?: string
          encryption_version?: number
          household_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_vault_keys_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      user_vault_recovery_slots: {
        Row: {
          created_at: string
          encrypted_dek: string
          granted_by_user_id: string | null
          id: string
          iv: string
          label: string | null
          salt: string | null
          slot_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          encrypted_dek: string
          granted_by_user_id?: string | null
          id?: string
          iv: string
          label?: string | null
          salt?: string | null
          slot_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          encrypted_dek?: string
          granted_by_user_id?: string | null
          id?: string
          iv?: string
          label?: string | null
          salt?: string | null
          slot_type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      confirm_member_exit: { Args: never; Returns: undefined }
      ensure_user_has_household: { Args: never; Returns: string }
      financial_month_start_for: {
        Args: { fms: number; reference_date: string }
        Returns: string
      }
      get_user_household_id: { Args: { _user_id: string }; Returns: string }
      handle_owner_leave: {
        Args: { successor_user_id_in: string }
        Returns: undefined
      }
      household_has_any_vault_keys: {
        Args: { household_id_in: string }
        Returns: boolean
      }
      is_active_household_member: {
        Args: { _household_id: string; _user_id: string }
        Returns: boolean
      }
      is_email_whitelisted: { Args: { email_in: string }; Returns: boolean }
      is_household_member: {
        Args: { _household_id: string; _user_id: string }
        Returns: boolean
      }
      is_household_owner: {
        Args: { _household_id: string; _user_id: string }
        Returns: boolean
      }
      lookup_active_invite: { Args: { invite_code_in: string }; Returns: Json }
      redeem_invite: { Args: { invite_code_in: string }; Returns: Json }
      request_member_exit: {
        Args: { member_id_in: string }
        Returns: undefined
      }
      sweep_pending_exits: { Args: never; Returns: number }
    }
    Enums: {
      billing_cycle_enum: "monthly" | "quarterly" | "semi_annually" | "yearly"
      expense_category_enum:
        | "rent"
        | "internet"
        | "phone_plan"
        | "electricity"
        | "groceries"
        | "dining_out"
        | "entertainment"
        | "shopping"
        | "fuel"
        | "travel"
        | "car_repairs"
        | "credit_card"
        | "healthcare"
        | "memberships"
        | "childcare"
        | "home_appliances"
        | "treats_comfort"
        | "other"
      household_role: "owner" | "member"
      income_category:
        | "salary"
        | "business_income"
        | "government_benefits"
        | "investment_income"
        | "gift"
        | "other"
      income_category_enum:
        | "salary"
        | "business_income"
        | "government_benefits"
        | "investment_income"
        | "gift"
        | "pension"
        | "other"
      insurance_category_enum:
        | "home"
        | "car"
        | "health"
        | "child"
        | "life"
        | "pet"
        | "travel"
        | "liability"
        | "other"
      invite_status: "pending" | "accepted" | "expired"
      one_time_income_category_enum:
        | "gift"
        | "lottery"
        | "tax_refund"
        | "bonus"
        | "sale"
        | "inheritance"
        | "other"
      subscription_category_enum:
        | "streaming"
        | "software"
        | "music"
        | "gaming"
        | "gym"
        | "news"
        | "storage"
        | "education"
        | "other"
      tax_type: "no_tax" | "standard_30" | "progressive" | "csn_variable"
      temporary_expense_category_enum:
        | "car_repair"
        | "medical"
        | "home_repair"
        | "gift"
        | "travel"
        | "other"
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
      billing_cycle_enum: ["monthly", "quarterly", "semi_annually", "yearly"],
      expense_category_enum: [
        "rent",
        "internet",
        "phone_plan",
        "electricity",
        "groceries",
        "dining_out",
        "entertainment",
        "shopping",
        "fuel",
        "travel",
        "car_repairs",
        "credit_card",
        "healthcare",
        "memberships",
        "childcare",
        "home_appliances",
        "treats_comfort",
        "other",
      ],
      household_role: ["owner", "member"],
      income_category: [
        "salary",
        "business_income",
        "government_benefits",
        "investment_income",
        "gift",
        "other",
      ],
      income_category_enum: [
        "salary",
        "business_income",
        "government_benefits",
        "investment_income",
        "gift",
        "pension",
        "other",
      ],
      insurance_category_enum: [
        "home",
        "car",
        "health",
        "child",
        "life",
        "pet",
        "travel",
        "liability",
        "other",
      ],
      invite_status: ["pending", "accepted", "expired"],
      one_time_income_category_enum: [
        "gift",
        "lottery",
        "tax_refund",
        "bonus",
        "sale",
        "inheritance",
        "other",
      ],
      subscription_category_enum: [
        "streaming",
        "software",
        "music",
        "gaming",
        "gym",
        "news",
        "storage",
        "education",
        "other",
      ],
      tax_type: ["no_tax", "standard_30", "progressive", "csn_variable"],
      temporary_expense_category_enum: [
        "car_repair",
        "medical",
        "home_repair",
        "gift",
        "travel",
        "other",
      ],
    },
  },
} as const
