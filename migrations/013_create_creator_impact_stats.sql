-- Migration 013: Create creator_impact_stats rollup table
-- Powers the Settings Creator Impact section, badges, leaderboards, Founder rewards,
-- and ambassador status. Recomputable from creator_impact_events but stored for
-- query performance. Updated on every meaningful referral event.

CREATE TABLE IF NOT EXISTS creator_impact_stats (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,

  -- Referral volume counters
  total_referrals INTEGER DEFAULT 0 NOT NULL,
  qualified_referrals INTEGER DEFAULT 0 NOT NULL,
  paid_referrals INTEGER DEFAULT 0 NOT NULL,
  pro_referrals INTEGER DEFAULT 0 NOT NULL,
  founder_referrals INTEGER DEFAULT 0 NOT NULL,

  -- Reward tracking
  rewards_granted INTEGER DEFAULT 0 NOT NULL,

  -- Lifecycle timestamps
  first_referral_at TEXT DEFAULT NULL,
  last_referral_at TEXT DEFAULT NULL,
  first_paid_referral_at TEXT DEFAULT NULL,
  last_paid_referral_at TEXT DEFAULT NULL,

  -- Future: ambassador program and badge state
  ambassador_status TEXT DEFAULT NULL,
  badges_json TEXT DEFAULT NULL,

  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cis_user_id ON creator_impact_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_cis_total_referrals ON creator_impact_stats(total_referrals);
CREATE INDEX IF NOT EXISTS idx_cis_paid_referrals ON creator_impact_stats(paid_referrals);
CREATE INDEX IF NOT EXISTS idx_cis_founder_referrals ON creator_impact_stats(founder_referrals);
CREATE INDEX IF NOT EXISTS idx_cis_ambassador_status ON creator_impact_stats(ambassador_status);
