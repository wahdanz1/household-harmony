-- Create insurances table
CREATE TABLE public.insurances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT,
  type TEXT NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  payment_frequency TEXT NOT NULL DEFAULT 'yearly',
  next_payment_date DATE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.insurances ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view insurances for their household"
  ON public.insurances
  FOR SELECT
  USING (public.is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can insert insurances for their household"
  ON public.insurances
  FOR INSERT
  WITH CHECK (public.is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can update insurances for their household"
  ON public.insurances
  FOR UPDATE
  USING (public.is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can delete insurances for their household"
  ON public.insurances
  FOR DELETE
  USING (public.is_household_member(auth.uid(), household_id));

-- Create trigger for updated_at
CREATE TRIGGER update_insurances_updated_at
  BEFORE UPDATE ON public.insurances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();