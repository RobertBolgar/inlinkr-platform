-- Add referral_pro_plus_granted flag to users table
-- This field tracks whether a user has already received the one-time Pro+ reward for 25 referrals

ALTER TABLE users ADD COLUMN referral_pro_plus_granted INTEGER DEFAULT 0 NOT NULL;

-- This field means:
-- 0 = user has never received the 25-referral Pro+ reward
-- 1 = user already received the 25-referral Pro+ reward (one-time unlock)
