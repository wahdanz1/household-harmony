-- Add shared income columns to income_sources table

-- Add is_shared column (boolean, defaults to false)
ALTER TABLE income_sources
ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false;

-- Add co_parent_id column (foreign key to co_parents table)
ALTER TABLE income_sources
ADD COLUMN IF NOT EXISTS co_parent_id UUID REFERENCES co_parents(id) ON DELETE SET NULL;

-- Add share_percentage column (numeric, defaults to 50)
ALTER TABLE income_sources
ADD COLUMN IF NOT EXISTS share_percentage NUMERIC DEFAULT 50;

-- Add comments for documentation
COMMENT ON COLUMN income_sources.is_shared IS 'Whether this income is shared with a co-parent';
COMMENT ON COLUMN income_sources.co_parent_id IS 'The co-parent this income is shared with (if is_shared is true)';
COMMENT ON COLUMN income_sources.share_percentage IS 'Your percentage share of the income (0-100)';
