-- Drop static/dynamic/variable type columns and enums.
-- These were pre-declared hints for auto-fill behavior, but the app now
-- uses data-driven carry-forward (use last month's actual value) which
-- works the same regardless of type. The distinction added friction
-- without value.

-- Drop indexes that reference the type columns
DROP INDEX IF EXISTS public.idx_income_sources_household_type;
DROP INDEX IF EXISTS public.idx_regular_expenses_household_type;

-- Drop the type columns
ALTER TABLE public.income_sources DROP COLUMN IF EXISTS type;
ALTER TABLE public.expenses DROP COLUMN IF EXISTS type;

-- Drop the enums (no more references after column drops)
DROP TYPE IF EXISTS public.expense_type;
DROP TYPE IF EXISTS public.income_type;
