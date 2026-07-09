-- Create feature_flags table for D1-backed feature flags
-- This table allows enabling/disabling system features at runtime
-- Used for safe rollout and quick shutdown of referral system components

CREATE TABLE IF NOT EXISTS feature_flags (
    key TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 0,
    value TEXT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Insert default feature flags only if they don't exist
-- referrals_enabled: Master switch for entire referral system (default: false)
-- referrals_ip_check_enabled: IP-based anti-abuse protection (default: true)  
-- referrals_rewards_enabled: Reward granting system (default: false)

INSERT OR IGNORE INTO feature_flags (key, enabled, value) VALUES
    ('referrals_enabled', 0, NULL),
    ('referrals_ip_check_enabled', 1, NULL),
    ('referrals_rewards_enabled', 0, NULL);
