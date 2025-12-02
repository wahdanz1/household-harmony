-- Disable shared expenses by default for new households
ALTER TABLE public.households 
ALTER COLUMN enable_shared_expenses SET DEFAULT false;
