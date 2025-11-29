-- Add enable_credit_cards column to households table
ALTER TABLE households
ADD COLUMN IF NOT EXISTS enable_credit_cards BOOLEAN DEFAULT false;

COMMENT ON COLUMN households.enable_credit_cards IS 'Whether credit card tracking is enabled for this household';

-- Create credit_cards table
CREATE TABLE IF NOT EXISTS credit_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,  -- e.g., "Norwegian Bank", "Visa Gold"
  monthly_limit NUMERIC(10, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(household_id, name)
);

-- Create index for credit_cards
CREATE INDEX idx_credit_cards_household ON credit_cards(household_id);

-- Enable RLS for credit_cards
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for credit_cards
CREATE POLICY "Users can view their household's credit cards"
  ON credit_cards FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert credit cards for their household"
  ON credit_cards FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their household's credit cards"
  ON credit_cards FOR UPDATE
  USING (
    household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their household's credit cards"
  ON credit_cards FOR DELETE
  USING (
    household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid()
    )
  );

-- Create credit_card_expenses table
CREATE TABLE IF NOT EXISTS credit_card_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  credit_card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_credit_expenses_household_month ON credit_card_expenses(household_id, month);
CREATE INDEX idx_credit_expenses_card ON credit_card_expenses(credit_card_id);
CREATE INDEX idx_credit_expenses_category ON credit_card_expenses(category);

-- Enable Row Level Security
ALTER TABLE credit_card_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their household's credit expenses
CREATE POLICY "Users can view their household's credit expenses"
  ON credit_card_expenses FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can insert credit expenses for their household
CREATE POLICY "Users can insert credit expenses for their household"
  ON credit_card_expenses FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can update their household's credit expenses
CREATE POLICY "Users can update their household's credit expenses"
  ON credit_card_expenses FOR UPDATE
  USING (
    household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can delete their household's credit expenses
CREATE POLICY "Users can delete their household's credit expenses"
  ON credit_card_expenses FOR DELETE
  USING (
    household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid()
    )
  );

-- Add table and column comments for documentation
COMMENT ON TABLE credit_cards IS 'Credit cards with monthly spending limits';
COMMENT ON COLUMN credit_cards.name IS 'Name of the credit card (e.g., Norwegian Bank, Visa Gold)';
COMMENT ON COLUMN credit_cards.monthly_limit IS 'Monthly spending limit for this card';

COMMENT ON TABLE credit_card_expenses IS 'Tracks credit card transactions by month and category';
COMMENT ON COLUMN credit_card_expenses.month IS 'First day of the month (e.g., 2025-11-01)';
COMMENT ON COLUMN credit_card_expenses.category IS 'Category: groceries, fuel, shopping, dining_out, entertainment, car_repairs, travel, health, other';
