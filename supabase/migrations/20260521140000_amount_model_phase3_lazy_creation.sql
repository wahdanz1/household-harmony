-- Amount model phase 3 rework: lazy monthly_* row creation.
-- Drops the eager pre-creation trigger (sync_monthly_billing_events) that
-- materialized 12 months of speculative rows on source mutation. Replaces
-- it with a lazy model: rows are created at Review time OR when a
-- mid-month source.budget edit needs to record audit info.
-- Matches the monthly_expenses prior-art pattern (lazy on first read).
-- See docs/design/amount-model.md for rationale.

DROP TRIGGER IF EXISTS subscription_sync_billing_events ON public.subscriptions;
DROP TRIGGER IF EXISTS insurance_sync_billing_events ON public.insurances;
DROP FUNCTION IF EXISTS public.sync_monthly_billing_events();

-- Upsert version of snapshot_source_budget_change. Under lazy, the current
-- FM's monthly_* row may not exist when the budget changes mid-month. We
-- need to create it on the fly so the "Changed mid-month" badge has data
-- when Review eventually surfaces this row.
CREATE OR REPLACE FUNCTION public.snapshot_source_budget_change()
RETURNS TRIGGER AS $$
DECLARE
    monthly_table text;
    fk_column text;
    fms integer;
    fm_start date;
    fm_end date;
    creator_id uuid;
BEGIN
    IF TG_TABLE_NAME = 'income_sources' THEN
        monthly_table := 'monthly_incomes';
        fk_column := 'income_source_id';
        creator_id := NEW.owner_id;
    ELSIF TG_TABLE_NAME = 'expenses' THEN
        monthly_table := 'monthly_expenses';
        fk_column := 'expense_id';
        creator_id := NEW.created_by;
    ELSIF TG_TABLE_NAME = 'subscriptions' THEN
        monthly_table := 'monthly_subscriptions';
        fk_column := 'subscription_id';
        creator_id := NEW.created_by;
    ELSIF TG_TABLE_NAME = 'insurances' THEN
        monthly_table := 'monthly_insurances';
        fk_column := 'insurance_id';
        creator_id := NEW.created_by;
    ELSE
        RETURN NEW;
    END IF;

    -- Resolve household FM-start (default 25 if NULL).
    SELECT financial_month_start INTO fms FROM public.households WHERE id = NEW.household_id;
    IF fms IS NULL THEN fms := 25; END IF;
    fm_start := public.financial_month_start_for(CURRENT_DATE, fms);
    fm_end := (fm_start + INTERVAL '1 month' - INTERVAL '1 day')::date;

    IF NEW.encrypted_budget IS DISTINCT FROM OLD.encrypted_budget THEN
        EXECUTE format(
            'INSERT INTO public.%I (
                %I, household_id, month, month_start, month_end,
                encrypted_budget_snapshot, encrypted_previous_budget_snapshot,
                budget_changed_at, is_encrypted, created_by
             ) VALUES ($1, $2, $3, $3, $4, $5, $6, now(), $7, $8)
             ON CONFLICT (%I, month) DO UPDATE SET
                encrypted_previous_budget_snapshot = COALESCE(
                    public.%I.encrypted_budget_snapshot,
                    EXCLUDED.encrypted_previous_budget_snapshot
                ),
                encrypted_budget_snapshot = EXCLUDED.encrypted_budget_snapshot,
                budget_changed_at = now()',
            monthly_table, fk_column, fk_column, monthly_table
        ) USING NEW.id, NEW.household_id, fm_start, fm_end,
                NEW.encrypted_budget, OLD.encrypted_budget,
                NEW.is_encrypted, creator_id;
    END IF;

    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
        EXECUTE format(
            'INSERT INTO public.%I (
                %I, household_id, month, month_start, month_end,
                encrypted_budget_snapshot, inactivated_at, is_encrypted, created_by
             ) VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (%I, month) DO UPDATE SET
                inactivated_at = EXCLUDED.inactivated_at',
            monthly_table, fk_column, fk_column
        ) USING NEW.id, NEW.household_id, fm_start, fm_end,
                NEW.encrypted_budget,
                CASE WHEN NEW.is_active = false THEN now() ELSE NULL END,
                NEW.is_encrypted, creator_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Wipe any speculative rows the old eager trigger created. Reconciled rows
-- (actual_amount IS NOT NULL) are preserved as history.
DELETE FROM public.monthly_subscriptions WHERE encrypted_actual_amount IS NULL;
DELETE FROM public.monthly_insurances WHERE encrypted_actual_amount IS NULL;
