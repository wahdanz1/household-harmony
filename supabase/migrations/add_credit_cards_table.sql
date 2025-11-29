-- Add enable_credit_cards column to households table
ALTER TABLE households
ADD COLUMN IF NOT EXISTS enable_credit_cards BOOLEAN DEFAULT false;

COMMENT ON COLUMN households.enable_credit_cards IS 'Whether credit card tracking is enabled for this household';

-- Create credit_cards table
CREATE TABLE IF NOT EXISTS credit_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  monthly_limit NUMERIC(10, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(household_id, name)
);

-- Create index for credit_cards
CREATE INDEX IF NOT EXISTS idx_credit_cards_household ON credit_cards(household_id);

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

-- Add credit_card_id column to existing credit_card_expenses table
ALTER TABLE credit_card_expenses
ADD COLUMN IF NOT EXISTS credit_card_id UUID REFERENCES credit_cards(id) ON DELETE CASCADE;

-- Create index for credit_card_id
CREATE INDEX IF NOT EXISTS idx_credit_expenses_card ON credit_card_expenses(credit_card_id);

-- Add comments
COMMENT ON TABLE credit_cards IS 'Credit cards with monthly spending limits';
COMMENT ON COLUMN credit_cards.name IS 'Name of the credit card (e.g., Norwegian Bank, Visa Gold)';
COMMENT ON COLUMN credit_cards.monthly_limit IS 'Monthly spending limit for this card';
COMMENT ON COLUMN credit_card_expenses.credit_card_id IS 'Reference to the credit card used for this expense';
