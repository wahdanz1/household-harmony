-- Convert auto-created credit expense sources into one-time monthly entries.
--
-- Background: the credit-import pipeline used to create persistent `expenses`
-- source rows for un-budgeted categories (budget=0, is_credit=true,
-- sort_order=999). Those rows then appeared in every month's expense list,
-- including months they had no actuals for. The pipeline now writes one-time
-- `monthly_expenses` entries directly for that case; this migration backfills
-- the existing data so the prior writes are no longer visible as zero-budget
-- rows in the current month.
--
-- Discriminator: is_credit=true AND sort_order=999. The plaintext budget is
-- encrypted, so we can't filter on it; sort_order is the pipeline's marker.
-- Legitimate user-budgeted is_credit sources use the default sort_order.

-- Step 1: convert monthly_expenses rows pointing to auto-created sources
-- into one-time entries (expense_id=NULL, one_time_name set from category).
UPDATE public.monthly_expenses me
SET
    expense_id = NULL,
    one_time_name = CASE e.category::text
        WHEN 'groceries'     THEN 'Groceries'
        WHEN 'fuel'          THEN 'Fuel'
        WHEN 'shopping'      THEN 'Shopping'
        WHEN 'dining_out'    THEN 'Dining Out'
        WHEN 'entertainment' THEN 'Entertainment'
        WHEN 'car_repairs'   THEN 'Car Repairs'
        WHEN 'travel'        THEN 'Travel'
        WHEN 'healthcare'    THEN 'Healthcare'
        WHEN 'other'         THEN 'Other'
        ELSE INITCAP(REPLACE(e.category::text, '_', ' '))
    END,
    one_time_category = e.category::text
FROM public.expenses e
WHERE me.expense_id = e.id
  AND e.is_credit = true
  AND e.sort_order = 999;

-- Step 2: delete the now-orphaned auto-created source rows.
DELETE FROM public.expenses
WHERE is_credit = true
  AND sort_order = 999;
