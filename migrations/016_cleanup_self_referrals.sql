-- Migration 016: Cleanup self-referrals from users.referred_by
-- Clears cases where users.referred_by = users.id (self-referral)
-- This is data corruption that should never occur.
--
-- This migration is idempotent: safe to re-run.

-- ============================================================
-- STEP 1: Verify the issue (diagnostic query, no changes)
-- ============================================================
-- SELECT COUNT(*) as self_referrals
-- FROM users
-- WHERE referred_by IS NOT NULL
--   AND id = referred_by;

-- ============================================================
-- STEP 2: Clear self-referrals
-- ============================================================
UPDATE users
SET referred_by = NULL
WHERE referred_by IS NOT NULL
  AND id = referred_by;

-- ============================================================
-- STEP 3: Verify cleanup (diagnostic query, no changes)
-- ============================================================
-- SELECT COUNT(*) as remaining_self_referrals
-- FROM users
-- WHERE referred_by IS NOT NULL
--   AND id = referred_by;
