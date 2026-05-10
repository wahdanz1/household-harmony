-- Subjects: a "belongs to" target for expenses, subscriptions, and insurances.
-- Examples: a household member, a child, a car, a pet. Lets users tag costs
-- so they can answer questions like "what does the Volvo cost per month?".
--
-- Names are stored plaintext (consistent with co_parents); RLS gates access
-- by household membership.

CREATE TABLE public.subjects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text NOT NULL CHECK (type IN ('member', 'car', 'kid', 'pet', 'other')),
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_subjects_household ON public.subjects (household_id, sort_order);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view household subjects"
    ON public.subjects FOR SELECT
    USING (
        household_id IN (
            SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "insert household subjects"
    ON public.subjects FOR INSERT
    WITH CHECK (
        household_id IN (
            SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "update household subjects"
    ON public.subjects FOR UPDATE
    USING (
        household_id IN (
            SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        household_id IN (
            SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "delete household subjects"
    ON public.subjects FOR DELETE
    USING (
        household_id IN (
            SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
        )
    );


ALTER TABLE public.expenses
    ADD COLUMN subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;
ALTER TABLE public.subscriptions
    ADD COLUMN subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;
ALTER TABLE public.insurances
    ADD COLUMN subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;

CREATE INDEX idx_expenses_subject ON public.expenses (subject_id) WHERE subject_id IS NOT NULL;
CREATE INDEX idx_subscriptions_subject ON public.subscriptions (subject_id) WHERE subject_id IS NOT NULL;
CREATE INDEX idx_insurances_subject ON public.insurances (subject_id) WHERE subject_id IS NOT NULL;
