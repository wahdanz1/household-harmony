-- Recovery slots: secondary wrappings of a user's DEK so they can regain
-- access without their password. Phase 1 supports type='recovery_code'
-- (a 12-word BIP-39 phrase shown once at setup). Phase 2 will add
-- type='household_member' (co-recovery via another household member).

CREATE TABLE public.user_vault_recovery_slots (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    slot_type           text NOT NULL CHECK (slot_type IN ('recovery_code', 'household_member')),
    encrypted_dek       text NOT NULL,
    salt                text,
    iv                  text NOT NULL,
    label               text,
    granted_by_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- One recovery_code slot per user. Regenerating replaces it (UPDATE, not new row).
CREATE UNIQUE INDEX user_vault_recovery_slots_one_code_per_user
    ON public.user_vault_recovery_slots (user_id)
    WHERE slot_type = 'recovery_code';

CREATE INDEX idx_user_vault_recovery_slots_user
    ON public.user_vault_recovery_slots (user_id);

ALTER TABLE public.user_vault_recovery_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own recovery slots"
    ON public.user_vault_recovery_slots FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users insert own recovery slots"
    ON public.user_vault_recovery_slots FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users update own recovery slots"
    ON public.user_vault_recovery_slots FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users delete own recovery slots"
    ON public.user_vault_recovery_slots FOR DELETE
    USING ((SELECT auth.uid()) = user_id);
