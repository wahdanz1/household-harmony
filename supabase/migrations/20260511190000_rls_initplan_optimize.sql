-- Resolve auth_rls_initplan perf warnings: PG re-evaluates auth.<fn>() for
-- every row when called bare. Wrapping in (SELECT auth.<fn>()) makes the
-- planner treat it as an initplan and evaluate once per query.
--
-- Sweep every RLS policy in public, unwrap any prior wrappings, then re-wrap
-- uniformly. Idempotent — safe to re-run.

DO $$
DECLARE
    pol      record;
    new_qual  text;
    new_check text;
BEGIN
    FOR pol IN
        SELECT n.nspname AS schemaname,
               c.relname AS tablename,
               p.polname AS policyname,
               pg_get_expr(p.polqual,      p.polrelid) AS qual,
               pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
          FROM pg_policy p
          JOIN pg_class      c ON c.oid = p.polrelid
          JOIN pg_namespace  n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
    LOOP
        new_qual  := pol.qual;
        new_check := pol.with_check;

        IF new_qual IS NOT NULL THEN
            new_qual := regexp_replace(new_qual,  '\(\s*SELECT\s+(auth\.[a-z_]+\(\))\s*\)', '\1', 'g');
            new_qual := regexp_replace(new_qual,  '(auth\.[a-z_]+\(\))', '(SELECT \1)', 'g');
        END IF;
        IF new_check IS NOT NULL THEN
            new_check := regexp_replace(new_check, '\(\s*SELECT\s+(auth\.[a-z_]+\(\))\s*\)', '\1', 'g');
            new_check := regexp_replace(new_check, '(auth\.[a-z_]+\(\))', '(SELECT \1)', 'g');
        END IF;

        IF new_qual IS DISTINCT FROM pol.qual AND new_qual IS NOT NULL THEN
            EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)',
                           pol.policyname, pol.schemaname, pol.tablename, new_qual);
            RAISE NOTICE 'qual rewrapped: %.% / %', pol.schemaname, pol.tablename, pol.policyname;
        END IF;
        IF new_check IS DISTINCT FROM pol.with_check AND new_check IS NOT NULL THEN
            EXECUTE format('ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
                           pol.policyname, pol.schemaname, pol.tablename, new_check);
            RAISE NOTICE 'check rewrapped: %.% / %', pol.schemaname, pol.tablename, pol.policyname;
        END IF;
    END LOOP;
END $$;
