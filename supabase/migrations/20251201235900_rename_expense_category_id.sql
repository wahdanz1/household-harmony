-- Migration: Rename expense_category_id to regular_expense_id
-- Created: 2025-12-02
-- Purpose: Remove confusing "expense_category" naming from schema
-- Notes: The table "regular_expenses" contains expense definitions, not categories
--        Categories are handled in TypeScript code (e.g., "groceries", "rent", etc.)

-- ============================================================================
-- STEP 1: Rename the column in monthly_expenses
-- ============================================================================

ALTER TABLE public.monthly_expenses 
RENAME COLUMN expense_category_id TO regular_expense_id;

-- ============================================================================
-- STEP 2: Update the unique constraint to use new column name
-- ============================================================================

-- Drop old constraint
ALTER TABLE public.monthly_expenses
DROP CONSTRAINT IF EXISTS monthly_expenses_expense_category_id_month_key;

-- Add new constraint with correct column name
ALTER TABLE public.monthly_expenses
ADD CONSTRAINT monthly_expenses_regular_expense_id_month_key 
UNIQUE (regular_expense_id, month);

-- ============================================================================
-- STEP 3: Update indexes
-- ============================================================================

-- The foreign key constraint will automatically be updated by Postgres
-- But let's add a helpful index for the new column name
CREATE INDEX IF NOT EXISTS idx_monthly_expenses_regular_expense 
ON public.monthly_expenses(regular_expense_id);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Column renamed: expense_category_id → regular_expense_id';
  RAISE NOTICE '✅ Unique constraint updated';
  RAISE NOTICE '✅ Index created for regular_expense_id';
  RAISE NOTICE '⚠️ BREAKING CHANGE: Frontend code must be updated to use regular_expense_id';
END $$;
