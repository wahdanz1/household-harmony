-- ============================================
-- Rename regular_expenses → expenses
-- ============================================
-- Run this BEFORE the encryption migration
-- ============================================

-- ============================================
-- STEP 1: Rename the table
-- ============================================

ALTER TABLE regular_expenses RENAME TO expenses;


-- ============================================
-- STEP 2: Rename the foreign key column in monthly_expenses
-- ============================================

ALTER TABLE monthly_expenses 
RENAME COLUMN regular_expense_id TO expense_id;


-- ============================================
-- STEP 3: Update foreign key constraints
-- ============================================

-- Drop old foreign key constraint
ALTER TABLE monthly_expenses 
DROP CONSTRAINT IF EXISTS monthly_expenses_regular_expense_id_fkey;

-- Create new foreign key constraint with updated names
ALTER TABLE monthly_expenses
ADD CONSTRAINT monthly_expenses_expense_id_fkey 
FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE;

-- Update the expenses table foreign key name
ALTER TABLE expenses 
DROP CONSTRAINT IF EXISTS regular_expenses_household_id_fkey;

ALTER TABLE expenses
ADD CONSTRAINT expenses_household_id_fkey 
FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE;


-- ============================================
-- STEP 4: Update unique constraints
-- ============================================

-- Drop old unique constraint on monthly_expenses
ALTER TABLE monthly_expenses 
DROP CONSTRAINT IF EXISTS monthly_expenses_regular_expense_id_month_key;

-- Create new unique constraint
ALTER TABLE monthly_expenses
ADD CONSTRAINT monthly_expenses_expense_id_month_key 
UNIQUE (expense_id, month);


-- ============================================
-- STEP 5: Update RLS policies (drop and recreate)
-- ============================================

-- Drop old policies on expenses table
DROP POLICY IF EXISTS "Users can view regular expenses in their household" ON expenses;
DROP POLICY IF EXISTS "Users can insert regular expenses in their household" ON expenses;
DROP POLICY IF EXISTS "Users can update regular expenses in their household" ON expenses;
DROP POLICY IF EXISTS "Users can delete regular expenses in their household" ON expenses;

-- Create new policies with updated names
CREATE POLICY "Users can view expenses in their household"
ON expenses FOR SELECT
USING (
  household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert expenses in their household"
ON expenses FOR INSERT
WITH CHECK (
  household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update expenses in their household"
ON expenses FOR UPDATE
USING (
  household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete expenses in their household"
ON expenses FOR DELETE
USING (
  household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  )
);


-- ============================================
-- STEP 6: Update any database functions that reference regular_expenses
-- ============================================

-- Check if function exists and update (you may need to recreate your functions)
-- This is a placeholder - update based on your actual functions

-- If you have functions referencing regular_expenses, they need to be recreated
-- Example: calculate_expense_default or similar


-- ============================================
-- VERIFICATION
-- ============================================

-- Verify table renamed
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'expenses';

-- Verify column renamed
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'monthly_expenses' AND column_name = 'expense_id';

-- Verify foreign keys
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND (tc.table_name = 'expenses' OR tc.table_name = 'monthly_expenses');

-- Verify policies
SELECT policyname, tablename 
FROM pg_policies 
WHERE tablename = 'expenses';
