-- Co-parenting spaces: a shared container with its own DEK so a co-parent who
-- is NOT a household member can see the kid schedule and the costs explicitly
-- published to them, and nothing else.
--
-- Mirrors the household model deliberately:
--   households            -> coparent_spaces
--   household_members     -> coparent_space_members
--   user_vault_keys       -> coparent_space_vault_keys
--   household_invites     -> coparent_space_invites
--
-- Membership and key material stay in separate tables for the same reason they
-- do for households: redeeming an invite inserts the membership, but only the
-- client can produce the password-wrapped key, and that happens afterwards.
--
-- A co-parent must never get a household_members row — resolveActiveHouseholdId
-- resolves to a single active household, so a second membership would switch
-- them out of their own.

CREATE TABLE public.coparent_spaces (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text NOT NULL,
    created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.coparent_space_members (
    space_id  uuid NOT NULL REFERENCES public.coparent_spaces(id) ON DELETE CASCADE,
    user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role      text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    joined_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (space_id, user_id)
);

CREATE INDEX idx_coparent_space_members_user
    ON public.coparent_space_members (user_id);

CREATE TABLE public.coparent_space_vault_keys (
    space_id           uuid NOT NULL REFERENCES public.coparent_spaces(id) ON DELETE CASCADE,
    user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    encrypted_dek      text NOT NULL,
    dek_salt           text NOT NULL,
    dek_iv             text NOT NULL,
    encryption_version integer NOT NULL DEFAULT 1,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (space_id, user_id)
);

CREATE TABLE public.coparent_space_invites (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id      uuid NOT NULL REFERENCES public.coparent_spaces(id) ON DELETE CASCADE,
    invite_code   text NOT NULL UNIQUE,
    invited_email text NOT NULL,
    created_by    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- The space DEK wrapped with a key derived from invite_code. The code is the
    -- only thing that unwraps it and never reaches the server.
    encrypted_dek text,
    dek_salt      text,
    dek_iv        text,
    status        public.invite_status NOT NULL DEFAULT 'pending',
    is_active     boolean NOT NULL DEFAULT true,
    expires_at    timestamptz NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coparent_space_invites_space
    ON public.coparent_space_invites (space_id);


-- Membership test used by every policy below. SECURITY DEFINER so that a policy
-- on coparent_space_members can ask about coparent_space_members without
-- recursing through its own RLS.
CREATE OR REPLACE FUNCTION public.is_coparent_space_member(_space_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM public.coparent_space_members
         WHERE space_id = _space_id
           AND user_id  = _user_id
    );
$$;

REVOKE ALL ON FUNCTION public.is_coparent_space_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_coparent_space_member(uuid, uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.is_coparent_space_owner(_space_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM public.coparent_space_members
         WHERE space_id = _space_id
           AND user_id  = _user_id
           AND role     = 'owner'
    );
$$;

REVOKE ALL ON FUNCTION public.is_coparent_space_owner(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_coparent_space_owner(uuid, uuid) TO authenticated;


ALTER TABLE public.coparent_spaces            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coparent_space_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coparent_space_vault_keys  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coparent_space_invites     ENABLE ROW LEVEL SECURITY;


-- Spaces: visible to members, created by yourself, administered by the owner.
-- created_by is in the predicate so INSERT ... RETURNING works: at that instant
-- the creator has no membership row yet.
CREATE POLICY "Members read their spaces"
    ON public.coparent_spaces FOR SELECT
    USING (
        created_by = (SELECT auth.uid())
        OR public.is_coparent_space_member(id, (SELECT auth.uid()))
    );

CREATE POLICY "Users create their own spaces"
    ON public.coparent_spaces FOR INSERT
    WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY "Owners update their spaces"
    ON public.coparent_spaces FOR UPDATE
    USING (public.is_coparent_space_owner(id, (SELECT auth.uid())))
    WITH CHECK (public.is_coparent_space_owner(id, (SELECT auth.uid())));

CREATE POLICY "Owners delete their spaces"
    ON public.coparent_spaces FOR DELETE
    USING (public.is_coparent_space_owner(id, (SELECT auth.uid())));


-- Members: everyone in a space sees who else is in it. Joining goes through
-- redeem_coparent_invite, so there is no self-insert policy.
CREATE POLICY "Members read space membership"
    ON public.coparent_space_members FOR SELECT
    USING (public.is_coparent_space_member(space_id, (SELECT auth.uid())));

CREATE POLICY "Space creator seeds their own membership"
    ON public.coparent_space_members FOR INSERT
    WITH CHECK (
        user_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.coparent_spaces s
             WHERE s.id = space_id
               AND s.created_by = (SELECT auth.uid())
        )
    );

-- Leave yourself, or be removed by the owner.
CREATE POLICY "Leave or be removed from a space"
    ON public.coparent_space_members FOR DELETE
    USING (
        user_id = (SELECT auth.uid())
        OR public.is_coparent_space_owner(space_id, (SELECT auth.uid()))
    );


-- Vault keys: your own wrap only. Nobody may read another member's wrap.
CREATE POLICY "Users read own space vault keys"
    ON public.coparent_space_vault_keys FOR SELECT
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users insert own space vault keys"
    ON public.coparent_space_vault_keys FOR INSERT
    WITH CHECK (
        user_id = (SELECT auth.uid())
        AND public.is_coparent_space_member(space_id, (SELECT auth.uid()))
    );

CREATE POLICY "Users update own space vault keys"
    ON public.coparent_space_vault_keys FOR UPDATE
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users delete own space vault keys"
    ON public.coparent_space_vault_keys FOR DELETE
    USING (user_id = (SELECT auth.uid()));


-- Invites: managed from inside the space. Pre-join reads go through
-- lookup_coparent_invite, never through a policy.
CREATE POLICY "Members read space invites"
    ON public.coparent_space_invites FOR SELECT
    USING (public.is_coparent_space_member(space_id, (SELECT auth.uid())));

CREATE POLICY "Members create space invites"
    ON public.coparent_space_invites FOR INSERT
    WITH CHECK (
        created_by = (SELECT auth.uid())
        AND public.is_coparent_space_member(space_id, (SELECT auth.uid()))
    );

CREATE POLICY "Members update space invites"
    ON public.coparent_space_invites FOR UPDATE
    USING (public.is_coparent_space_member(space_id, (SELECT auth.uid())))
    WITH CHECK (public.is_coparent_space_member(space_id, (SELECT auth.uid())));

CREATE POLICY "Members delete space invites"
    ON public.coparent_space_invites FOR DELETE
    USING (public.is_coparent_space_member(space_id, (SELECT auth.uid())));


-- Preview for someone holding an invite code but not yet in the space. Returns
-- the wrapped DEK because only the invite code unwraps it, and the caller
-- already has the code.
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
    WHERE upper(ci.invite_code) = upper(invite_code_in)
      AND ci.is_active = true
      AND ci.expires_at > now()
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_coparent_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_coparent_invite(text) TO anon, authenticated;


-- Validates the invite, inserts the membership, marks the invite consumed.
-- The caller then re-wraps the DEK under their password and writes their own
-- coparent_space_vault_keys row.
--
-- Errors: not_authenticated, invite_not_found, email_mismatch, already_member
CREATE OR REPLACE FUNCTION public.redeem_coparent_invite(invite_code_in text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_invite  public.coparent_space_invites%ROWTYPE;
    v_email   text;
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


-- Drop a member's wrap when they leave so a cached key stops being usable
-- against anything re-encrypted afterwards.
CREATE OR REPLACE FUNCTION public.revoke_coparent_space_vault_key()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    DELETE FROM public.coparent_space_vault_keys
     WHERE user_id  = OLD.user_id
       AND space_id = OLD.space_id;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS revoke_coparent_space_vault_key_trg ON public.coparent_space_members;
CREATE TRIGGER revoke_coparent_space_vault_key_trg
    AFTER DELETE ON public.coparent_space_members
    FOR EACH ROW EXECUTE FUNCTION public.revoke_coparent_space_vault_key();

REVOKE ALL ON FUNCTION public.revoke_coparent_space_vault_key() FROM PUBLIC;


-- Link a co-parent label to a real account and the space that backs it. Both
-- nullable: an unlinked co-parent stays a plain label, exactly as today.
ALTER TABLE public.co_parents
    ADD COLUMN linked_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN space_id       uuid REFERENCES public.coparent_spaces(id) ON DELETE SET NULL;

CREATE INDEX idx_co_parents_space ON public.co_parents (space_id);
