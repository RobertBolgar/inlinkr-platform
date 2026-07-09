-- Migration 017: Backfill referral qualification for repaired rows
-- This migration applies the same qualification rules used by tryQualifyReferral
-- to pending/unqualified referrals that may have qualifying activity before
-- the referral row existed (e.g., repaired rows from migration 015).
--
-- Qualification rules (same as production):
-- 1. referrals_enabled feature flag must be ON
-- 2. Referred user must have at least 1 link
-- 3. Referred user must have >= 2 click events
-- 4. If referrals_ip_check_enabled is ON: at least one click must be from
--    a different IP hash than the referrer's signup IP hash
--
-- This migration is idempotent: uses NOT EXISTS guards and only processes
-- unqualified referrals.

-- ============================================================
-- STEP 1: Verify pending referrals (diagnostic query, no changes)
-- ============================================================
-- SELECT COUNT(*) as pending_referrals
-- FROM referrals
-- WHERE is_qualified = 0;

-- ============================================================
-- STEP 2: Qualify referrals that meet the rules
-- ============================================================
-- This query implements the same logic as tryQualifyReferral in SQL
UPDATE referrals
SET
  is_qualified      = 1,
  qualified_at      = CURRENT_TIMESTAMP,
  first_qualified_at = CURRENT_TIMESTAMP,
  attribution_status = 'qualified'
WHERE id IN (
  -- Find unqualified referrals that meet all criteria
  SELECT r.id
  FROM referrals r
  -- Must be unqualified
  WHERE r.is_qualified = 0
    -- referrals_enabled must be ON
    AND EXISTS (SELECT 1 FROM feature_flags WHERE key = 'referrals_enabled' AND enabled = 1)
    -- Referred user must have at least 1 link
    AND EXISTS (
      SELECT 1 FROM links l
      WHERE CAST(l.user_id AS TEXT) = CAST(r.referred_user_id AS TEXT)
    )
    -- Referred user must have >= 2 click events
    AND (
      SELECT COUNT(*)
      FROM click_events ce
      JOIN links l ON ce.link_id = l.id
      WHERE CAST(l.user_id AS TEXT) = CAST(r.referred_user_id AS TEXT)
    ) >= 2
    -- IP check if enabled
    AND (
      -- If IP check is disabled, skip this condition
      NOT EXISTS (SELECT 1 FROM feature_flags WHERE key = 'referrals_ip_check_enabled' AND enabled = 1)
      OR (
        -- IP check is enabled: require at least one click from different IP hash
        EXISTS (
          SELECT 1
          FROM click_events ce
          JOIN links l ON ce.link_id = l.id
          WHERE CAST(l.user_id AS TEXT) = CAST(r.referred_user_id AS TEXT)
            AND ce.ip_hash IS NOT NULL
            AND ce.ip_hash != (
              SELECT u.signup_ip_hash
              FROM users u
              WHERE CAST(u.id AS TEXT) = CAST(r.referrer_user_id AS TEXT)
            )
        )
        -- If referrer has no signup IP hash, skip IP check safely
        OR NOT EXISTS (
          SELECT 1 FROM users u
          WHERE CAST(u.id AS TEXT) = CAST(r.referrer_user_id AS TEXT)
            AND u.signup_ip_hash IS NOT NULL
        )
      )
    )
);

-- ============================================================
-- STEP 3: Emit creator_impact_events for newly qualified referrals
-- ============================================================
INSERT INTO creator_impact_events (
  id, user_id, referred_user_id, referral_id, event_type,
  plan, event_data_json, event_source, is_backfill, created_at
)
SELECT
  lower(hex(randomblob(16))) AS id,
  CAST(r.referrer_user_id AS INTEGER) AS user_id,
  CAST(r.referred_user_id AS INTEGER) AS referred_user_id,
  r.id AS referral_id,
  'referral_qualified' AS event_type,
  NULL AS plan,
  NULL AS event_data_json,
  'qualification_backfill' AS event_source,
  1 AS is_backfill,
  CURRENT_TIMESTAMP AS created_at
FROM referrals r
WHERE r.is_qualified = 1
  AND r.attribution_status = 'qualified'
  AND NOT EXISTS (
    SELECT 1 FROM creator_impact_events e
    WHERE e.referral_id = r.id AND e.event_type = 'referral_qualified'
  );

-- ============================================================
-- STEP 4: Refresh creator_impact_stats for affected referrers
-- ============================================================
-- Recompute stats for all referrers who now have qualified referrals
-- This is the same logic as upsertImpactStats in SQL form
INSERT OR REPLACE INTO creator_impact_stats (
  id, user_id,
  total_referrals, qualified_referrals, paid_referrals,
  pro_referrals, founder_referrals, rewards_granted,
  first_referral_at, last_referral_at,
  first_paid_referral_at, last_paid_referral_at,
  updated_at
)
SELECT
  lower(hex(randomblob(16))) AS id,
  CAST(r.referrer_user_id AS INTEGER) AS user_id,
  COUNT(*) AS total_referrals,
  SUM(CASE WHEN r.is_qualified = 1 THEN 1 ELSE 0 END) AS qualified_referrals,
  SUM(CASE WHEN r.is_paid_conversion = 1 THEN 1 ELSE 0 END) AS paid_referrals,
  SUM(CASE WHEN r.is_pro_conversion = 1 THEN 1 ELSE 0 END) AS pro_referrals,
  SUM(CASE WHEN r.is_founder_conversion = 1 THEN 1 ELSE 0 END) AS founder_referrals,
  COALESCE((
    SELECT COUNT(*)
    FROM referral_rewards rr
    WHERE rr.user_id = r.referrer_user_id
  ), 0) AS rewards_granted,
  MIN(COALESCE(r.captured_at, r.created_at)) AS first_referral_at,
  MAX(COALESCE(r.captured_at, r.created_at)) AS last_referral_at,
  MIN(r.first_paid_at) AS first_paid_referral_at,
  MAX(r.latest_paid_at) AS last_paid_referral_at,
  CURRENT_TIMESTAMP AS updated_at
FROM referrals r
WHERE r.referrer_user_id IS NOT NULL
GROUP BY r.referrer_user_id;

-- ============================================================
-- STEP 5: Verify qualification (diagnostic query, no changes)
-- ============================================================
-- SELECT COUNT(*) as newly_qualified
-- FROM referrals
-- WHERE is_qualified = 1 AND attribution_status = 'qualified';
