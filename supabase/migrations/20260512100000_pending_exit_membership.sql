-- Multi-household exit flow: a member is "soft-removed" by setting
-- pending_exit_at. While that flag is set their vault key + membership stay
-- alive so the client can run the duplication dialog. Hard-delete happens
-- when the user confirms the dialog (confirm_member_exit) or the backstop
-- job sweeps after the grace period.

ALTER TABLE public.household_members
    ADD COLUMN IF NOT EXISTS pending_exit_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_household_members_pending_exit_at
    ON public.household_members (pending_exit_at)
    WHERE pending_exit_at IS NOT NULL;

-- Helper for future RLS hardening / queries that want to exclude soft-removed
-- members from "active" sets.
CREATE OR REPLACE FUNCTION public.is_active_household_member(_user_id uuid, _household_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM public.household_members
         WHERE user_id        = _user_id
           AND household_id   = _household_id
           AND pending_exit_at IS NULL
    );
$$;

REVOKE ALL ON FUNCTION public.is_active_household_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_household_member(uuid, uuid) TO authenticated;


-- request_member_exit: caller (household owner or the member themselves)
-- marks a membership as pending exit. Vault key + membership stay valid.
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

    -- Self-leave OR household owner removing someone else.
    IF v_target.user_id <> v_user_id AND NOT v_is_owner THEN
        RAISE EXCEPTION 'not_authorized';
    END IF;

    -- Don't let the household's owner exit while other members still depend
    -- on them — successor must be promoted first via handle_owner_leave.
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
       SET pending_exit_at = now()
     WHERE id = member_id_in
       AND pending_exit_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.request_member_exit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_member_exit(uuid) TO authenticated;


-- confirm_member_exit: caller finalizes their own pending exit. Hard-deletes
-- the membership (revoke_member_vault_key_trg drops the vault key). If the
-- household is left empty, it's also deleted.
CREATE OR REPLACE FUNCTION public.confirm_member_exit()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user_id      uuid := auth.uid();
    v_household_id uuid;
    v_remaining    integer;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT household_id INTO v_household_id
      FROM public.household_members
     WHERE user_id = v_user_id
       AND pending_exit_at IS NOT NULL
     LIMIT 1;

    IF v_household_id IS NULL THEN
        RAISE EXCEPTION 'no_pending_exit';
    END IF;

    DELETE FROM public.household_members
     WHERE user_id      = v_user_id
       AND household_id = v_household_id;

    SELECT count(*) INTO v_remaining
      FROM public.household_members
     WHERE household_id = v_household_id;

    IF v_remaining = 0 THEN
        DELETE FROM public.households WHERE id = v_household_id;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_member_exit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_member_exit() TO authenticated;


-- handle_owner_leave: owner promotes a successor and sets pending_exit on
-- their own membership in one atomic step.
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
       SET role            = 'member',
           pending_exit_at = now()
     WHERE household_id = v_household_id
       AND user_id      = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_owner_leave(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_owner_leave(uuid) TO authenticated;


-- Backstop: hard-delete memberships whose grace period (30 days) has passed.
-- Intended to be invoked by pg_cron; safe to run manually too.
CREATE OR REPLACE FUNCTION public.sweep_pending_exits()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_cnt integer;
BEGIN
    WITH deleted AS (
        DELETE FROM public.household_members
         WHERE pending_exit_at IS NOT NULL
           AND pending_exit_at < now() - interval '30 days'
         RETURNING household_id
    ),
    emptied AS (
        SELECT household_id FROM deleted
         WHERE NOT EXISTS (
            SELECT 1 FROM public.household_members hm
             WHERE hm.household_id = deleted.household_id
         )
    )
    DELETE FROM public.households WHERE id IN (SELECT household_id FROM emptied);

    GET DIAGNOSTICS v_cnt = ROW_COUNT;
    RETURN v_cnt;
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_pending_exits() FROM PUBLIC;
-- Not granted to authenticated: invoked by service role / pg_cron only.
