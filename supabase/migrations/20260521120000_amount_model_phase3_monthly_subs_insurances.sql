-- Amount model phase 3: monthly_subscriptions + monthly_insurances tables.
-- Mirrors monthly_expenses shape (audit columns + actuals). Row creation
-- is per-billing-event, not per-amortized-month — populated by triggers in
-- a later chunk. See docs/design/amount-model.md.

CREATE TABLE IF NOT EXISTS public.monthly_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    month date NOT NULL,
    month_start date,
    month_end date,
    notes text,
    is_encrypted boolean DEFAULT false,
    encrypted_budget_snapshot text,
    encrypted_previous_budget_snapshot text,
    encrypted_actual_amount text,
    budget_changed_at timestamptz,
    actual_recorded_at timestamptz,
    inactivated_at timestamptz,
    created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc', now()),
    CONSTRAINT monthly_subscriptions_subscription_id_month_key UNIQUE (subscription_id, month)
);

CREATE INDEX idx_monthly_subscriptions_household ON public.monthly_subscriptions (household_id);
CREATE INDEX idx_monthly_subscriptions_household_month ON public.monthly_subscriptions (household_id, month DESC);
CREATE INDEX idx_monthly_subscriptions_date_range ON public.monthly_subscriptions (household_id, month_start, month_end);
CREATE INDEX idx_monthly_subscriptions_subscription ON public.monthly_subscriptions (subscription_id);

CREATE TABLE IF NOT EXISTS public.monthly_insurances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    insurance_id uuid REFERENCES public.insurances(id) ON DELETE CASCADE,
    household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    month date NOT NULL,
    month_start date,
    month_end date,
    notes text,
    is_encrypted boolean DEFAULT false,
    encrypted_budget_snapshot text,
    encrypted_previous_budget_snapshot text,
    encrypted_actual_amount text,
    budget_changed_at timestamptz,
    actual_recorded_at timestamptz,
    inactivated_at timestamptz,
    created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc', now()),
    CONSTRAINT monthly_insurances_insurance_id_month_key UNIQUE (insurance_id, month)
);

CREATE INDEX idx_monthly_insurances_household ON public.monthly_insurances (household_id);
CREATE INDEX idx_monthly_insurances_household_month ON public.monthly_insurances (household_id, month DESC);
CREATE INDEX idx_monthly_insurances_date_range ON public.monthly_insurances (household_id, month_start, month_end);
CREATE INDEX idx_monthly_insurances_insurance ON public.monthly_insurances (insurance_id);

ALTER TABLE public.monthly_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_insurances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view monthly subscriptions for their household"
    ON public.monthly_subscriptions FOR SELECT
    USING (public.is_household_member((SELECT auth.uid()), household_id));

CREATE POLICY "Users can insert monthly subscriptions for their household"
    ON public.monthly_subscriptions FOR INSERT
    WITH CHECK (public.is_household_member((SELECT auth.uid()), household_id));

CREATE POLICY "Users can update monthly subscriptions for their household"
    ON public.monthly_subscriptions FOR UPDATE
    USING (public.is_household_member((SELECT auth.uid()), household_id));

CREATE POLICY "Users can delete monthly subscriptions for their household"
    ON public.monthly_subscriptions FOR DELETE
    USING (public.is_household_member((SELECT auth.uid()), household_id));

CREATE POLICY "Users can view monthly insurances for their household"
    ON public.monthly_insurances FOR SELECT
    USING (public.is_household_member((SELECT auth.uid()), household_id));

CREATE POLICY "Users can insert monthly insurances for their household"
    ON public.monthly_insurances FOR INSERT
    WITH CHECK (public.is_household_member((SELECT auth.uid()), household_id));

CREATE POLICY "Users can update monthly insurances for their household"
    ON public.monthly_insurances FOR UPDATE
    USING (public.is_household_member((SELECT auth.uid()), household_id));

CREATE POLICY "Users can delete monthly insurances for their household"
    ON public.monthly_insurances FOR DELETE
    USING (public.is_household_member((SELECT auth.uid()), household_id));

CREATE OR REPLACE TRIGGER update_monthly_subscriptions_updated_at
    BEFORE UPDATE ON public.monthly_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_monthly_insurances_updated_at
    BEFORE UPDATE ON public.monthly_insurances
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extend snapshot_source_budget_change to handle subscriptions + insurances.
-- Same shape as income/expense: on source.encrypted_budget change, shuffle
-- the current month's snapshot into previous_snapshot + stamp budget_changed_at.
-- Mid-month is_active flip stamps/clears inactivated_at on the current row.
CREATE OR REPLACE FUNCTION public.snapshot_source_budget_change()
RETURNS TRIGGER AS $$
DECLARE
    monthly_table text;
    fk_column text;
BEGIN
    IF TG_TABLE_NAME = 'income_sources' THEN
        monthly_table := 'monthly_incomes';
        fk_column := 'income_source_id';
    ELSIF TG_TABLE_NAME = 'expenses' THEN
        monthly_table := 'monthly_expenses';
        fk_column := 'expense_id';
    ELSIF TG_TABLE_NAME = 'subscriptions' THEN
        monthly_table := 'monthly_subscriptions';
        fk_column := 'subscription_id';
    ELSIF TG_TABLE_NAME = 'insurances' THEN
        monthly_table := 'monthly_insurances';
        fk_column := 'insurance_id';
    ELSE
        RETURN NEW;
    END IF;

    IF NEW.encrypted_budget IS DISTINCT FROM OLD.encrypted_budget THEN
        EXECUTE format(
            'UPDATE public.%I SET
                encrypted_previous_budget_snapshot = encrypted_budget_snapshot,
                encrypted_budget_snapshot = $1,
                budget_changed_at = now()
             WHERE %I = $2
               AND CURRENT_DATE BETWEEN month_start AND month_end',
            monthly_table, fk_column
        ) USING NEW.encrypted_budget, NEW.id;
    END IF;

    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
        IF NEW.is_active = false THEN
            EXECUTE format(
                'UPDATE public.%I SET inactivated_at = now()
                 WHERE %I = $1
                   AND CURRENT_DATE BETWEEN month_start AND month_end',
                monthly_table, fk_column
            ) USING NEW.id;
        ELSE
            EXECUTE format(
                'UPDATE public.%I SET inactivated_at = NULL
                 WHERE %I = $1
                   AND CURRENT_DATE BETWEEN month_start AND month_end',
                monthly_table, fk_column
            ) USING NEW.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscription_budget_change ON public.subscriptions;
CREATE TRIGGER subscription_budget_change
    AFTER UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.snapshot_source_budget_change();

DROP TRIGGER IF EXISTS insurance_budget_change ON public.insurances;
CREATE TRIGGER insurance_budget_change
    AFTER UPDATE ON public.insurances
    FOR EACH ROW
    EXECUTE FUNCTION public.snapshot_source_budget_change();
