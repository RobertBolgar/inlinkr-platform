-- SQL to fix existing decimal values in referral fields
-- Run this in D1 to clean up bad data

-- Fix users.referred_by decimal values
UPDATE users
SET referred_by = CAST(CAST(referred_by AS INTEGER) AS TEXT)
WHERE referred_by LIKE '%.0';

-- Fix referrals.referrer_user_id decimal values  
UPDATE referrals
SET referrer_user_id = CAST(CAST(referrer_user_id AS INTEGER) AS TEXT)
WHERE referrer_user_id LIKE '%.0';

-- Fix referrals.referred_user_id decimal values
UPDATE referrals
SET referred_user_id = CAST(CAST(referred_user_id AS INTEGER) AS TEXT)
WHERE referred_user_id LIKE '%.0';

-- Verify the fixes
SELECT 'users table - after fix' as table_name, id, referred_by FROM users WHERE referred_by IS NOT NULL;
SELECT 'referrals table - after fix' as table_name, id, referrer_user_id, referred_user_id FROM referrals;
