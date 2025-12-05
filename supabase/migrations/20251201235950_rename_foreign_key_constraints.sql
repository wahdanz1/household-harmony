-- Migration: Rename Foreign Key Constraints
-- Created: 2025-12-02
-- Purpose: Rename FK constraints to match new table/column names
-- Prerequisites: Run after 20251201235900_rename_expense_category_id.sql

-- ============================================================================
-- STEP 1: Rename FK on monthly_expenses table
-- ============================================================================

-- Drop old FK constraint
ALTER TABLE public.monthly_expenses
DROP CONSTRAINT IF EXISTS monthly_expenses_expense_category_id_fkey;

-- Add new FK constraint with correct name
ALTER TABLE public.monthly_expenses
ADD CONSTRAINT monthly_expenses_regular_expense_id_fkey
FOREIGN KEY (regular_expense_id)
REFERENCES public.regular_expenses(id)
ON DELETE CASCADE;

-- ============================================================================
-- STEP 2: Rename FK on regular_expenses table
-- ============================================================================

-- Drop old FK constraint
ALTER TABLE public.regular_expenses
DROP CONSTRAINT IF EXISTS expense_categories_household_id_fkey;

-- Add new FK constraint with correct name
ALTER TABLE public.regular_expenses
ADD CONSTRAINT regular_expenses_household_id_fkey
FOREIGN KEY (household_id)
REFERENCES public.households(id)
ON DELETE CASCADE;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Foreign key constraints renamed successfully!';
  RAISE NOTICE '✅ monthly_expenses_expense_category_id_fkey → monthly_expenses_regular_expense_id_fkey';
  RAISE NOTICE '✅ expense_categories_household_id_fkey → regular_expenses_household_id_fkey';
END $$;
