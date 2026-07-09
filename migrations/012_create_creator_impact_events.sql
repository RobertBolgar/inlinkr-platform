-- Migration 012: Create creator_impact_events append-only impact ledger
-- This is the permanent record of all meaningful Creator Impact events.
-- Rows are NEVER deleted or updated - new events are always appended.
-- Supports: referral_captured, referral_qualified, pro_converted, founder_converted,
--           reward_granted, badge_awarded, ambassador_status_changed

CREATE TABLE IF NOT EXISTS creator_impact_events (
  id TEXT PRIMARY KEY,

  -- The referrer who owns this impact record
  user_id INTEGER NOT NULL,

  -- The referred user who triggered this event (nullable for non-referral events)
  referred_user_id INTEGER DEFAULT NULL,

  -- FK to referrals table (nullable for reward/badge events not tied to one referral)
  referral_id TEXT DEFAULT NULL,

  -- Event classification
  -- Known values: referral_captured | referral_qualified | pro_converted |
  --               founder_converted | reward_granted | badge_awarded | ambassador_status_changed
  event_type TEXT NOT NULL,

  -- Plan context for conversion/reward events (e.g. 'pro', 'pro_plus', 'founder')
  plan TEXT DEFAULT NULL,

  -- Arbitrary JSON payload for event-specific data
  event_data_json TEXT DEFAULT NULL,

  -- How this event was recorded
  -- Values: 'live' | 'backfill' | 'admin_repair'
  event_source TEXT DEFAULT 'live' NOT NULL,

  -- Whether this row was backfilled vs recorded live (for filtering/auditing)
  is_backfill INTEGER DEFAULT 0 NOT NULL,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cie_user_id ON creator_impact_events(user_id);
CREATE INDEX IF NOT EXISTS idx_cie_event_type ON creator_impact_events(event_type);
CREATE INDEX IF NOT EXISTS idx_cie_referred_user_id ON creator_impact_events(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_cie_referral_id ON creator_impact_events(referral_id);
CREATE INDEX IF NOT EXISTS idx_cie_created_at ON creator_impact_events(created_at);
CREATE INDEX IF NOT EXISTS idx_cie_is_backfill ON creator_impact_events(is_backfill);
