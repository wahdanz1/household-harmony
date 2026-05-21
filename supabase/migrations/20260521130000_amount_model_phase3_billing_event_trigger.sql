-- Amount model phase 3: eager pre-creation of billing-event rows.
-- On INSERT or schedule-affecting UPDATE of a subscription/insurance source,
-- compute the next 12 months of billing events and materialize rows in
-- monthly_subscriptions/monthly_insurances. Drops future unreconciled rows
-- before re-creating so schedule changes are atomic.
-- See docs/design/amount-model.md for the row-shape rationale.

CREATE OR REPLACE FUNCTION public.financial_month_start_for(reference_date date, fms integer)
RETURNS date AS $$
BEGIN
    IF EXTRACT(day FROM reference_date)::integer >= fms THEN
        RETURN make_date(
            EXTRACT(year FROM reference_date)::integer,
            EXTRACT(month FROM reference_date)::integer,
            fms
        );
    ELSE
        RETURN (make_date(
            EXTRACT(year FROM reference_date)::integer,
            EXTRACT(month FROM reference_date)::integer,
            fms
        ) - INTERVAL '1 month')::date;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.sync_monthly_billing_events()
RETURNS TRIGGER AS $$
DECLARE
    monthly_table text;
    fk_column text;
    fms integer;
    today date;
    cycle text;
    months_step integer;
    event_count integer;
    i integer;
    event_year integer;
    event_month integer;
    days_in_month integer;
    clamped_day integer;
    event_date date;
    fm_start date;
    fm_end date;
BEGIN
    IF TG_TABLE_NAME = 'subscriptions' THEN
        monthly_table := 'monthly_subscriptions';
        fk_column := 'subscription_id';
    ELSIF TG_TABLE_NAME = 'insurances' THEN
        monthly_table := 'monthly_insurances';
        fk_column := 'insurance_id';
    ELSE
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.billing_cycle IS NOT DISTINCT FROM OLD.billing_cycle
           AND NEW.billing_month IS NOT DISTINCT FROM OLD.billing_month
           AND NEW.billing_day IS NOT DISTINCT FROM OLD.billing_day
           AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active
           AND NEW.encrypted_budget IS NOT DISTINCT FROM OLD.encrypted_budget THEN
            RETURN NEW;
        END IF;
    END IF;

    today := CURRENT_DATE;

    EXECUTE format(
        'DELETE FROM public.%I
         WHERE %I = $1
           AND month_start > $2
           AND encrypted_actual_amount IS NULL',
        monthly_table, fk_column
    ) USING NEW.id, today;

    IF NEW.is_active = false THEN
        RETURN NEW;
    END IF;

    SELECT financial_month_start INTO fms FROM public.households WHERE id = NEW.household_id;
    IF fms IS NULL THEN fms := 25; END IF;

    cycle := NEW.billing_cycle::text;

    IF cycle = 'monthly' THEN
        fm_start := public.financial_month_start_for(today, fms);
        FOR i IN 0..11 LOOP
            fm_end := (fm_start + INTERVAL '1 month' - INTERVAL '1 day')::date;
            EXECUTE format(
                'INSERT INTO public.%I (
                    %I, household_id, month, month_start, month_end,
                    encrypted_budget_snapshot, is_encrypted, created_by
                ) VALUES ($1, $2, $3, $3, $4, $5, $6, $7)
                ON CONFLICT (%I, month) DO NOTHING',
                monthly_table, fk_column, fk_column
            ) USING NEW.id, NEW.household_id, fm_start, fm_end,
                    NEW.encrypted_budget, NEW.is_encrypted, NEW.created_by;
            fm_start := (fm_start + INTERVAL '1 month')::date;
        END LOOP;
        RETURN NEW;
    END IF;

    -- Non-monthly cycles need billing_month + billing_day; otherwise no rows.
    IF NEW.billing_month IS NULL OR NEW.billing_day IS NULL THEN
        RETURN NEW;
    END IF;

    IF cycle = 'yearly' THEN
        event_count := 1; months_step := 12;
    ELSIF cycle = 'semi_annually' THEN
        event_count := 2; months_step := 6;
    ELSIF cycle = 'quarterly' THEN
        event_count := 4; months_step := 3;
    ELSE
        RETURN NEW;
    END IF;

    event_year := EXTRACT(year FROM today)::integer;
    event_month := NEW.billing_month;

    -- Walk forward until the candidate event is on or after today.
    LOOP
        days_in_month := EXTRACT(day FROM (
            make_date(event_year, event_month, 1) + INTERVAL '1 month' - INTERVAL '1 day'
        ))::integer;
        clamped_day := LEAST(NEW.billing_day, days_in_month);
        event_date := make_date(event_year, event_month, clamped_day);
        EXIT WHEN event_date >= today;
        event_month := event_month + months_step;
        WHILE event_month > 12 LOOP
            event_month := event_month - 12;
            event_year := event_year + 1;
        END LOOP;
    END LOOP;

    FOR i IN 0..(event_count - 1) LOOP
        fm_start := public.financial_month_start_for(event_date, fms);
        fm_end := (fm_start + INTERVAL '1 month' - INTERVAL '1 day')::date;

        EXECUTE format(
            'INSERT INTO public.%I (
                %I, household_id, month, month_start, month_end,
                encrypted_budget_snapshot, is_encrypted, created_by
            ) VALUES ($1, $2, $3, $3, $4, $5, $6, $7)
            ON CONFLICT (%I, month) DO NOTHING',
            monthly_table, fk_column, fk_column
        ) USING NEW.id, NEW.household_id, fm_start, fm_end,
                NEW.encrypted_budget, NEW.is_encrypted, NEW.created_by;

        event_month := event_month + months_step;
        WHILE event_month > 12 LOOP
            event_month := event_month - 12;
            event_year := event_year + 1;
        END LOOP;
        days_in_month := EXTRACT(day FROM (
            make_date(event_year, event_month, 1) + INTERVAL '1 month' - INTERVAL '1 day'
        ))::integer;
        clamped_day := LEAST(NEW.billing_day, days_in_month);
        event_date := make_date(event_year, event_month, clamped_day);
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscription_sync_billing_events ON public.subscriptions;
CREATE TRIGGER subscription_sync_billing_events
    AFTER INSERT OR UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_monthly_billing_events();

DROP TRIGGER IF EXISTS insurance_sync_billing_events ON public.insurances;
CREATE TRIGGER insurance_sync_billing_events
    AFTER INSERT OR UPDATE ON public.insurances
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_monthly_billing_events();
