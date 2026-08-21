-- Two halves of the same story: a co-parent label appearing when someone
-- accepts an invite, and surviving as a plain label when they leave.
--
-- co_parents.id is referenced by insurances, income_sources, shared_expenses
-- and co_parent_settlements. Deleting the row on departure would strand all of
-- it, so leaving degrades the row instead of removing it.

-- Redeeming happens in the joiner's session, which has no RLS access to the
-- inviter's household, so the invite has to carry the household itself.
ALTER TABLE public.coparent_space_invites
    ADD COLUMN household_id uuid REFERENCES public.households(id) ON DELETE CASCADE;

-- Backfill from whichever household the inviter was in when they issued it.
UPDATE public.coparent_space_invites ci
   SET household_id = (
       SELECT hm.household_id
         FROM public.household_members hm
        WHERE hm.user_id = ci.created_by
          AND hm.pending_exit_at IS NULL
        ORDER BY (hm.role = 'owner') DESC
        LIMIT 1
   )
 WHERE household_id IS NULL;

CREATE INDEX idx_coparent_space_invites_household
    ON public.coparent_space_invites (household_id);


-- Accepting an invite now also materialises the co-parent in the inviting
-- household, named from the joiner's profile.
--
-- An existing label keeps whatever name it was given — only the placeholder is
-- replaced, so a deliberate name is never overwritten by a profile value.
CREATE OR REPLACE FUNCTION public.redeem_coparent_invite(invite_code_in text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_invite  public.coparent_space_invites%ROWTYPE;
    v_email   text;
    v_first   text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT *
      INTO v_invite
      FROM public.coparent_space_invites
     WHERE upper(invite_code) = upper(invite_code_in)
       AND is_active = true
       AND expires_at > now()
     LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'invite_not_found';
    END IF;

    SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_user_id;
    IF v_email IS DISTINCT FROM lower(v_invite.invited_email) THEN
        RAISE EXCEPTION 'email_mismatch';
    END IF;

    IF public.is_coparent_space_member(v_invite.space_id, v_user_id) THEN
        RAISE EXCEPTION 'already_member';
    END IF;

    INSERT INTO public.coparent_space_members (space_id, user_id, role)
    VALUES (v_invite.space_id, v_user_id, 'member');

    UPDATE public.coparent_space_invites
       SET status    = 'accepted',
           is_active = false
     WHERE id = v_invite.id;

    IF v_invite.household_id IS NOT NULL THEN
        SELECT NULLIF(split_part(COALESCE(p.full_name, ''), ' ', 1), '')
          INTO v_first
          FROM public.profiles p
         WHERE p.id = v_user_id;
        v_first := COALESCE(v_first, 'Co-parent');

        UPDATE public.co_parents
           SET linked_user_id = v_user_id,
               name = CASE
                          WHEN name IS NULL OR name = '' OR name = 'Other parent'
                              THEN v_first
                          ELSE name
                      END,
               updated_at = now()
         WHERE household_id = v_invite.household_id
           AND space_id     = v_invite.space_id;

        IF NOT FOUND THEN
            INSERT INTO public.co_parents (household_id, name, space_id, linked_user_id)
            VALUES (v_invite.household_id, v_first, v_invite.space_id, v_user_id);
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'space_id',      v_invite.space_id,
        'encrypted_dek', v_invite.encrypted_dek,
        'dek_iv',        v_invite.dek_iv,
        'dek_salt',      v_invite.dek_salt,
        'success',       true
    );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_coparent_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_coparent_invite(text) TO authenticated;


-- Leaving unlinks the account but leaves everything else standing.
--
-- space_id is deliberately kept: the schedule belongs to the household that
-- created it and stays usable alone, and re-inviting later reuses the same
-- space rather than starting an empty second one. Only the account link goes.
CREATE OR REPLACE FUNCTION public.degrade_coparent_on_leave()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    UPDATE public.co_parents
       SET linked_user_id = NULL,
           updated_at     = now()
     WHERE space_id       = OLD.space_id
       AND linked_user_id = OLD.user_id;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS degrade_coparent_on_leave_trg ON public.coparent_space_members;
CREATE TRIGGER degrade_coparent_on_leave_trg
    AFTER DELETE ON public.coparent_space_members
    FOR EACH ROW EXECUTE FUNCTION public.degrade_coparent_on_leave();

REVOKE ALL ON FUNCTION public.degrade_coparent_on_leave() FROM PUBLIC;
