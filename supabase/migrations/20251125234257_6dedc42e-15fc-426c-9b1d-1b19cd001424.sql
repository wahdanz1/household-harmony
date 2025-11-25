-- Create enums for income and expense types
CREATE TYPE public.income_category AS ENUM ('salary', 'business_income', 'government_benefits', 'investment_income', 'gift', 'other');
CREATE TYPE public.income_type AS ENUM ('static', 'variable');
CREATE TYPE public.expense_type AS ENUM ('static', 'dynamic');

-- Create income_sources table
CREATE TABLE public.income_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  category public.income_category NOT NULL,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type public.income_type NOT NULL,
  default_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create monthly_incomes table
CREATE TABLE public.monthly_incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  income_source_id UUID NOT NULL REFERENCES public.income_sources(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(income_source_id, month)
);

-- Create expense_categories table
CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type public.expense_type NOT NULL,
  default_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create monthly_expenses table
CREATE TABLE public.monthly_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_category_id UUID NOT NULL REFERENCES public.expense_categories(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(expense_category_id, month)
);

-- Enable RLS on all new tables
ALTER TABLE public.income_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for income_sources
CREATE POLICY "Users can view income sources for their household"
  ON public.income_sources FOR SELECT
  USING (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can insert income sources for their household"
  ON public.income_sources FOR INSERT
  WITH CHECK (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can update income sources for their household"
  ON public.income_sources FOR UPDATE
  USING (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can delete income sources for their household"
  ON public.income_sources FOR DELETE
  USING (is_household_member(auth.uid(), household_id));

-- RLS Policies for monthly_incomes
CREATE POLICY "Users can view monthly incomes for their household"
  ON public.monthly_incomes FOR SELECT
  USING (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can insert monthly incomes for their household"
  ON public.monthly_incomes FOR INSERT
  WITH CHECK (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can update monthly incomes for their household"
  ON public.monthly_incomes FOR UPDATE
  USING (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can delete monthly incomes for their household"
  ON public.monthly_incomes FOR DELETE
  USING (is_household_member(auth.uid(), household_id));

-- RLS Policies for expense_categories
CREATE POLICY "Users can view expense categories for their household"
  ON public.expense_categories FOR SELECT
  USING (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can insert expense categories for their household"
  ON public.expense_categories FOR INSERT
  WITH CHECK (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can update expense categories for their household"
  ON public.expense_categories FOR UPDATE
  USING (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can delete expense categories for their household"
  ON public.expense_categories FOR DELETE
  USING (is_household_member(auth.uid(), household_id));

-- RLS Policies for monthly_expenses
CREATE POLICY "Users can view monthly expenses for their household"
  ON public.monthly_expenses FOR SELECT
  USING (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can insert monthly expenses for their household"
  ON public.monthly_expenses FOR INSERT
  WITH CHECK (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can update monthly expenses for their household"
  ON public.monthly_expenses FOR UPDATE
  USING (is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can delete monthly expenses for their household"
  ON public.monthly_expenses FOR DELETE
  USING (is_household_member(auth.uid(), household_id));

-- Create updated_at triggers
CREATE TRIGGER update_income_sources_updated_at
  BEFORE UPDATE ON public.income_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expense_categories_updated_at
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_income_sources_household ON public.income_sources(household_id);
CREATE INDEX idx_monthly_incomes_household ON public.monthly_incomes(household_id);
CREATE INDEX idx_monthly_incomes_month ON public.monthly_incomes(month);
CREATE INDEX idx_expense_categories_household ON public.expense_categories(household_id);
CREATE INDEX idx_monthly_expenses_household ON public.monthly_expenses(household_id);
CREATE INDEX idx_monthly_expenses_month ON public.monthly_expenses(month);