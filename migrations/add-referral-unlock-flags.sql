-- Add referral unlock flags for 3/10 tier system
-- referral_3_unlocked: Tracks if user has unlocked 3-referral reward (7 days Pro)
-- referral_10_unlocked: Tracks if user has unlocked 10-referral reward (30 days Pro)
-- Rewards unlock once per tier, do not stack, 10-referral resets expiration

ALTER TABLE users ADD COLUMN referral_3_unlocked INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN referral_10_unlocked INTEGER DEFAULT 0 NOT NULL;
