-- Costs published to a co-parent.
--
-- A claim is a statement, not a mirror of a household row: "this cost exists,
-- this is the split". That framing is why there is nothing to reconcile — the
-- publisher's own insurance stays where it is, under the household key, and
-- only what the co-parent needs crosses the boundary.
--
-- Two levels, matching the split the household side already draws:
--   shared_cost_claims        — the standing arrangement, always current
--   shared_cost_claim_months  — what was actually paid in one month
--
-- Both are needed. The arrangement alone would let a price change in June
-- silently rewrite January, and the settlement is reckoned per month.

CREATE TYPE public.shared_cost_source AS ENUM ('insurance', 'income', 'expense');

CREATE TABLE public.shared_cost_claims (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id      uuid NOT NULL REFERENCES public.coparent_spaces(id) ON DELETE CASCADE,
    -- The publishing household, so a claim can be traced back and withdrawn.
    household_id  uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    published_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    source_kind   public.shared_cost_source NOT NULL,
    -- Row this was published from, in the publisher's household. Nullable so a
    -- one-off cost with no template can still be claimed.
    source_id     uuid,

    encrypted_label            text,
    -- Which kid. The name, not subjects.id — that id is household-scoped and
    -- means nothing on the other side.
    encrypted_subject          text,
    encrypted_amount           text,
    encrypted_share_percentage text,

    -- Plaintext because it says how to read the amount, not what it is.
    billing_cycle text,
    is_active     boolean NOT NULL DEFAULT true,
    is_encrypted  boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),

    -- One claim per source item per space; publishing again updates in place.
    CONSTRAINT shared_cost_claims_unique_source UNIQUE (space_id, source_kind, source_id)
);

CREATE INDEX idx_shared_cost_claims_space ON public.shared_cost_claims (space_id);

CREATE TABLE public.shared_cost_claim_months (
    id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id  uuid NOT NULL REFERENCES public.shared_cost_claims(id) ON DELETE CASCADE,
    -- Denormalised so RLS can check membership without joining the parent.
    space_id  uuid NOT NULL REFERENCES public.coparent_spaces(id) ON DELETE CASCADE,
    -- Plaintext: month ranges are queried, same reasoning as handover times.
    month     text NOT NULL,

    encrypted_amount text,
    is_encrypted     boolean NOT NULL DEFAULT true,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT shared_cost_claim_months_unique UNIQUE (claim_id, month)
);

CREATE INDEX idx_shared_cost_claim_months_space_month
    ON public.shared_cost_claim_months (space_id, month);


ALTER TABLE public.shared_cost_claims       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_cost_claim_months ENABLE ROW LEVEL SECURITY;


-- Both sides read everything in the space — the whole point is a shared view.
-- Writing is restricted to whoever published, so neither parent can silently
-- restate the other's costs.
CREATE POLICY "Space members read claims"
    ON public.shared_cost_claims FOR SELECT
    USING (public.is_coparent_space_member(space_id, (SELECT auth.uid())));

CREATE POLICY "Members publish their own claims"
    ON public.shared_cost_claims FOR INSERT
    WITH CHECK (
        published_by = (SELECT auth.uid())
        AND public.is_coparent_space_member(space_id, (SELECT auth.uid()))
    );

CREATE POLICY "Publishers update their own claims"
    ON public.shared_cost_claims FOR UPDATE
    USING (published_by = (SELECT auth.uid()))
    WITH CHECK (published_by = (SELECT auth.uid()));

CREATE POLICY "Publishers withdraw their own claims"
    ON public.shared_cost_claims FOR DELETE
    USING (published_by = (SELECT auth.uid()));


CREATE POLICY "Space members read claim months"
    ON public.shared_cost_claim_months FOR SELECT
    USING (public.is_coparent_space_member(space_id, (SELECT auth.uid())));

CREATE POLICY "Publishers add claim months"
    ON public.shared_cost_claim_months FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.shared_cost_claims c
             WHERE c.id = claim_id
               AND c.published_by = (SELECT auth.uid())
        )
    );

CREATE POLICY "Publishers update claim months"
    ON public.shared_cost_claim_months FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.shared_cost_claims c
             WHERE c.id = claim_id
               AND c.published_by = (SELECT auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.shared_cost_claims c
             WHERE c.id = claim_id
               AND c.published_by = (SELECT auth.uid())
        )
    );

CREATE POLICY "Publishers delete claim months"
    ON public.shared_cost_claim_months FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.shared_cost_claims c
             WHERE c.id = claim_id
               AND c.published_by = (SELECT auth.uid())
        )
    );


CREATE OR REPLACE FUNCTION public.touch_shared_cost_claim()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_shared_cost_claim_trg ON public.shared_cost_claims;
CREATE TRIGGER touch_shared_cost_claim_trg
    BEFORE UPDATE ON public.shared_cost_claims
    FOR EACH ROW EXECUTE FUNCTION public.touch_shared_cost_claim();

DROP TRIGGER IF EXISTS touch_shared_cost_claim_month_trg ON public.shared_cost_claim_months;
CREATE TRIGGER touch_shared_cost_claim_month_trg
    BEFORE UPDATE ON public.shared_cost_claim_months
    FOR EACH ROW EXECUTE FUNCTION public.touch_shared_cost_claim();
