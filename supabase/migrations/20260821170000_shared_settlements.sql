-- Settling up, recorded in the space so both parents see the same history.
--
-- co_parent_settlements stores its money columns — insurance_paid, net_amount,
-- income_received and the rest — as plaintext numbers, while every input that
-- produced them is encrypted. That is backwards: the total is at least as
-- revealing as its parts, and the whole point is that the server holds no
-- readable figures.
--
-- The old table stays for co-parents who hold no account. Once someone is
-- linked there are two parties to a settlement, so it belongs in the space
-- where both can see it.

CREATE TABLE public.shared_settlements (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id   uuid NOT NULL REFERENCES public.coparent_spaces(id) ON DELETE CASCADE,
    -- Plaintext: months are the axis this is queried on, same as elsewhere.
    month      text NOT NULL,
    settled_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    encrypted_net_amount text,
    -- The line items as a JSON blob, so the figures behind a settled month can
    -- be explained later without recomputing from sources that have since moved.
    encrypted_breakdown  text,
    encrypted_notes      text,
    is_encrypted         boolean NOT NULL DEFAULT true,

    settled_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT shared_settlements_unique_month UNIQUE (space_id, month)
);

CREATE INDEX idx_shared_settlements_space_month
    ON public.shared_settlements (space_id, month);

ALTER TABLE public.shared_settlements ENABLE ROW LEVEL SECURITY;

-- Either side records a settlement, because the balance runs both ways and
-- whoever saw the money move is the one who can say so. settled_by keeps the
-- record of which of them marked it, and is forced to the caller so neither
-- can log a payment in the other's name.
CREATE POLICY "Space members read settlements"
    ON public.shared_settlements FOR SELECT
    USING (public.is_coparent_space_member(space_id, (SELECT auth.uid())));

CREATE POLICY "Space members record settlements"
    ON public.shared_settlements FOR INSERT
    WITH CHECK (
        settled_by = (SELECT auth.uid())
        AND public.is_coparent_space_member(space_id, (SELECT auth.uid()))
    );

CREATE POLICY "Space members update settlements"
    ON public.shared_settlements FOR UPDATE
    USING (public.is_coparent_space_member(space_id, (SELECT auth.uid())))
    WITH CHECK (
        settled_by = (SELECT auth.uid())
        AND public.is_coparent_space_member(space_id, (SELECT auth.uid()))
    );

CREATE POLICY "Space members remove settlements"
    ON public.shared_settlements FOR DELETE
    USING (public.is_coparent_space_member(space_id, (SELECT auth.uid())));

DROP TRIGGER IF EXISTS touch_shared_settlement_trg ON public.shared_settlements;
CREATE TRIGGER touch_shared_settlement_trg
    BEFORE UPDATE ON public.shared_settlements
    FOR EACH ROW EXECUTE FUNCTION public.touch_shared_cost_claim();
