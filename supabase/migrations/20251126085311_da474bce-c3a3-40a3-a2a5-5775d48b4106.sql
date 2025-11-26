-- Make income_source_id nullable to support one-time incomes
ALTER TABLE public.monthly_incomes
ALTER COLUMN income_source_id DROP NOT NULL;

-- Add column for one-time income names
ALTER TABLE public.monthly_incomes
ADD COLUMN one_time_name text;

-- Add comment for clarity
COMMENT ON COLUMN public.monthly_incomes.one_time_name IS 'Used for one-time income entries where income_source_id is null (e.g., gifts, lottery, found money)';