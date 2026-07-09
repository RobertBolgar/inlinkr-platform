-- Add referral fields to users table for simplified referral model
-- These fields provide direct access to referral information without complex joins
-- Safe migration approach: try to add columns, ignore if they already exist

-- Note: SQLite/D1 doesn't support IF NOT EXISTS for columns
-- These ALTER statements will fail silently if columns already exist
-- This matches the pattern used in other migrations in this project

ALTER TABLE users ADD COLUMN referral_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN referred_by TEXT;
ALTER TABLE users ADD COLUMN signup_ip_hash TEXT;

-- Add indexes for performance (these are safe with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
