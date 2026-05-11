-- Income sources gain a separate "provider / employer" field. Matches
-- insurances (provider + optional name override). Existing rows: move
-- encrypted_name → encrypted_provider so the required field is filled.

ALTER TABLE public.income_sources
    ADD COLUMN IF NOT EXISTS encrypted_provider text;

UPDATE public.income_sources
   SET encrypted_provider = encrypted_name,
       encrypted_name = NULL
 WHERE encrypted_provider IS NULL
   AND encrypted_name IS NOT NULL;
