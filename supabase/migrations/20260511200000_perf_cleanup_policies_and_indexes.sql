-- Resolve multiple_permissive_policies warnings (where merging is safe) and
-- unindexed_foreign_keys (pure additive). Idempotent.

-- ── household_members INSERT: drop redundant policies ────────────────────────
-- "Users can join households via valid invite" is byte-for-byte identical to
-- "New users can join via invite during signup".
-- "Users can rejoin their own household" is a strict subset of
-- "Allow returning users to owned household" (when user_id = auth.uid()).
DROP POLICY IF EXISTS "Users can join households via valid invite" ON public.household_members;
DROP POLICY IF EXISTS "Users can rejoin their own household"        ON public.household_members;

-- ── profiles SELECT: merge own-profile + household-profiles into one ─────────
DROP POLICY IF EXISTS "Users can view their own profile"        ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their household" ON public.profiles;

CREATE POLICY "Users can view profiles"
    ON public.profiles
    FOR SELECT
    USING (
        (SELECT auth.uid()) = id
        OR EXISTS (
            SELECT 1
              FROM public.household_members hm1
             WHERE hm1.user_id = (SELECT auth.uid())
               AND EXISTS (
                    SELECT 1
                      FROM public.household_members hm2
                     WHERE hm2.user_id = profiles.id
                       AND hm2.household_id = hm1.household_id
               )
        )
    );

-- ── household_members SELECT: merge own-membership + household-members ───────
DROP POLICY IF EXISTS "Users can view own membership"              ON public.household_members;
DROP POLICY IF EXISTS "Users can view members of their household"  ON public.household_members;

CREATE POLICY "Users can view household memberships"
    ON public.household_members
    FOR SELECT
    USING (
        user_id = (SELECT auth.uid())
        OR is_household_member((SELECT auth.uid()), household_id)
    );

-- ── household_members DELETE: merge owner-delete + user-leave ────────────────
DROP POLICY IF EXISTS "Owners can delete household members" ON public.household_members;
DROP POLICY IF EXISTS "Users can leave household"           ON public.household_members;

CREATE POLICY "Owners delete members or users leave"
    ON public.household_members
    FOR DELETE
    USING (
        is_household_owner((SELECT auth.uid()), household_id)
        OR ((SELECT auth.uid()) = user_id AND role <> 'owner'::household_role)
    );

-- ── Add covering indexes for every single-column FK missing one ──────────────
DO $$
DECLARE
    fk record;
    idx_name text;
BEGIN
    FOR fk IN
        SELECT
            n.nspname        AS schema_name,
            cls.relname      AS table_name,
            att.attname      AS col_name
          FROM pg_constraint con
          JOIN pg_class      cls ON cls.oid = con.conrelid
          JOIN pg_namespace  n   ON n.oid   = cls.relnamespace
          JOIN pg_attribute  att ON att.attrelid = cls.oid AND att.attnum = con.conkey[1]
         WHERE con.contype = 'f'
           AND n.nspname   = 'public'
           AND array_length(con.conkey, 1) = 1
           AND NOT EXISTS (
                SELECT 1
                  FROM pg_index idx
                 WHERE idx.indrelid = con.conrelid
                   AND idx.indkey[0] = con.conkey[1]
           )
    LOOP
        idx_name := 'idx_' || fk.table_name || '_' || fk.col_name;
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I (%I)',
                       idx_name, fk.schema_name, fk.table_name, fk.col_name);
        RAISE NOTICE 'fk index: %.%(%)', fk.schema_name, fk.table_name, fk.col_name;
    END LOOP;
END $$;
