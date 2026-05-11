-- Apply Supabase Security Advisor recommendations on function exposure.
--
-- 1. Drop four dead RPC functions that nothing calls and that reference a
--    `regular_expense_id` column which no longer exists. They would error
--    if invoked; safe to remove outright.
-- 2. Pin search_path on two remaining trigger functions so a shadowed
--    object in another schema can't change their behaviour.
-- 3. Revoke EXECUTE on trigger-only functions from PUBLIC / anon /
--    authenticated. They fire from the trigger system (postgres role) and
--    don't need a REST endpoint.

DROP FUNCTION IF EXISTS public.calculate_expense_average(uuid, uuid, integer);
DROP FUNCTION IF EXISTS public.calculate_income_average(uuid, uuid, integer);
DROP FUNCTION IF EXISTS public.get_latest_expense_amount(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_latest_income_amount(uuid, uuid);

ALTER FUNCTION public.handle_insurance_coparent_null() SET search_path = '';
ALTER FUNCTION public.update_updated_at_column()       SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.handle_new_user()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_default_household()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_insurance_coparent_null()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()         FROM PUBLIC, anon, authenticated;
