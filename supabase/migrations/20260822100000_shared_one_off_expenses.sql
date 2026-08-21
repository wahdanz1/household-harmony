-- Sharing for one-off expenses, so the co-parent tab can be retired.
--
-- Winter boots for the kids get split; rent, electricity and internet never do.
-- That is why `expenses` — the recurring templates — has no sharing columns and
-- is not getting any. Only the one-off rows in monthly_expenses can be shared,
-- and the CHECK below states that rather than leaving it to convention.
--
-- The legacy `shared_expenses` table is deliberately left in place. It supports
-- "they paid it", which a row in this household's own ledger cannot represent —
-- that case is a claim published from their side, which needs them to hold an
-- account. Existing rows stay readable and keep counting towards settlements;
-- nothing new is written there once the tab is gone.

ALTER TABLE public.monthly_expenses
    ADD COLUMN is_shared        boolean NOT NULL DEFAULT false,
    ADD COLUMN co_parent_id     uuid REFERENCES public.co_parents(id) ON DELETE SET NULL,
    ADD COLUMN share_percentage numeric,
    -- expense_id IS NULL is what makes a row a one-off rather than a month of
    -- a recurring template.
    ADD CONSTRAINT monthly_expenses_only_one_offs_shared
        CHECK (NOT is_shared OR expense_id IS NULL);

CREATE INDEX idx_monthly_expenses_shared
    ON public.monthly_expenses (household_id, co_parent_id)
    WHERE is_shared = true;
