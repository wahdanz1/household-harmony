-- Tighten RLS by dropping permissive policies and routing pre-auth /
-- cross-household reads through SECURITY DEFINER RPCs.

DROP POLICY IF EXISTS "Allow viewing all households" ON public.households;
DROP POLICY IF EXISTS "Allow creating households for removed members" ON public.households;
DROP POLICY IF EXISTS "Users can view households with valid invites" ON public.households;

DROP POLICY IF EXISTS "Anyone can view pending invites by code" ON public.household_invites;

DROP POLICY IF EXISTS "Allow signup with valid invite" ON public.household_members;
DROP POLICY IF EXISTS "Users can view members via valid invite" ON public.household_members;

DROP POLICY IF EXISTS "Users can view profiles via valid invite" ON public.profiles;

DROP POLICY IF EXISTS "Allow public read access" ON public.email_whitelist;

CREATE POLICY "Users can delete their own merchant mappings"
    ON public.merchant_categories FOR DELETE
    USING (auth.uid() = user_id);


-- Returns the household preview for a known invite code. Encryption columns
-- are deliberately excluded from the projection.
CREATE OR REPLACE FUNCTION public.lookup_active_invite(invite_code_in text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'household_id', h.id,
        'household_name', h.name,
        'household_currency', h.currency,
        'invited_email', hi.invited_email,
        'members', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'role', hm.role,
                    'full_name', p.full_name,
                    'avatar_url', p.avatar_url
                )
                ORDER BY hm.joined_at
            )
            FROM household_members hm
            LEFT JOIN profiles p ON p.id = hm.user_id
            WHERE hm.household_id = h.id
        ), '[]'::jsonb)
    )
    FROM household_invites hi
    JOIN households h ON h.id = hi.household_id
    WHERE upper(hi.invite_code) = upper(invite_code_in)
      AND hi.is_active = true
      AND hi.expires_at > now()
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_active_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_active_invite(text) TO anon, authenticated;


-- Atomically validates an invite (active, not expired, email-lock matches the
-- caller), inserts the membership, and marks the invite consumed.
--
-- Errors:
--   not_authenticated  — no session
--   invite_not_found   — wrong/expired/inactive code
--   email_mismatch     — invite is email-locked to a different address
--   already_member     — caller already belongs to the household
CREATE OR REPLACE FUNCTION public.redeem_invite(invite_code_in text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user_id  uuid := auth.uid();
    v_invite   public.household_invites%ROWTYPE;
    v_email    text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT *
      INTO v_invite
      FROM public.household_invites
     WHERE upper(invite_code) = upper(invite_code_in)
       AND is_active = true
       AND expires_at > now()
     LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'invite_not_found';
    END IF;

    IF v_invite.invited_email IS NOT NULL THEN
        SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_user_id;
        IF v_email IS DISTINCT FROM lower(v_invite.invited_email) THEN
            RAISE EXCEPTION 'email_mismatch';
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1
          FROM public.household_members
         WHERE household_id = v_invite.household_id
           AND user_id      = v_user_id
    ) THEN
        RAISE EXCEPTION 'already_member';
    END IF;

    INSERT INTO public.household_members (household_id, user_id, role)
    VALUES (v_invite.household_id, v_user_id, 'member');

    UPDATE public.household_invites
       SET status    = 'accepted',
           is_active = false
     WHERE id = v_invite.id;

    RETURN jsonb_build_object(
        'household_id', v_invite.household_id,
        'success',      true
    );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_invite(text) TO authenticated;


CREATE OR REPLACE FUNCTION public.is_email_whitelisted(email_in text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.email_whitelist
         WHERE lower(email) = lower(email_in)
    );
$$;

REVOKE ALL ON FUNCTION public.is_email_whitelisted(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_email_whitelisted(text) TO anon, authenticated;
