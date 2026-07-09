-- Create clean referrals table for simplified referral model
-- This provides a direct relationship between referrer and referred users
-- Without the complexity of the previous referral_codes/user_referrals model

CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    referrer_user_id TEXT NOT NULL,
    referred_user_id TEXT NOT NULL UNIQUE,
    is_qualified INTEGER NOT NULL DEFAULT 0,
    qualified_at TEXT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referrer_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_user_id ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_is_qualified ON referrals(is_qualified);
