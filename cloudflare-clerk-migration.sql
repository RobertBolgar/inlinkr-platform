-- Add clerk_user_id column to users table
-- This will be the canonical auth identity from Clerk
-- Note: Cannot add UNIQUE constraint to existing table with data, so we add column first then create unique index

ALTER TABLE users ADD COLUMN clerk_user_id TEXT;

-- Create unique index on clerk_user_id for fast lookups and uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id);
