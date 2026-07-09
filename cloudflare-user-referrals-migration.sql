-- Create user_referrals table for tracking referral relationships
-- This table stores who referred each user and tracks qualification status
-- Links to existing 2-click activation logic for qualification

CREATE TABLE IF NOT EXISTS user_referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referred_user_id TEXT NOT NULL,
    referring_user_id TEXT NOT NULL,
    referral_code_id INTEGER NOT NULL,
    qualified INTEGER NOT NULL DEFAULT 0,
    qualified_at TEXT NULL,
    ip_hash TEXT NULL,  -- Hashed IP for anti-abuse protection
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (referring_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (referral_code_id) REFERENCES referral_codes(id) ON DELETE CASCADE
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_referrals_referred_user_id ON user_referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_user_referrals_referring_user_id ON user_referrals(referring_user_id);
CREATE INDEX IF NOT EXISTS idx_user_referrals_referral_code_id ON user_referrals(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_user_referrals_ip_hash ON user_referrals(ip_hash);
