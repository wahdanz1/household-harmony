-- Switch encryption from per-user DEK to a household-shared DEK so members
-- can decrypt each other's data. Old ciphertext was wrapped under per-user
-- DEKs and is no longer reachable, hence the wipe of encrypted tables.
TRUNCATE TABLE
    public.co_parent_settlements,
    public.co_parents,
    public.credit_cards,
    public.expenses,
    public.household_invites,
    public.income_sources,
    public.insurances,
    public.merchant_categories,
    public.monthly_expenses,
    public.monthly_incomes,
    public.monthly_review_status,
    public.shared_expenses,
    public.subjects,
    public.subscriptions,
    public.temporary_expenses,
    public.user_vault_keys,
    public.user_vault_recovery_slots
RESTART IDENTITY CASCADE;

ALTER TABLE public.user_vault_keys DROP CONSTRAINT IF EXISTS user_vault_keys_pkey;

ALTER TABLE public.user_vault_keys
    ADD COLUMN IF NOT EXISTS household_id uuid;

DELETE FROM public.user_vault_keys WHERE household_id IS NULL;

ALTER TABLE public.user_vault_keys
    ALTER COLUMN household_id SET NOT NULL,
    ADD CONSTRAINT user_vault_keys_household_id_fkey
        FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE,
    ADD CONSTRAINT user_vault_keys_pkey
        PRIMARY KEY (user_id, household_id);

CREATE INDEX IF NOT EXISTS idx_user_vault_keys_household
    ON public.user_vault_keys (household_id);

ALTER TABLE public.household_invites
    ADD COLUMN IF NOT EXISTS encrypted_dek text,
    ADD COLUMN IF NOT EXISTS dek_iv        text,
    ADD COLUMN IF NOT EXISTS dek_salt      text;

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
    WHERE upper(hi.invite_code) = upper(invite_code_in)
      AND hi.is_active = true
      AND hi.expires_at > now()
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_active_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_active_invite(text) TO anon, authenticated;

-- Drop a member's wrap when they leave so they can't decrypt household data afterwards.
CREATE OR REPLACE FUNCTION public.revoke_member_vault_key()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    DELETE FROM public.user_vault_keys
     WHERE user_id      = OLD.user_id
       AND household_id = OLD.household_id;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS revoke_member_vault_key_trg ON public.household_members;
CREATE TRIGGER revoke_member_vault_key_trg
    AFTER DELETE ON public.household_members
    FOR EACH ROW EXECUTE FUNCTION public.revoke_member_vault_key();

REVOKE ALL ON FUNCTION public.revoke_member_vault_key() FROM PUBLIC;
