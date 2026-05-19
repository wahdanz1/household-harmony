-- Amount model refactor: add audit columns for mid-month source.budget edits
-- and mid-month actual recording. Columns stay NULL until consumer UIs land
-- (Review badges, "Mark paid" affordance). See docs/design/amount-model.md.

ALTER TABLE public.monthly_incomes
    ADD COLUMN IF NOT EXISTS encrypted_previous_budget_snapshot text,
    ADD COLUMN IF NOT EXISTS budget_changed_at timestamptz,
    ADD COLUMN IF NOT EXISTS actual_recorded_at timestamptz;

ALTER TABLE public.monthly_expenses
    ADD COLUMN IF NOT EXISTS encrypted_previous_budget_snapshot text,
    ADD COLUMN IF NOT EXISTS budget_changed_at timestamptz,
    ADD COLUMN IF NOT EXISTS actual_recorded_at timestamptz;
