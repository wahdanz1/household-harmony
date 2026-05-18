-- Amount model phase 4: mid-month change tracking via DB triggers.
-- When source.encrypted_budget changes mid-month, snapshot the new value
-- onto the current month's monthly_* row and stash the previous in
-- encrypted_previous_budget_snapshot + budget_changed_at = now().
-- Same trigger handles is_active flip: sets/clears inactivated_at on the
-- current month's row so Monthly Review can render the "Inactivated"
-- badge. No decryption happens inside the trigger — it just shuffles
-- ciphertext between columns. See docs/design/amount-model.md.

ALTER TABLE public.monthly_incomes
    ADD COLUMN IF NOT EXISTS inactivated_at timestamptz;
ALTER TABLE public.monthly_expenses
    ADD COLUMN IF NOT EXISTS inactivated_at timestamptz;

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

DROP TRIGGER IF EXISTS income_source_budget_change ON public.income_sources;
CREATE TRIGGER income_source_budget_change
    AFTER UPDATE ON public.income_sources
    FOR EACH ROW
    EXECUTE FUNCTION public.snapshot_source_budget_change();

DROP TRIGGER IF EXISTS expense_budget_change ON public.expenses;
CREATE TRIGGER expense_budget_change
    AFTER UPDATE ON public.expenses
    FOR EACH ROW
    EXECUTE FUNCTION public.snapshot_source_budget_change();
