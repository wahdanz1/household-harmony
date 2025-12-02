-- Migration: Add Smart Defaults and Swedish Tax Intelligence
-- Created: 2025-12-02
-- Description: Adds Swedish tax categories and smart defaults functions
-- Prerequisites: Run 20251201235900_rename_expense_category_id.sql first!

-- ============================================================================
-- PART 1: Swedish Tax Intelligence
-- ============================================================================

-- Create tax_type enum for Swedish tax categories
DO $$ BEGIN
  CREATE TYPE public.tax_type AS ENUM (
    'no_tax',          -- Barnbidrag, Försäkringskassan (0% tax)
    'standard_30',     -- UA Kommun fixed rate (30% flat tax)
    'progressive',     -- Regular employment (Swedish tax brackets: 32%/52%)
    'csn_variable'     -- CSN with user-specified rate
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add tax columns to income_sources
ALTER TABLE public.income_sources
ADD COLUMN IF NOT EXISTS tax_type public.tax_type DEFAULT 'progressive',
ADD COLUMN IF NOT EXISTS custom_tax_rate DECIMAL(5,2);

-- Add comments
COMMENT ON COLUMN public.income_sources.tax_type IS 
'Swedish tax category: no_tax (government benefits), standard_30 (UA Kommun 30%), progressive (Swedish brackets 32%/52%), csn_variable (user-specified rate)';

COMMENT ON COLUMN public.income_sources.custom_tax_rate IS 
'Custom tax rate percentage for CSN variable tax type. E.g., 25.5 for 25.5% tax rate.';

-- ============================================================================
-- PART 2: Smart Defaults Functions
-- ============================================================================

-- Function: Calculate 3-month average for dynamic expenses
CREATE OR REPLACE FUNCTION public.calculate_expense_average(
  p_household_id UUID,
  p_regular_expense_id UUID,
  p_months INTEGER DEFAULT 3
)
RETURNS DECIMAL AS $$
DECLARE
  avg_amount DECIMAL;
BEGIN
  SELECT AVG(amount)
  INTO avg_amount
  FROM public.monthly_expenses
  WHERE household_id = p_household_id
    AND regular_expense_id = p_regular_expense_id
    AND month >= (CURRENT_DATE - (p_months || ' months')::INTERVAL)
  LIMIT p_months;
  
  RETURN COALESCE(avg_amount, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Calculate 3-month average for variable income
CREATE OR REPLACE FUNCTION public.calculate_income_average(
  p_household_id UUID,
  p_income_source_id UUID,
  p_months INTEGER DEFAULT 3
)
RETURNS DECIMAL AS $$
DECLARE
  avg_amount DECIMAL;
BEGIN
  SELECT AVG(amount)
  INTO avg_amount
  FROM public.monthly_incomes
  WHERE household_id = p_household_id
    AND income_source_id = p_income_source_id
    AND month >= (CURRENT_DATE - (p_months || ' months')::INTERVAL)
  LIMIT p_months;
  
  RETURN COALESCE(avg_amount, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get most recent expense amount (for static expenses)
CREATE OR REPLACE FUNCTION public.get_latest_expense_amount(
  p_household_id UUID,
  p_regular_expense_id UUID
)
RETURNS DECIMAL AS $$
DECLARE
  latest_amount DECIMAL;
BEGIN
  SELECT amount
  INTO latest_amount
  FROM public.monthly_expenses
  WHERE household_id = p_household_id
    AND regular_expense_id = p_regular_expense_id
  ORDER BY month DESC
  LIMIT 1;
  
  RETURN COALESCE(latest_amount, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get most recent income amount (for static income)
CREATE OR REPLACE FUNCTION public.get_latest_income_amount(
  p_household_id UUID,
  p_income_source_id UUID
)
RETURNS DECIMAL AS $$
DECLARE
  latest_amount DECIMAL;
BEGIN
  SELECT amount
  INTO latest_amount
  FROM public.monthly_incomes
  WHERE household_id = p_household_id
    AND income_source_id = p_income_source_id
  ORDER BY month DESC
  LIMIT 1;
  
  RETURN COALESCE(latest_amount, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 3: Set Tax Types for Existing Income Sources
-- ============================================================================

-- Set tax types for common income sources
UPDATE public.income_sources
SET tax_type = 'no_tax'
WHERE name ILIKE '%barnbidrag%'
   OR name ILIKE '%child care%'
   OR name ILIKE '%försäkringskassan%'
   OR category = 'government_benefits';

UPDATE public.income_sources
SET tax_type = 'csn_variable',
    custom_tax_rate = 30.0  -- Default to 30%, user can adjust
WHERE name ILIKE '%csn%'
   OR name ILIKE '%studiemedel%';

UPDATE public.income_sources
SET tax_type = 'standard_30'
WHERE name ILIKE '%kommun%'
   OR name ILIKE '%uddevalla%';

-- ============================================================================
-- PART 4: Add Indexes for Performance
-- ============================================================================

-- Indexes for smart defaults queries
CREATE INDEX IF NOT EXISTS idx_monthly_expenses_household_month 
ON public.monthly_expenses(household_id, month DESC);

CREATE INDEX IF NOT EXISTS idx_monthly_incomes_household_month 
ON public.monthly_incomes(household_id, month DESC);

CREATE INDEX IF NOT EXISTS idx_regular_expenses_household_type 
ON public.regular_expenses(household_id, type);

CREATE INDEX IF NOT EXISTS idx_income_sources_household_type 
ON public.income_sources(household_id, type);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Swedish Tax Intelligence migration complete!';
  RAISE NOTICE '✅ Smart Defaults functions created!';
  RAISE NOTICE '📊 New columns: tax_type, custom_tax_rate on income_sources';
  RAISE NOTICE '🔧 Functions: calculate_expense_average(), calculate_income_average()';
  RAISE NOTICE '🔧 Functions: get_latest_expense_amount(), get_latest_income_amount()';
  RAISE NOTICE '📝 Note: expense_type and income_type already exist as enums';
END $$;