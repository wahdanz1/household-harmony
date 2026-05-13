-- Remove the 'member' subject type entirely.
--
-- Household members are tracked in household_members; the Subjects UX no
-- longer surfaces 'People', so member-typed subject rows are pure redundancy
-- (active duplicates of household members + orphans from removed members).
-- The frontend SubjectPicker was auto-syncing them on every render, which
-- kept regenerating duplicates. Both the sync and the rows are going away.
--
-- expenses/subscriptions/insurances.subject_id is ON DELETE SET NULL, so any
-- rows tagged to a deleted member subject just lose the tag — no orphans.

DELETE FROM public.subjects WHERE type = 'member';

-- The unique-per-user index only applied to member-typed rows.
DROP INDEX IF EXISTS public.subjects_member_per_household_user;

-- Tighten the type CHECK constraint to disallow new 'member' rows.
ALTER TABLE public.subjects DROP CONSTRAINT subjects_type_check;
ALTER TABLE public.subjects
    ADD CONSTRAINT subjects_type_check
    CHECK (type IN ('car', 'kid', 'pet', 'other'));
