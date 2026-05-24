-- One-off expenses live only in monthly_expenses (no parent expenses row), so
-- they had nowhere to store a "Belongs to" tag. Mirror the attribution columns
-- the source tables already carry: exactly one of {member_id, subject_id}.
-- ON DELETE SET NULL so removing a member/subject untags rather than deletes.

ALTER TABLE public.monthly_expenses
    ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.household_members(id) ON DELETE SET NULL,
    ADD CONSTRAINT monthly_expenses_one_attribution
        CHECK (member_id IS NULL OR subject_id IS NULL);
