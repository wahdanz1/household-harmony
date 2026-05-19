-- Distinguish self-initiated soft-exits (the user chose to leave / accepted an
-- invite that auto-leaves their current household) from owner-initiated removals.
-- Without this, the realtime listener that watches `pending_exit_at` can't tell
-- whether to surface the destructive "You've been removed" toast or stay quiet.

ALTER TABLE public.household_members
    ADD COLUMN IF NOT EXISTS pending_exit_initiated_by uuid REFERENCES auth.users(id);

-- request_member_exit now records who triggered the exit. Both self-leave and
-- owner-removal paths go through this function, so the only thing we need is
-- auth.uid() at the moment of the call.
CREATE OR REPLACE FUNCTION public.request_member_exit(member_id_in uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user_id   uuid := auth.uid();
    v_target    public.household_members%ROWTYPE;
    v_is_owner  boolean;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT * INTO v_target FROM public.household_members WHERE id = member_id_in;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'member_not_found';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.households
         WHERE id = v_target.household_id AND owner_id = v_user_id
    ) INTO v_is_owner;

    IF v_target.user_id <> v_user_id AND NOT v_is_owner THEN
        RAISE EXCEPTION 'not_authorized';
    END IF;

    IF v_target.role = 'owner' AND v_target.user_id = v_user_id THEN
        IF EXISTS (
            SELECT 1 FROM public.household_members
             WHERE household_id = v_target.household_id
               AND user_id <> v_user_id
        ) THEN
            RAISE EXCEPTION 'owner_must_transfer_first';
        END IF;
    END IF;

    UPDATE public.household_members
       SET pending_exit_at         = now(),
           pending_exit_initiated_by = v_user_id
     WHERE id = member_id_in
       AND pending_exit_at IS NULL;
END;
$$;

-- handle_owner_leave is always self-initiated by the leaving owner.
CREATE OR REPLACE FUNCTION public.handle_owner_leave(successor_user_id_in uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user_id        uuid := auth.uid();
    v_household_id   uuid;
    v_successor_ok   boolean;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT id INTO v_household_id
      FROM public.households
     WHERE owner_id = v_user_id
     LIMIT 1;

    IF v_household_id IS NULL THEN
        RAISE EXCEPTION 'not_owner';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.household_members
         WHERE household_id    = v_household_id
           AND user_id         = successor_user_id_in
           AND user_id        <> v_user_id
           AND pending_exit_at IS NULL
    ) INTO v_successor_ok;

    IF NOT v_successor_ok THEN
        RAISE EXCEPTION 'invalid_successor';
    END IF;

    UPDATE public.households
       SET owner_id = successor_user_id_in
     WHERE id = v_household_id;

    UPDATE public.household_members
       SET role = 'owner'
     WHERE household_id = v_household_id
       AND user_id      = successor_user_id_in;

    UPDATE public.household_members
       SET role                       = 'member',
           pending_exit_at            = now(),
           pending_exit_initiated_by  = v_user_id
     WHERE household_id = v_household_id
       AND user_id      = v_user_id;
END;
$$;
