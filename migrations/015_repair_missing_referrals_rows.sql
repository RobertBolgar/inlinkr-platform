-- Migration 015: Repair missing referrals rows from users.referred_by
-- This fixes data integrity issues where users.referred_by was populated
-- but the corresponding referrals row was never created (likely due to
-- the referrals INSERT failing after the users UPDATE succeeded).
--
-- This migration is idempotent: uses INSERT OR IGNORE and NOT EXISTS guards.

-- ============================================================
-- STEP 1: Verify the issue (diagnostic query, no changes)
-- ============================================================
-- SELECT COUNT(*) as orphaned_referrals
-- FROM users u
-- WHERE u.referred_by IS NOT NULL
--   AND NOT EXISTS (
--     SELECT 1 FROM referrals r
--     WHERE CAST(r.referred_user_id AS TEXT) = CAST(u.id AS TEXT)
--       AND CAST(r.referrer_user_id AS TEXT) = CAST(u.referred_by AS TEXT)
--   );

-- ============================================================
-- STEP 2: Backfill missing referrals rows
-- Skips self-referrals (id = referred_by) and avoids duplicates
-- ============================================================
INSERT OR IGNORE INTO referrals (
  id,
  referrer_user_id,
  referred_user_id,
  referral_code_used,
  captured_at,
  capture_source,
  attribution_status,
  created_at
)
SELECT
  lower(hex(randomblob(16))) AS id,
  CAST(u.referred_by AS TEXT) AS referrer_user_id,
  CAST(u.id AS TEXT) AS referred_user_id,
  NULL AS referral_code_used,  -- Unknown for historical repairs
  u.created_at AS captured_at,  -- Use user creation date as proxy
  'repair_backfill' AS capture_source,
  'pending' AS attribution_status,
  CURRENT_TIMESTAMP AS created_at
FROM users u
WHERE u.referred_by IS NOT NULL
  AND u.id != u.referred_by  -- Skip self-referrals (will be cleaned separately)
  AND NOT EXISTS (
    SELECT 1 FROM referrals r
    WHERE CAST(r.referred_user_id AS TEXT) = CAST(u.id AS TEXT)
      AND CAST(r.referrer_user_id AS TEXT) = CAST(u.referred_by AS TEXT)
  );

-- ============================================================
-- STEP 3: Verify repair (diagnostic query, no changes)
-- ============================================================
-- SELECT COUNT(*) as repaired_count
-- FROM referrals
-- WHERE capture_source = 'repair_backfill';
