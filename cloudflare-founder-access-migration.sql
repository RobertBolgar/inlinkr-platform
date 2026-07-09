-- Add Founder Access entitlement table
-- This is a separate entitlement layer from Stripe subscriptions and referral rewards
-- Founder Access is permanent and does not overwrite plan/subscription_status

CREATE TABLE IF NOT EXISTS founder_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  is_comped INTEGER DEFAULT 0 NOT NULL,
  source TEXT DEFAULT NULL,
  granted_at TEXT NOT NULL,
  granted_by TEXT DEFAULT NULL,
  stripe_checkout_session_id TEXT DEFAULT NULL,
  stripe_payment_intent_id TEXT DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index for fast founder access checks
CREATE INDEX IF NOT EXISTS idx_founder_access_user_id ON founder_access(user_id);
CREATE INDEX IF NOT EXISTS idx_founder_access_is_comped ON founder_access(is_comped);
