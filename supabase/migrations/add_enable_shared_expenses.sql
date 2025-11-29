-- Add enable_shared_expenses column to households table
ALTER TABLE households
ADD COLUMN IF NOT EXISTS enable_shared_expenses BOOLEAN DEFAULT true;

COMMENT ON COLUMN households.enable_shared_expenses IS 'Whether shared expense tracking with co-parents is enabled for this household';
