-- ============================================
-- Client-Side Encryption Schema Migration
-- ============================================
-- Run these SQL statements in Supabase SQL Editor
-- 
-- This adds encrypted columns to store sensitive financial data.
-- Original columns are kept for backward compatibility during migration.
-- ============================================

-- ============================================
-- PART 1: Profiles Table (Encryption Keys)
-- ============================================

-- Add columns for storing encrypted DEK (Data Encryption Key)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS encrypted_dek TEXT,
ADD COLUMN IF NOT EXISTS dek_salt TEXT,
ADD COLUMN IF NOT EXISTS dek_iv TEXT,
ADD COLUMN IF NOT EXISTS encryption_version INTEGER DEFAULT 0;

-- Comment for documentation
COMMENT ON COLUMN profiles.encrypted_dek IS 'Base64-encoded AES-256-GCM encrypted Data Encryption Key';
COMMENT ON COLUMN profiles.dek_salt IS 'Base64-encoded PBKDF2 salt for key derivation';
COMMENT ON COLUMN profiles.dek_iv IS 'Base64-encoded initialization vector for DEK encryption';
COMMENT ON COLUMN profiles.encryption_version IS 'Encryption schema version (0=unencrypted, 1=AES-256-GCM)';


-- ============================================
-- PART 2: Income Sources
-- ============================================

ALTER TABLE income_sources
ADD COLUMN IF NOT EXISTS encrypted_name TEXT,
ADD COLUMN IF NOT EXISTS encrypted_default_amount TEXT,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false;


-- ============================================
-- PART 3: Monthly Incomes
-- ============================================

ALTER TABLE monthly_incomes
ADD COLUMN IF NOT EXISTS encrypted_amount TEXT,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false;


-- ============================================
-- PART 4: Expenses (formerly regular_expenses)
-- ============================================

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS encrypted_name TEXT,
ADD COLUMN IF NOT EXISTS encrypted_default_amount TEXT,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false;


-- ============================================
-- PART 5: Monthly Expenses
-- ============================================

ALTER TABLE monthly_expenses
ADD COLUMN IF NOT EXISTS encrypted_amount TEXT,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false;


-- ============================================
-- PART 6: Subscriptions
-- ============================================

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS encrypted_name TEXT,
ADD COLUMN IF NOT EXISTS encrypted_amount TEXT,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false;


-- ============================================
-- PART 7: Insurances
-- ============================================

ALTER TABLE insurances
ADD COLUMN IF NOT EXISTS encrypted_name TEXT,
ADD COLUMN IF NOT EXISTS encrypted_total_amount TEXT,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false;


-- ============================================
-- PART 8: Savings Goals
-- ============================================

ALTER TABLE savings_goals
ADD COLUMN IF NOT EXISTS encrypted_name TEXT,
ADD COLUMN IF NOT EXISTS encrypted_target_amount TEXT,
ADD COLUMN IF NOT EXISTS encrypted_current_amount TEXT,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false;


-- ============================================
-- PART 9: Credit Card Expenses
-- ============================================

ALTER TABLE credit_card_expenses
ADD COLUMN IF NOT EXISTS encrypted_description TEXT,
ADD COLUMN IF NOT EXISTS encrypted_amount TEXT,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false;


-- ============================================
-- PART 10: Shared Expenses
-- ============================================

ALTER TABLE shared_expenses
ADD COLUMN IF NOT EXISTS encrypted_description TEXT,
ADD COLUMN IF NOT EXISTS encrypted_amount TEXT,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false;


-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify the migration was successful:

-- Check profiles table has new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('encrypted_dek', 'dek_salt', 'dek_iv', 'encryption_version');

-- Check all tables have encrypted columns
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE column_name LIKE 'encrypted_%' OR column_name = 'is_encrypted'
ORDER BY table_name, column_name;
