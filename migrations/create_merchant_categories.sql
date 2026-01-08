-- Create merchant_categories table to store AI-learned mappings
CREATE TABLE IF NOT EXISTS merchant_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  household_id uuid REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  merchant_name text NOT NULL,
  category text NOT NULL,
  confidence text CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  times_used int DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add unique constraint to prevent duplicate merchant mappings per user/household
ALTER TABLE merchant_categories ADD CONSTRAINT unique_merchant_user_household UNIQUE (user_id, household_id, merchant_name);

-- Add after the unique constraint
COMMENT ON CONSTRAINT unique_merchant_user_household ON merchant_categories IS 
'Use ON CONFLICT (user_id, household_id, merchant_name) DO UPDATE SET category = EXCLUDED.category, times_used = merchant_categories.times_used + 1, updated_at = now() when inserting';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_merchant_categories_user ON merchant_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_merchant_categories_household ON merchant_categories(household_id);
CREATE INDEX IF NOT EXISTS idx_merchant_categories_merchant ON merchant_categories(merchant_name);

-- Enable RLS
ALTER TABLE merchant_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own merchant mappings') THEN
        CREATE POLICY "Users can view their own merchant mappings"
            ON merchant_categories FOR SELECT
            USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own merchant mappings') THEN
        CREATE POLICY "Users can insert their own merchant mappings"
            ON merchant_categories FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own merchant mappings') THEN
        CREATE POLICY "Users can update their own merchant mappings"
            ON merchant_categories FOR UPDATE
            USING (auth.uid() = user_id);
    END IF;
END $$;
