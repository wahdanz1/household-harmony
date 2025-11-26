-- Create co_parents table
CREATE TABLE public.co_parents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.co_parents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view co-parents for their household"
  ON public.co_parents FOR SELECT
  USING (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can insert co-parents for their household"
  ON public.co_parents FOR INSERT
  WITH CHECK (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can update co-parents for their household"
  ON public.co_parents FOR UPDATE
  USING (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can delete co-parents for their household"
  ON public.co_parents FOR DELETE
  USING (is_household_member(auth.uid(), household_id));

-- Add shared fields to insurances table
ALTER TABLE public.insurances
  ADD COLUMN is_shared BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN co_parent_id UUID REFERENCES public.co_parents(id) ON DELETE SET NULL,
  ADD COLUMN share_percentage NUMERIC NOT NULL DEFAULT 50;

-- Add shared fields to monthly_incomes table
ALTER TABLE public.monthly_incomes
  ADD COLUMN is_shared BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN co_parent_id UUID REFERENCES public.co_parents(id) ON DELETE SET NULL,
  ADD COLUMN share_percentage NUMERIC NOT NULL DEFAULT 50;

-- Create shared_expenses table
CREATE TABLE public.shared_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  co_parent_id UUID NOT NULL REFERENCES public.co_parents(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shared expenses for their household"
  ON public.shared_expenses FOR SELECT
  USING (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can insert shared expenses for their household"
  ON public.shared_expenses FOR INSERT
  WITH CHECK (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can update shared expenses for their household"
  ON public.shared_expenses FOR UPDATE
  USING (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can delete shared expenses for their household"
  ON public.shared_expenses FOR DELETE
  USING (is_household_member(auth.uid(), household_id));

-- Create co_parent_settlements table
CREATE TABLE public.co_parent_settlements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  co_parent_id UUID NOT NULL REFERENCES public.co_parents(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  income_received NUMERIC NOT NULL DEFAULT 0,
  your_share_of_income NUMERIC NOT NULL DEFAULT 0,
  insurance_paid NUMERIC NOT NULL DEFAULT 0,
  their_share_of_insurance NUMERIC NOT NULL DEFAULT 0,
  shared_expenses_total NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  settled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(household_id, co_parent_id, month)
);

ALTER TABLE public.co_parent_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view settlements for their household"
  ON public.co_parent_settlements FOR SELECT
  USING (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can insert settlements for their household"
  ON public.co_parent_settlements FOR INSERT
  WITH CHECK (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can update settlements for their household"
  ON public.co_parent_settlements FOR UPDATE
  USING (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can delete settlements for their household"
  ON public.co_parent_settlements FOR DELETE
  USING (is_household_member(auth.uid(), household_id));

-- Add trigger for updated_at on co_parents
CREATE TRIGGER update_co_parents_updated_at
  BEFORE UPDATE ON public.co_parents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();