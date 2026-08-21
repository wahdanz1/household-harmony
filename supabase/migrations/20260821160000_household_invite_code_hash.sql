-- Household invite codes were stored in plaintext beside the household DEK
-- they unwrap. Anyone able to read the table had both halves: derive the KEK
-- from the code, unwrap the DEK, decrypt everything the household has ever
-- written. Redeeming was never needed, so neither single-use nor the 24-hour
-- expiry protected any of it.
--
-- Worse, the payload outlived the invite: redeeming set is_active = false but
-- left encrypted_dek in place, and the household DEK never rotates, so every
-- invite ever sent still carried a working key.
--
-- Three changes, and all three are needed:
--   1. store only a hash, so the code cannot be read back
--   2. lengthen the code, or the hash is brute-forceable in about a minute
--   3. clear the wrap once an invite is consumed, so nothing lingers
--
-- On (2): the old codes were 8 characters over a 31-symbol alphabet — about
-- 8.5e11 possibilities, which a GPU exhausts in roughly 90 seconds. At 16 the
-- keyspace is ~7e23 and the same attack is hopeless. The client generates the
-- longer codes; this migration only stops accepting the short ones.

-- Single canonicalisation shared by both invite families. Any divergence
-- between client and database here makes invites silently unredeemable.
CREATE OR REPLACE FUNCTION public.hash_invite_code(code_in text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
    SELECT encode(
        sha256(convert_to(upper(regexp_replace(code_in, '[^a-zA-Z0-9]', '', 'g')), 'UTF8')),
        'hex'
    );
$$;

REVOKE ALL ON FUNCTION public.hash_invite_code(text) FROM PUBLIC;

-- Keep the co-parent entry point working, but with one implementation behind it.
CREATE OR REPLACE FUNCTION public.normalize_space_invite_code_hash(code_in text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
    SELECT public.hash_invite_code(code_in);
$$;

REVOKE ALL ON FUNCTION public.normalize_space_invite_code_hash(text) FROM PUBLIC;


ALTER TABLE public.household_invites
    ADD COLUMN invite_code_hash text;

UPDATE public.household_invites
   SET invite_code_hash = public.hash_invite_code(invite_code)
 WHERE invite_code_hash IS NULL;

ALTER TABLE public.household_invites
    DROP COLUMN invite_code;

ALTER TABLE public.household_invites
    ALTER COLUMN invite_code_hash SET NOT NULL,
    ADD CONSTRAINT household_invites_code_hash_key UNIQUE (invite_code_hash);

-- The backlog: every invite already used or expired is still holding a key.
UPDATE public.household_invites
   SET encrypted_dek = NULL,
       dek_salt      = NULL,
       dek_iv        = NULL
 WHERE is_active = false
    OR expires_at <= now();


CREATE OR REPLACE FUNCTION public.lookup_active_invite(invite_code_in text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'household_id', h.id,
        'household_name', h.name,
        'household_currency', h.currency,
        'invited_email', hi.invited_email,
        'encrypted_dek', hi.encrypted_dek,
        'dek_iv', hi.dek_iv,
        'dek_salt', hi.dek_salt,
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
    WHERE hi.invite_code_hash = public.hash_invite_code(invite_code_in)
      AND hi.is_active = true
      AND hi.expires_at > now()
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_active_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_active_invite(text) TO anon, authenticated;


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
     WHERE invite_code_hash = public.hash_invite_code(invite_code_in)
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

    -- The joiner already has the wrap in hand from lookup_active_invite; the
    -- row has no further use for it, and a consumed invite must not keep
    -- carrying a key that never rotates.
    UPDATE public.household_invites
       SET status        = 'accepted',
           is_active     = false,
           encrypted_dek = NULL,
           dek_salt      = NULL,
           dek_iv        = NULL
     WHERE id = v_invite.id;

    RETURN jsonb_build_object(
        'household_id', v_invite.household_id,
        'success',      true
    );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_invite(text) TO authenticated;


-- Expiry is a clock event with nothing to trigger on, so the wrap has to be
-- swept. Safe to run repeatedly and cheap enough to call on any invite read.
CREATE OR REPLACE FUNCTION public.sweep_expired_invite_wraps()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    n integer;
BEGIN
    UPDATE public.household_invites
       SET encrypted_dek = NULL, dek_salt = NULL, dek_iv = NULL
     WHERE expires_at <= now()
       AND encrypted_dek IS NOT NULL;
    GET DIAGNOSTICS n = ROW_COUNT;

    UPDATE public.coparent_space_invites
       SET encrypted_dek = NULL, dek_salt = NULL, dek_iv = NULL
     WHERE expires_at <= now()
       AND encrypted_dek IS NOT NULL;

    RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_expired_invite_wraps() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_expired_invite_wraps() TO authenticated;


-- Same treatment for co-parent invites: consumed ones keep the space key today.
UPDATE public.coparent_space_invites
   SET encrypted_dek = NULL, dek_salt = NULL, dek_iv = NULL
 WHERE is_active = false
    OR expires_at <= now();


-- A consumed co-parent invite kept the space key too. The wrap is captured into
-- v_invite before the update, so the joiner still receives it.
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
     WHERE invite_code_hash = public.hash_invite_code(invite_code_in)
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
       SET status        = 'accepted',
           is_active     = false,
           encrypted_dek = NULL,
           dek_salt      = NULL,
           dek_iv        = NULL
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
