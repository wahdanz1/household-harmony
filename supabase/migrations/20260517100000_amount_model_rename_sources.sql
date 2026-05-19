-- Amount model refactor: rename source-level amount columns to `encrypted_budget`.
-- Uniform vocabulary across all source tables; `default_amount` was misleading
-- (it's the budget, not a fallback). See docs/design/amount-model.md.

ALTER TABLE public.income_sources  RENAME COLUMN encrypted_default_amount TO encrypted_budget;
ALTER TABLE public.expenses        RENAME COLUMN encrypted_default_amount TO encrypted_budget;
ALTER TABLE public.subscriptions   RENAME COLUMN encrypted_amount         TO encrypted_budget;
ALTER TABLE public.insurances      RENAME COLUMN encrypted_total_amount   TO encrypted_budget;
