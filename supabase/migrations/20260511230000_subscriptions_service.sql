-- Subscriptions gain a separate "service" field (Claude, Netflix, etc.) so
-- the existing Name can become an optional display override. Mirrors the
-- Insurance + Income source pattern. Existing rows: move encrypted_name →
-- encrypted_service so the required field is filled.

ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS encrypted_service text;

UPDATE public.subscriptions
   SET encrypted_service = encrypted_name,
       encrypted_name = NULL
 WHERE encrypted_service IS NULL
   AND encrypted_name IS NOT NULL;
