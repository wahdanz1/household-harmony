-- One-off expenses live in monthly_expenses with expense_id NULL and
-- one_time_name + one_time_category populated. Mirrors monthly_incomes.
-- TemporaryExpenseFormDialog previously wrote to the orphan temporary_expenses
-- table; this lets the same data show up on Overview's activity feed.

ALTER TABLE public.monthly_expenses
    ADD COLUMN IF NOT EXISTS one_time_name text,
    ADD COLUMN IF NOT EXISTS one_time_category text;

ALTER TABLE public.monthly_expenses
    ALTER COLUMN expense_id DROP NOT NULL;
