-- Store only a hash of the co-parent invite code.
--
-- The code is what derives the KEK that wraps the space DEK. Keeping the code
-- in plaintext in the same row as the wrapped key hands anyone with database
-- access both the lock and the key — which is precisely what client-side
-- encryption is meant to prevent.
--
-- A hash is enough to match a redeemer's code, and cannot be turned back into
-- the KEK. The consequence is that a code genuinely cannot be re-displayed
-- after it is issued; re-inviting mints a new one.

-- Canonicalise exactly as the client does before hashing: strip the display
-- grouping, then upper-case. A mismatch here would make every invite
-- unredeemable, since the two sides would hash different strings.
CREATE OR REPLACE FUNCTION public.normalize_space_invite_code_hash(code_in text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
    SELECT encode(
        sha256(convert_to(upper(regexp_replace(code_in, '[^a-zA-Z0-9]', '', 'g')), 'UTF8')),
        'hex'
    );
$$;

-- Only the SECURITY DEFINER lookups need it; nothing calls it directly.
REVOKE ALL ON FUNCTION public.normalize_space_invite_code_hash(text) FROM PUBLIC;

ALTER TABLE public.coparent_space_invites
    ADD COLUMN invite_code_hash text;

UPDATE public.coparent_space_invites
   SET invite_code_hash = public.normalize_space_invite_code_hash(invite_code)
 WHERE invite_code_hash IS NULL;

ALTER TABLE public.coparent_space_invites
    DROP COLUMN invite_code;

ALTER TABLE public.coparent_space_invites
    ALTER COLUMN invite_code_hash SET NOT NULL,
    ADD CONSTRAINT coparent_space_invites_code_hash_key UNIQUE (invite_code_hash);


CREATE OR REPLACE FUNCTION public.lookup_coparent_invite(invite_code_in text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'space_id',      s.id,
        'space_name',    s.name,
        'invited_email', ci.invited_email,
        'invited_by',    (SELECT p.full_name FROM profiles p WHERE p.id = ci.created_by),
        'encrypted_dek', ci.encrypted_dek,
        'dek_iv',        ci.dek_iv,
        'dek_salt',      ci.dek_salt
    )
    FROM coparent_space_invites ci
    JOIN coparent_spaces s ON s.id = ci.space_id
    WHERE ci.invite_code_hash = public.normalize_space_invite_code_hash(invite_code_in)
      AND ci.is_active = true
      AND ci.expires_at > now()
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_coparent_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_coparent_invite(text) TO anon, authenticated;


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
     WHERE invite_code_hash = public.normalize_space_invite_code_hash(invite_code_in)
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
