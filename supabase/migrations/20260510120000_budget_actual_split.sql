-- Split per-month amounts into budget vs actual for variance tracking.
-- The legacy `encrypted_amount` column stays for now as a graceful read
-- fallback; a follow-up migration drops it once all data is on the new
-- columns.

ALTER TABLE public.monthly_expenses
    ADD COLUMN IF NOT EXISTS encrypted_budget_amount text,
    ADD COLUMN IF NOT EXISTS encrypted_actual_amount text;

ALTER TABLE public.monthly_incomes
    ADD COLUMN IF NOT EXISTS encrypted_budget_amount text,
    ADD COLUMN IF NOT EXISTS encrypted_actual_amount text;

CREATE INDEX IF NOT EXISTS idx_monthly_expenses_household_month
    ON public.monthly_expenses (household_id, month);

CREATE INDEX IF NOT EXISTS idx_monthly_incomes_household_month
    ON public.monthly_incomes (household_id, month);
