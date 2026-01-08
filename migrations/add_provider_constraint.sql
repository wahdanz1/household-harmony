-- Migration: Add provider constraint to user_api_keys
-- The 'provider' column should already exist based on current usage.
-- This adds a CHECK constraint to ensure valid provider values.

-- Add CHECK constraint for valid providers
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_provider'
    ) THEN
        ALTER TABLE user_api_keys 
            ADD CONSTRAINT check_provider 
            CHECK (provider IN ('groq', 'gemini'));
    END IF;
END $$;

-- Ensure default value is set
ALTER TABLE user_api_keys 
    ALTER COLUMN provider SET DEFAULT 'gemini';
