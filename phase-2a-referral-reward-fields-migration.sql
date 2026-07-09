-- Phase 2A: Add referral reward entitlement fields and migrate existing referral_reward users
-- This migration separates referral reward state from Stripe subscription status

-- Add new referral reward fields to users table
ALTER TABLE users ADD COLUMN referral_reward_active INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN referral_reward_plan TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN referral_reward_expires_at TEXT DEFAULT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_referral_reward_active ON users(referral_reward_active);
CREATE INDEX IF NOT EXISTS idx_users_referral_reward_expires ON users(referral_reward_expires_at);

-- Migrate existing users currently on referral_reward
-- This moves referral reward state from subscription_status to dedicated fields
UPDATE users 
SET 
  referral_reward_active = 1,
  referral_reward_plan = COALESCE(plan, 'pro'),
  referral_reward_expires_at = subscription_current_period_end,
  subscription_status = NULL,
  subscription_current_period_end = NULL
WHERE subscription_status = 'referral_reward';
