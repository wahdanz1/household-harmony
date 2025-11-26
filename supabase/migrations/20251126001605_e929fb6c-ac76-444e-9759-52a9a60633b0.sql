-- Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  next_billing_date DATE,
  category TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies for subscriptions
CREATE POLICY "Users can view subscriptions for their household"
  ON public.subscriptions
  FOR SELECT
  USING (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can insert subscriptions for their household"
  ON public.subscriptions
  FOR INSERT
  WITH CHECK (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can update subscriptions for their household"
  ON public.subscriptions
  FOR UPDATE
  USING (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can delete subscriptions for their household"
  ON public.subscriptions
  FOR DELETE
  USING (is_household_member(auth.uid(), household_id));

-- Create trigger for updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();