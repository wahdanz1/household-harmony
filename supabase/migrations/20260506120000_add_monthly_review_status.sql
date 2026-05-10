-- Track per-user, per-month acceptance state for the Monthly Review wizard.
-- Replaces the per-device localStorage flag so that "review complete" is
-- a household-wide signal, not a single browser's memory.
--
-- Each household member writes one row per scope (income/expenses) when they
-- accept that section for a given financial month. The wizard reads these
-- rows to decide whether the Finalize button is enabled and to show
-- "waiting on <name>" status when not.

CREATE TABLE public.monthly_review_status (
    household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month text NOT NULL,
    scope text NOT NULL CHECK (scope IN ('income', 'expenses')),
    accepted_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (household_id, user_id, month, scope)
);

CREATE INDEX idx_monthly_review_status_household_month
    ON public.monthly_review_status (household_id, month);

ALTER TABLE public.monthly_review_status ENABLE ROW LEVEL SECURITY;

-- View: any active household member can see review status for their household.
CREATE POLICY "view household review status"
    ON public.monthly_review_status FOR SELECT
    USING (
        household_id IN (
            SELECT household_id
            FROM public.household_members
            WHERE user_id = auth.uid()
        )
    );

-- Insert: only as yourself, only into a household you belong to.
CREATE POLICY "insert own review status"
    ON public.monthly_review_status FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND household_id IN (
            SELECT household_id
            FROM public.household_members
            WHERE user_id = auth.uid()
        )
    );

-- Update: re-accepting overwrites accepted_at.
CREATE POLICY "update own review status"
    ON public.monthly_review_status FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Delete: allow undoing acceptance (e.g. if user wants to re-review).
CREATE POLICY "delete own review status"
    ON public.monthly_review_status FOR DELETE
    USING (user_id = auth.uid());
