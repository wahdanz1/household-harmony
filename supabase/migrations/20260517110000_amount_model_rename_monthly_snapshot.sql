-- Amount model refactor: rename per-month budget column to `encrypted_budget_snapshot`.
-- Reflects its new role: a system-managed frozen value of source.budget at month-open,
-- never user-edited directly. See docs/design/amount-model.md.

ALTER TABLE public.monthly_incomes  RENAME COLUMN encrypted_budget_amount TO encrypted_budget_snapshot;
ALTER TABLE public.monthly_expenses RENAME COLUMN encrypted_budget_amount TO encrypted_budget_snapshot;
