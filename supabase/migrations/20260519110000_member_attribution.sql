-- Add a parallel attribution target: a specific household member (in addition
-- to the existing subject_id for cars / kids / pets / other). The picker
-- (AttributionPicker) writes to exactly one of {member_id, subject_id} per row;
-- the CHECK constraint enforces that they're never both set.
--
-- ON DELETE SET NULL on member_id mirrors the existing subject_id behavior:
-- if a member's row is hard-deleted (after confirm_member_exit), referencing
-- rows lose the tag rather than cascading. (Soft-archive via archived_at on
-- the source row is handled separately by the take-with-me flow.)

ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.household_members(id) ON DELETE SET NULL,
    ADD CONSTRAINT expenses_one_attribution
        CHECK (member_id IS NULL OR subject_id IS NULL);

ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.household_members(id) ON DELETE SET NULL,
    ADD CONSTRAINT subscriptions_one_attribution
        CHECK (member_id IS NULL OR subject_id IS NULL);

ALTER TABLE public.insurances
    ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.household_members(id) ON DELETE SET NULL,
    ADD CONSTRAINT insurances_one_attribution
        CHECK (member_id IS NULL OR subject_id IS NULL);
