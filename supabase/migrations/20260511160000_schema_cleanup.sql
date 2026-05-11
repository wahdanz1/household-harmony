-- Schema cleanup pass after the May 2026 audit.
--
-- 1. Promote any still-legacy encrypted_amount values to encrypted_budget_amount
--    on monthly_expenses / monthly_incomes, then drop the legacy column.
-- 2. Drop households.custom_month_start_day (never referenced; superseded by
--    financial_month_start).
-- 3. Drop unused tables: one_time_incomes (replaced by monthly_incomes rows
--    with income_source_id NULL + one_time_name), savings_goals,
--    savings_allocations (UI never built).

UPDATE public.monthly_expenses
   SET encrypted_budget_amount = encrypted_amount
 WHERE encrypted_budget_amount IS NULL
   AND encrypted_amount IS NOT NULL;

UPDATE public.monthly_incomes
   SET encrypted_budget_amount = encrypted_amount
 WHERE encrypted_budget_amount IS NULL
   AND encrypted_amount IS NOT NULL;

ALTER TABLE public.monthly_expenses DROP COLUMN IF EXISTS encrypted_amount;
ALTER TABLE public.monthly_incomes  DROP COLUMN IF EXISTS encrypted_amount;

ALTER TABLE public.households DROP COLUMN IF EXISTS custom_month_start_day;

DROP TABLE IF EXISTS public.one_time_incomes;
DROP TABLE IF EXISTS public.savings_allocations;
DROP TABLE IF EXISTS public.savings_goals;
