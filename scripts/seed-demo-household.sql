-- Demo data seed for marketing screenshots / OG image
-- USAGE:
--   1. Create a fresh test account in the app and complete the setup wizard
--      (so a household + auth user exist).
--   2. Find your household_id in Settings (or via SQL).
--   3. Replace 'YOUR_HOUSEHOLD_ID_HERE' below.
--   4. Run via:  npx supabase db query --linked "$(cat scripts/seed-demo-household.sql)"
--
-- Inserts plaintext data with is_encrypted=false so it renders without a vault key.
-- Safe to re-run: deletes existing demo rows for the household first.

DO $$
DECLARE
    hh uuid := 'YOUR_HOUSEHOLD_ID_HERE';
    me uuid;
    cur_month text;
    cur_start date;
    cur_end date;
    sub_kia uuid;
    sub_kid uuid;
    eid uuid;
BEGIN
    SELECT user_id INTO me FROM household_members WHERE household_id = hh LIMIT 1;
    IF me IS NULL THEN
        RAISE EXCEPTION 'Household % has no members', hh;
    END IF;

    -- Compute current financial month (start day = households.financial_month_start)
    SELECT
        to_char(date_trunc('month', now()) - INTERVAL '1 month' + (COALESCE(financial_month_start, 25) - 1) * INTERVAL '1 day', 'YYYY-MM-DD'),
        (date_trunc('month', now()) - INTERVAL '1 month' + (COALESCE(financial_month_start, 25) - 1) * INTERVAL '1 day')::date,
        (date_trunc('month', now()) + (COALESCE(financial_month_start, 25) - 2) * INTERVAL '1 day')::date
    INTO cur_month, cur_start, cur_end
    FROM households WHERE id = hh;

    -- Wipe prior demo data for this household
    DELETE FROM monthly_expenses WHERE household_id = hh;
    DELETE FROM monthly_incomes WHERE household_id = hh;
    DELETE FROM expenses WHERE household_id = hh;
    DELETE FROM subscriptions WHERE household_id = hh;
    DELETE FROM insurances WHERE household_id = hh;
    DELETE FROM income_sources WHERE household_id = hh;
    DELETE FROM subjects WHERE household_id = hh AND type <> 'member';

    -- Subjects (members are auto-seeded by the app on first SubjectPicker mount)
    INSERT INTO subjects (household_id, name, type) VALUES
        (hh, 'Kia', 'car'),
        (hh, 'Liam', 'kid')
    RETURNING id INTO sub_kia;
    SELECT id INTO sub_kia FROM subjects WHERE household_id = hh AND name = 'Kia';
    SELECT id INTO sub_kid FROM subjects WHERE household_id = hh AND name = 'Liam';

    -- Income sources (showcase all 4 tax types)
    INSERT INTO income_sources (household_id, created_by, category, name, default_amount, tax_type, custom_tax_rate, is_active, is_encrypted) VALUES
        (hh, me, 'salary', 'Anders salary', 32500, 'progressive', NULL, true, false),
        (hh, me, 'salary', 'Maja salary', 27800, 'standard_30', NULL, true, false),
        (hh, me, 'government_benefits', 'Barnbidrag', 1325, 'no_tax', NULL, true, false),
        (hh, me, 'government_benefits', 'CSN Studiestöd', 11876, 'csn_variable', 30, true, false);

    -- Expenses (recurring household bills)
    INSERT INTO expenses (household_id, created_by, category, name, default_amount, is_credit, subject_id, is_active, is_encrypted) VALUES
        (hh, me, 'rent', 'Hyresbostäder', 12450, false, NULL, true, false),
        (hh, me, 'electricity', 'Vattenfall', 850, false, NULL, true, false),
        (hh, me, 'internet', 'Bahnhof', 449, false, NULL, true, false),
        (hh, me, 'phone_plan', 'Comviq', 199, false, NULL, true, false),
        (hh, me, 'phone_plan', 'Hallon', 149, false, NULL, true, false),
        (hh, me, 'memberships', 'Unionen A-kassa', 170, false, NULL, true, false),
        (hh, me, 'memberships', 'WWF', 100, false, NULL, true, false),
        (hh, me, 'healthcare', 'Apoteket recept', 250, false, NULL, true, false);

    -- Mirror current-month rows so the budget vs actual flow has data
    INSERT INTO monthly_expenses (household_id, created_by, expense_id, month, month_start, month_end, budget_amount, is_encrypted)
    SELECT hh, me, e.id, cur_month, cur_start, cur_end, e.default_amount, false
    FROM expenses e WHERE e.household_id = hh;

    INSERT INTO monthly_incomes (household_id, created_by, income_source_id, month, month_start, month_end, budget_amount, is_encrypted)
    SELECT hh, me, s.id, cur_month, cur_start, cur_end, s.default_amount, false
    FROM income_sources s WHERE s.household_id = hh;

    -- Subscriptions
    INSERT INTO subscriptions (household_id, created_by, name, amount, billing_cycle, category, is_active, subject_id, is_encrypted) VALUES
        (hh, me, 'Netflix', 169, 'monthly', 'streaming', true, NULL, false),
        (hh, me, 'Spotify Family', 199, 'monthly', 'music', true, NULL, false),
        (hh, me, 'Disney+', 99, 'monthly', 'streaming', true, NULL, false),
        (hh, me, 'YouTube Premium', 95, 'monthly', 'streaming', true, NULL, false),
        (hh, me, 'Adobe Creative Cloud', 285, 'monthly', 'software', true, NULL, false),
        (hh, me, 'iCloud+ 200GB', 35, 'monthly', 'storage', true, NULL, false),
        (hh, me, 'Friskis & Svettis', 369, 'monthly', 'gym', true, NULL, false);

    -- Insurances
    INSERT INTO insurances (household_id, created_by, provider, name, category, total_amount, billing_cycle, billing_month, is_active, subject_id, is_encrypted) VALUES
        (hh, me, 'Länsförsäkringar', '', 'home', 4200, 'yearly', 3, true, NULL, false),
        (hh, me, 'Länsförsäkringar', '', 'car', 6840, 'yearly', 1, true, sub_kia, false),
        (hh, me, 'Folksam', '', 'life', 2400, 'yearly', 6, true, NULL, false),
        (hh, me, 'Trygg-Hansa', '', 'child', 1980, 'yearly', 9, true, sub_kid, false),
        (hh, me, 'Agria', '', 'pet', 3120, 'yearly', 11, true, NULL, false);

    RAISE NOTICE 'Seeded household % with demo data for month %', hh, cur_month;
END $$;
