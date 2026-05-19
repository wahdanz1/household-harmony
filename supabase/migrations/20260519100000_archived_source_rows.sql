-- Distinguish "user paused this" (is_active=false, kept visible-but-grayed in
-- lists) from "leaving member took this with them" (archived_at IS NOT NULL,
-- gone from live UI entirely but still resolvable via JOIN for history).
--
-- Without this separation, the bring-items "take with me" flow would have to
-- reuse is_active=false and break the existing pause-an-item UX.

ALTER TABLE public.income_sources
    ADD COLUMN IF NOT EXISTS archived_at timestamptz,
    ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id);

ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS archived_at timestamptz,
    ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id);

ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS archived_at timestamptz,
    ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id);

ALTER TABLE public.insurances
    ADD COLUMN IF NOT EXISTS archived_at timestamptz,
    ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id);

-- Partial indices speed up the dominant query pattern: "live items in this
-- household." Excluding archived rows from the index keeps it small even as
-- archived rows accumulate over time.
CREATE INDEX IF NOT EXISTS idx_income_sources_household_live
    ON public.income_sources (household_id)
    WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_household_live
    ON public.expenses (household_id)
    WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_household_live
    ON public.subscriptions (household_id)
    WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_insurances_household_live
    ON public.insurances (household_id)
    WHERE archived_at IS NULL;
