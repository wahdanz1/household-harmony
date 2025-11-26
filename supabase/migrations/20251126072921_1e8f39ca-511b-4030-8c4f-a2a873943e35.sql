-- Create savings_goals table
CREATE TABLE public.savings_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC NOT NULL,
  current_amount NUMERIC NOT NULL DEFAULT 0,
  target_date DATE,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  description TEXT,
  goal_type TEXT NOT NULL DEFAULT 'household' CHECK (goal_type IN ('household', 'personal')),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create savings_allocations table for tracking monthly contributions
CREATE TABLE public.savings_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  savings_goal_id UUID NOT NULL REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  amount NUMERIC NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_allocations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for savings_goals
CREATE POLICY "Users can view savings goals for their household"
  ON public.savings_goals FOR SELECT
  USING (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can insert savings goals for their household"
  ON public.savings_goals FOR INSERT
  WITH CHECK (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can update savings goals for their household"
  ON public.savings_goals FOR UPDATE
  USING (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can delete savings goals for their household"
  ON public.savings_goals FOR DELETE
  USING (is_household_member(auth.uid(), household_id));

-- RLS Policies for savings_allocations
CREATE POLICY "Users can view savings allocations for their household"
  ON public.savings_allocations FOR SELECT
  USING (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can insert savings allocations for their household"
  ON public.savings_allocations FOR INSERT
  WITH CHECK (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can update savings allocations for their household"
  ON public.savings_allocations FOR UPDATE
  USING (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can delete savings allocations for their household"
  ON public.savings_allocations FOR DELETE
  USING (is_household_member(auth.uid(), household_id));

-- Create trigger for updated_at on savings_goals
CREATE TRIGGER update_savings_goals_updated_at
  BEFORE UPDATE ON public.savings_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_savings_goals_household_id ON public.savings_goals(household_id);
CREATE INDEX idx_savings_allocations_household_id ON public.savings_allocations(household_id);
CREATE INDEX idx_savings_allocations_goal_id ON public.savings_allocations(savings_goal_id);
CREATE INDEX idx_savings_allocations_month ON public.savings_allocations(month);