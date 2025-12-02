-- Add billing_day and billing_month columns to subscriptions table
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS billing_day INTEGER,
ADD COLUMN IF NOT EXISTS billing_month INTEGER;

COMMENT ON COLUMN public.subscriptions.billing_day IS 'Day of the month (1-31) for yearly/quarterly billing';
COMMENT ON COLUMN public.subscriptions.billing_month IS 'Month of the year (1-12) for yearly billing';
