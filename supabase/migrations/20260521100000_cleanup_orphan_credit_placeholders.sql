-- Cleanup orphan one-time entries left by the credit-sources backfill.
--
-- Context: 20260519130000_credit_sources_to_one_time.sql converted every
-- monthly_expenses row that pointed to an auto-created is_credit
-- (sort_order=999, budget=0) source into a one-time entry. Some of those
-- monthly_expenses rows were empty carry-forward placeholders created by
-- the Expenses page when navigating to the current month: they had
-- expense_id set but no actual_amount and no real data. After the backfill
-- they became "one-time entries with no amount" — visible in the current
-- month with no UX to remove them.
--
-- Discriminating criterion: a row that has no actual_amount, no notes, AND
-- whose one_time_name is literally a credit-category label (the migration's
-- own output). User-created one-offs via TemporaryExpenseFormDialog have
-- free-text descriptions and an amount the user typed in, so they won't
-- match all four conditions simultaneously.

DELETE FROM public.monthly_expenses
WHERE expense_id IS NULL
  AND encrypted_actual_amount IS NULL
  AND notes IS NULL
  AND one_time_category IN (
    'groceries', 'fuel', 'shopping', 'dining_out',
    'entertainment', 'car_repairs', 'travel', 'healthcare', 'other'
  )
  AND one_time_name IN (
    'Groceries', 'Fuel', 'Shopping', 'Dining Out',
    'Entertainment', 'Car Repairs', 'Travel', 'Healthcare', 'Other'
  );
