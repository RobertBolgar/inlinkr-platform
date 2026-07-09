-- Migration 011: Evolve referrals table for Creator Impact attribution
-- All fields are additive (nullable or have defaults) - no existing behavior is broken
-- These fields preserve lifetime paid conversion history for future Creator Impact features

-- Code that was used when this referral was captured
ALTER TABLE referrals ADD COLUMN referral_code_used TEXT DEFAULT NULL;

-- Semantic capture timestamp (mirrors created_at but named for domain clarity)
ALTER TABLE referrals ADD COLUMN captured_at TEXT DEFAULT NULL;

-- Source of the capture: 'signup', 'post_signup'
ALTER TABLE referrals ADD COLUMN capture_source TEXT DEFAULT NULL;

-- When this referral first qualified (mirrors qualified_at for semantic clarity)
ALTER TABLE referrals ADD COLUMN first_qualified_at TEXT DEFAULT NULL;

-- First paid conversion details
ALTER TABLE referrals ADD COLUMN first_paid_at TEXT DEFAULT NULL;
ALTER TABLE referrals ADD COLUMN first_paid_plan TEXT DEFAULT NULL;

-- Plan-specific first conversion timestamps
ALTER TABLE referrals ADD COLUMN first_pro_at TEXT DEFAULT NULL;
ALTER TABLE referrals ADD COLUMN first_founder_at TEXT DEFAULT NULL;

-- Most recent paid conversion (supports re-subscribe tracking)
ALTER TABLE referrals ADD COLUMN latest_paid_at TEXT DEFAULT NULL;
ALTER TABLE referrals ADD COLUMN latest_paid_plan TEXT DEFAULT NULL;

-- Total paid conversion events for this referred user (can convert, lapse, re-convert)
ALTER TABLE referrals ADD COLUMN paid_conversion_count INTEGER DEFAULT 0;

-- Boolean conversion flags for fast leaderboard/badge queries
ALTER TABLE referrals ADD COLUMN is_paid_conversion INTEGER DEFAULT 0;
ALTER TABLE referrals ADD COLUMN is_pro_conversion INTEGER DEFAULT 0;
ALTER TABLE referrals ADD COLUMN is_founder_conversion INTEGER DEFAULT 0;

-- High-level attribution lifecycle state
-- Values: 'pending' | 'qualified' | 'paid' | 'lapsed'
ALTER TABLE referrals ADD COLUMN attribution_status TEXT DEFAULT 'pending';

-- Extensible metadata for future attribution signals
ALTER TABLE referrals ADD COLUMN metadata_json TEXT DEFAULT NULL;

-- Indexes for Creator Impact queries
CREATE INDEX IF NOT EXISTS idx_referrals_is_paid_conversion ON referrals(is_paid_conversion);
CREATE INDEX IF NOT EXISTS idx_referrals_is_founder_conversion ON referrals(is_founder_conversion);
CREATE INDEX IF NOT EXISTS idx_referrals_attribution_status ON referrals(attribution_status);
CREATE INDEX IF NOT EXISTS idx_referrals_first_paid_at ON referrals(first_paid_at);
CREATE INDEX IF NOT EXISTS idx_referrals_referral_code_used ON referrals(referral_code_used);
