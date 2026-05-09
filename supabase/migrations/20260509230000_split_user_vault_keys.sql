-- Move encrypted vault material out of `profiles` into a sibling table that
-- only the owning user can read.

CREATE TABLE IF NOT EXISTS public.user_vault_keys (
    user_id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    encrypted_dek      text NOT NULL,
    dek_salt           text NOT NULL,
    dek_iv             text NOT NULL,
    encryption_version integer NOT NULL DEFAULT 1,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_vault_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own vault keys"
    ON public.user_vault_keys FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users insert own vault keys"
    ON public.user_vault_keys FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own vault keys"
    ON public.user_vault_keys FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Backfill from profiles for any existing users.
INSERT INTO public.user_vault_keys (user_id, encrypted_dek, dek_salt, dek_iv, encryption_version)
SELECT id, encrypted_dek, dek_salt, dek_iv, COALESCE(encryption_version, 1)
  FROM public.profiles
 WHERE encrypted_dek IS NOT NULL
   AND dek_salt      IS NOT NULL
   AND dek_iv        IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.profiles
    DROP COLUMN IF EXISTS encrypted_dek,
    DROP COLUMN IF EXISTS dek_salt,
    DROP COLUMN IF EXISTS dek_iv,
    DROP COLUMN IF EXISTS encryption_version;
