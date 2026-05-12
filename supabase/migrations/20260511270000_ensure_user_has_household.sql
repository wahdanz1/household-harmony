-- Fallback for users who end up with zero household memberships (e.g.
-- invited-only signup followed by removal). Creates a personal household
-- on demand so login can recover instead of returning an unlockable vault.

CREATE OR REPLACE FUNCTION public.ensure_user_has_household()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user_id      uuid := auth.uid();
    v_existing     uuid;
    v_household_id uuid;
    v_full_name    text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT household_id INTO v_existing
      FROM public.household_members
     WHERE user_id = v_user_id
     LIMIT 1;
    IF v_existing IS NOT NULL THEN
        RETURN v_existing;
    END IF;

    SELECT NULLIF(trim(full_name), '') INTO v_full_name
      FROM public.profiles
     WHERE id = v_user_id;

    INSERT INTO public.households (name, currency, owner_id)
    VALUES (COALESCE(v_full_name, 'My') || '''s Household', 'SEK', v_user_id)
    RETURNING id INTO v_household_id;

    INSERT INTO public.household_members (household_id, user_id, role)
    VALUES (v_household_id, v_user_id, 'owner');

    RETURN v_household_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_has_household() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_user_has_household() TO authenticated;
