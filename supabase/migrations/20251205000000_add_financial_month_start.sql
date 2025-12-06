-- Add financial_month_start column to households table
-- This allows each household to configure when their financial month starts (1-28)
-- Default is 25th (e.g., Nov 25 - Dec 24)

-- Add the column with default value
ALTER TABLE households 
ADD COLUMN IF NOT EXISTS financial_month_start INTEGER DEFAULT 25;

-- Add check constraint to ensure valid day range (1-28)
ALTER TABLE households
ADD CONSTRAINT valid_financial_month_start 
CHECK (financial_month_start >= 1 AND financial_month_start <= 28);

-- Add comment explaining the column
COMMENT ON COLUMN households.financial_month_start IS 
'Day of month when financial month starts (1-28). Determines when income/expenses auto-fill. Default: 25 (e.g., Nov 25 - Dec 24)';
