-- Link type='member' subjects to the auth user they represent.
--
-- Today members are stored as plain-text name rows with no FK back, so
-- renaming a profile produces a duplicate subject (the old name lingers
-- and a new one is auto-created) and removing a member leaves an orphan
-- subject behind.

ALTER TABLE public.subjects
    ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.subjects s
   SET user_id = (
     SELECT hm.user_id
       FROM public.household_members hm
       JOIN public.profiles p ON p.id = hm.user_id
      WHERE hm.household_id = s.household_id
        AND lower(COALESCE(p.full_name, p.email)) = lower(s.name)
      LIMIT 1
   )
 WHERE s.type = 'member' AND s.user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subjects_member_per_household_user
    ON public.subjects (household_id, user_id)
    WHERE type = 'member' AND user_id IS NOT NULL;
