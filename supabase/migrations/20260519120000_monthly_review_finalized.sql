-- Replace the awkward `scope = 'finalized'` row in monthly_review_status with
-- a dedicated table.
--
-- Reason: monthly_review_status was designed for per-user, per-scope
-- acceptances (PK on household_id+user_id+month+scope). Squeezing the
-- household-level "month closed" event into it required CHECK relaxation and
-- left a latent bug where two users tapping Finalize would write two rows for
-- the same (household, month). One finalize event per month per household is
-- the actual invariant; encode it in the PK.
--
-- No data migration is needed: prod has zero scope='finalized' rows (the old
-- CHECK constraint was blocking writes since the table was created).

CREATE TABLE public.monthly_review_finalized (
    household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    month text NOT NULL,
    finalized_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    finalized_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (household_id, month)
);

CREATE INDEX idx_monthly_review_finalized_household
    ON public.monthly_review_finalized (household_id);

ALTER TABLE public.monthly_review_finalized ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view household finalized"
    ON public.monthly_review_finalized FOR SELECT
    USING (
        household_id IN (
            SELECT household_id
            FROM public.household_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "insert household finalized"
    ON public.monthly_review_finalized FOR INSERT
    WITH CHECK (
        household_id IN (
            SELECT household_id
            FROM public.household_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "update household finalized"
    ON public.monthly_review_finalized FOR UPDATE
    USING (
        household_id IN (
            SELECT household_id
            FROM public.household_members
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        household_id IN (
            SELECT household_id
            FROM public.household_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "delete household finalized"
    ON public.monthly_review_finalized FOR DELETE
    USING (
        household_id IN (
            SELECT household_id
            FROM public.household_members
            WHERE user_id = auth.uid()
        )
    );
