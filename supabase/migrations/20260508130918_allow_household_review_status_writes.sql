-- Allow any household member to write monthly_review_status rows on behalf
-- of any other member of the same household.
--
-- Rationale: the agreed Monthly Review flow lets one user (e.g. Daniel) sit
-- with their spouse (Sarah) and accept her income on her behalf — they're
-- looking at the values together on one device. The previous policy only
-- allowed user_id = auth.uid(), which forced Sarah to log in separately
-- just to click "Accept" on values Daniel had already entered for her.
--
-- The household_id check still prevents writing rows into other households.

DROP POLICY IF EXISTS "insert own review status" ON public.monthly_review_status;
DROP POLICY IF EXISTS "update own review status" ON public.monthly_review_status;
DROP POLICY IF EXISTS "delete own review status" ON public.monthly_review_status;

CREATE POLICY "insert household review status"
    ON public.monthly_review_status FOR INSERT
    WITH CHECK (
        household_id IN (
            SELECT household_id
            FROM public.household_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "update household review status"
    ON public.monthly_review_status FOR UPDATE
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

CREATE POLICY "delete household review status"
    ON public.monthly_review_status FOR DELETE
    USING (
        household_id IN (
            SELECT household_id
            FROM public.household_members
            WHERE user_id = auth.uid()
        )
    );
