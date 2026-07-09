-- Create referral_rewards table for tracking milestone rewards
-- This table tracks which users have received which referral milestone rewards

CREATE TABLE IF NOT EXISTS referral_rewards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  milestone_count INTEGER NOT NULL,
  reward_plan TEXT NOT NULL,
  reward_days INTEGER NOT NULL,
  granted_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create unique constraint to prevent duplicate rewards per user per milestone
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_rewards_user_milestone ON referral_rewards(user_id, milestone_count);

-- Create index for user reward lookups
CREATE INDEX IF NOT EXISTS idx_referral_rewards_user_id ON referral_rewards(user_id);

-- Create index for expiration tracking
CREATE INDEX IF NOT EXISTS idx_referral_rewards_expires_at ON referral_rewards(expires_at);
