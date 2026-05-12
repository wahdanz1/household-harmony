-- Guards the unlock auto-init path: the client must not fork a household's
-- DEK by initialising a fresh one while another member's wrap still exists.

CREATE OR REPLACE FUNCTION public.household_has_any_vault_keys(household_id_in uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM public.user_vault_keys
         WHERE household_id = household_id_in
    );
$$;

REVOKE ALL ON FUNCTION public.household_has_any_vault_keys(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.household_has_any_vault_keys(uuid) TO authenticated;
