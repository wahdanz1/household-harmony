-- Rename households.created_by → owner_id.
--
-- Three things were drifting around this column:
--   1. The FK constraint is already named households_owner_id_fkey but the
--      column was created_by, so types.ts mislabels it.
--   2. The Household interface in HouseholdContext.tsx uses owner_id, so
--      app code that reaches into household.owner_id has been undefined.
--   3. AuthContext.signUpAndJoinHousehold queries .eq("owner_id", ...) and
--      the create_default_household trigger inserts INTO households(owner_id).
--      Both have been silently failing — new signups don't get a fallback
--      household, and invite-flow cleanup of fallbacks no-ops.
--
-- After this rename: all three work as originally intended.

ALTER TABLE public.households RENAME COLUMN created_by TO owner_id;

-- Re-declare the trigger function so PG re-parses it against the new name.
-- The function body itself is unchanged from the schema dump — just
-- refreshed so its plan cache picks up the rename.
CREATE OR REPLACE FUNCTION public.create_default_household() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
AS $$
DECLARE
    user_metadata jsonb;
BEGIN
    IF EXISTS (SELECT 1 FROM household_members WHERE user_id = NEW.id) THEN
        RETURN NEW;
    END IF;

    SELECT raw_user_meta_data INTO user_metadata
    FROM auth.users
    WHERE id = NEW.id;

    IF (user_metadata->>'skip_default_household')::boolean = true THEN
        RETURN NEW;
    END IF;

    INSERT INTO households (name, currency, owner_id)
    VALUES (
        COALESCE(NEW.full_name, 'My Household') || '''s Household',
        'SEK',
        NEW.id
    );

    INSERT INTO household_members (household_id, user_id, role)
    VALUES (
        (SELECT id FROM households WHERE owner_id = NEW.id ORDER BY created_at DESC LIMIT 1),
        NEW.id,
        'owner'
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error creating default household for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;
