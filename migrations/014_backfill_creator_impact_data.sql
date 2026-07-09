-- Migration 014: Backfill Creator Impact data from existing tables
-- Sources: referrals, users, founder_access, referral_rewards
-- All steps are idempotent (safe to re-run)
-- Backfilled events are flagged with is_backfill = 1

-- ============================================================
-- STEP 1: Backfill referrals.referral_code_used
-- Best-effort: use the referrer's current referral_code
-- ============================================================
UPDATE referrals
SET referral_code_used = (
  SELECT u.referral_code
  FROM users u
  WHERE CAST(u.id AS TEXT) = referrals.referrer_user_id
    AND u.referral_code IS NOT NULL
)
WHERE referral_code_used IS NULL;

-- ============================================================
-- STEP 2: Backfill referrals.captured_at from created_at
-- ============================================================
UPDATE referrals
SET captured_at = created_at
WHERE captured_at IS NULL AND created_at IS NOT NULL;

-- ============================================================
-- STEP 3: Backfill referrals.capture_source
-- All historical captures are tagged as 'signup_backfill'
-- (we cannot distinguish signup vs post_signup historically)
-- ============================================================
UPDATE referrals
SET capture_source = 'signup_backfill'
WHERE capture_source IS NULL;

-- ============================================================
-- STEP 4: Backfill referrals.first_qualified_at from qualified_at
-- ============================================================
UPDATE referrals
SET first_qualified_at = qualified_at
WHERE first_qualified_at IS NULL AND qualified_at IS NOT NULL;

-- ============================================================
-- STEP 5: Backfill Founder conversions using founder_access.granted_at
-- This is the most reliable historical source — exact grant date is known
-- ============================================================
UPDATE referrals
SET
  is_founder_conversion = 1,
  is_paid_conversion    = 1,
  first_founder_at      = (
    SELECT fa.granted_at
    FROM founder_access fa
    WHERE CAST(fa.user_id AS TEXT) = referrals.referred_user_id
    LIMIT 1
  ),
  first_paid_at         = COALESCE(
    first_paid_at,
    (SELECT fa.granted_at FROM founder_access fa
     WHERE CAST(fa.user_id AS TEXT) = referrals.referred_user_id LIMIT 1)
  ),
  first_paid_plan       = COALESCE(first_paid_plan, 'founder'),
  latest_paid_at        = COALESCE(
    latest_paid_at,
    (SELECT fa.granted_at FROM founder_access fa
     WHERE CAST(fa.user_id AS TEXT) = referrals.referred_user_id LIMIT 1)
  ),
  latest_paid_plan      = COALESCE(latest_paid_plan, 'founder'),
  paid_conversion_count = MAX(paid_conversion_count, 1),
  attribution_status    = 'paid'
WHERE EXISTS (
  SELECT 1 FROM founder_access fa
  WHERE CAST(fa.user_id AS TEXT) = referrals.referred_user_id
);

-- ============================================================
-- STEP 6: Backfill Pro conversions — best-effort
-- Source: users.plan + users.subscription_status (current state only)
-- The exact first_pro_at date is UNKNOWN; we record CURRENT_TIMESTAMP
-- and flag the row with metadata_json noting the limitation.
-- Only applied where NOT already marked as a Founder conversion.
-- ============================================================
UPDATE referrals
SET
  is_pro_conversion     = 1,
  is_paid_conversion    = 1,
  first_pro_at          = COALESCE(first_pro_at, CURRENT_TIMESTAMP),
  first_paid_at         = COALESCE(first_paid_at, CURRENT_TIMESTAMP),
  first_paid_plan       = COALESCE(first_paid_plan, (
    SELECT u.plan FROM users u
    WHERE CAST(u.id AS TEXT) = referrals.referred_user_id LIMIT 1
  )),
  latest_paid_at        = COALESCE(latest_paid_at, CURRENT_TIMESTAMP),
  latest_paid_plan      = COALESCE(latest_paid_plan, (
    SELECT u.plan FROM users u
    WHERE CAST(u.id AS TEXT) = referrals.referred_user_id LIMIT 1
  )),
  paid_conversion_count = MAX(paid_conversion_count, 1),
  attribution_status    = 'paid',
  metadata_json         = json_object(
    'backfill_note', 'pro_conversion_date_unknown_best_effort',
    'backfill_source', 'users.plan'
  )
WHERE is_founder_conversion = 0
  AND EXISTS (
    SELECT 1 FROM users u
    WHERE CAST(u.id AS TEXT) = referrals.referred_user_id
      AND u.plan IN ('pro', 'pro_plus')
      AND u.subscription_status = 'active'
  );

-- ============================================================
-- STEP 7: Set attribution_status = 'qualified' for qualified non-paid rows
-- ============================================================
UPDATE referrals
SET attribution_status = 'qualified'
WHERE is_qualified = 1
  AND is_paid_conversion = 0
  AND attribution_status = 'pending';

-- ============================================================
-- STEP 8: Populate creator_impact_stats for all referrers
-- Uses INSERT OR IGNORE to be idempotent
-- ============================================================
INSERT OR IGNORE INTO creator_impact_stats (
  id,
  user_id,
  total_referrals,
  qualified_referrals,
  paid_referrals,
  pro_referrals,
  founder_referrals,
  rewards_granted,
  first_referral_at,
  last_referral_at,
  first_paid_referral_at,
  last_paid_referral_at,
  updated_at
)
SELECT
  lower(hex(randomblob(16)))                                             AS id,
  CAST(r.referrer_user_id AS INTEGER)                                    AS user_id,
  COUNT(*)                                                               AS total_referrals,
  SUM(CASE WHEN r.is_qualified       = 1 THEN 1 ELSE 0 END)             AS qualified_referrals,
  SUM(CASE WHEN r.is_paid_conversion = 1 THEN 1 ELSE 0 END)             AS paid_referrals,
  SUM(CASE WHEN r.is_pro_conversion  = 1 THEN 1 ELSE 0 END)             AS pro_referrals,
  SUM(CASE WHEN r.is_founder_conversion = 1 THEN 1 ELSE 0 END)          AS founder_referrals,
  COALESCE((
    SELECT COUNT(*)
    FROM referral_rewards rr
    WHERE rr.user_id = r.referrer_user_id
  ), 0)                                                                  AS rewards_granted,
  MIN(COALESCE(r.captured_at, r.created_at))                            AS first_referral_at,
  MAX(COALESCE(r.captured_at, r.created_at))                            AS last_referral_at,
  MIN(r.first_paid_at)                                                   AS first_paid_referral_at,
  MAX(r.latest_paid_at)                                                  AS last_paid_referral_at,
  CURRENT_TIMESTAMP                                                      AS updated_at
FROM referrals r
WHERE r.referrer_user_id IS NOT NULL
GROUP BY r.referrer_user_id;

-- ============================================================
-- STEP 9: Backfill creator_impact_events — referral_captured
-- ============================================================
INSERT INTO creator_impact_events (
  id, user_id, referred_user_id, referral_id, event_type,
  plan, event_data_json, event_source, is_backfill, created_at
)
SELECT
  lower(hex(randomblob(16)))                                             AS id,
  CAST(r.referrer_user_id AS INTEGER)                                    AS user_id,
  CAST(r.referred_user_id AS INTEGER)                                    AS referred_user_id,
  r.id                                                                   AS referral_id,
  'referral_captured'                                                    AS event_type,
  NULL                                                                   AS plan,
  json_object(
    'capture_source',  COALESCE(r.capture_source, 'signup_backfill'),
    'referral_code',   r.referral_code_used
  )                                                                      AS event_data_json,
  'backfill'                                                             AS event_source,
  1                                                                      AS is_backfill,
  COALESCE(r.captured_at, r.created_at, CURRENT_TIMESTAMP)              AS created_at
FROM referrals r
WHERE NOT EXISTS (
  SELECT 1 FROM creator_impact_events e
  WHERE e.referral_id = r.id AND e.event_type = 'referral_captured'
);

-- ============================================================
-- STEP 10: Backfill creator_impact_events — referral_qualified
-- ============================================================
INSERT INTO creator_impact_events (
  id, user_id, referred_user_id, referral_id, event_type,
  plan, event_data_json, event_source, is_backfill, created_at
)
SELECT
  lower(hex(randomblob(16)))                                             AS id,
  CAST(r.referrer_user_id AS INTEGER)                                    AS user_id,
  CAST(r.referred_user_id AS INTEGER)                                    AS referred_user_id,
  r.id                                                                   AS referral_id,
  'referral_qualified'                                                   AS event_type,
  NULL                                                                   AS plan,
  NULL                                                                   AS event_data_json,
  'backfill'                                                             AS event_source,
  1                                                                      AS is_backfill,
  COALESCE(r.first_qualified_at, r.qualified_at, CURRENT_TIMESTAMP)     AS created_at
FROM referrals r
WHERE r.is_qualified = 1
  AND NOT EXISTS (
    SELECT 1 FROM creator_impact_events e
    WHERE e.referral_id = r.id AND e.event_type = 'referral_qualified'
  );

-- ============================================================
-- STEP 11: Backfill creator_impact_events — founder_converted
-- Exact date known from founder_access.granted_at
-- ============================================================
INSERT INTO creator_impact_events (
  id, user_id, referred_user_id, referral_id, event_type,
  plan, event_data_json, event_source, is_backfill, created_at
)
SELECT
  lower(hex(randomblob(16)))                                             AS id,
  CAST(r.referrer_user_id AS INTEGER)                                    AS user_id,
  CAST(r.referred_user_id AS INTEGER)                                    AS referred_user_id,
  r.id                                                                   AS referral_id,
  'founder_converted'                                                    AS event_type,
  'founder'                                                              AS plan,
  json_object(
    'source',     fa.source,
    'granted_at', fa.granted_at
  )                                                                      AS event_data_json,
  'backfill'                                                             AS event_source,
  1                                                                      AS is_backfill,
  COALESCE(r.first_founder_at, fa.granted_at, CURRENT_TIMESTAMP)        AS created_at
FROM referrals r
JOIN founder_access fa ON CAST(fa.user_id AS TEXT) = r.referred_user_id
WHERE r.is_founder_conversion = 1
  AND NOT EXISTS (
    SELECT 1 FROM creator_impact_events e
    WHERE e.referral_id = r.id AND e.event_type = 'founder_converted'
  );

-- ============================================================
-- STEP 12: Backfill creator_impact_events — pro_converted
-- Date is best-effort only (current timestamp, not actual conversion date)
-- ============================================================
INSERT INTO creator_impact_events (
  id, user_id, referred_user_id, referral_id, event_type,
  plan, event_data_json, event_source, is_backfill, created_at
)
SELECT
  lower(hex(randomblob(16)))                                             AS id,
  CAST(r.referrer_user_id AS INTEGER)                                    AS user_id,
  CAST(r.referred_user_id AS INTEGER)                                    AS referred_user_id,
  r.id                                                                   AS referral_id,
  'pro_converted'                                                        AS event_type,
  u.plan                                                                 AS plan,
  json_object('backfill_note', 'date_unknown_best_effort')              AS event_data_json,
  'backfill'                                                             AS event_source,
  1                                                                      AS is_backfill,
  CURRENT_TIMESTAMP                                                      AS created_at
FROM referrals r
JOIN users u ON CAST(u.id AS TEXT) = r.referred_user_id
WHERE r.is_pro_conversion = 1
  AND r.is_founder_conversion = 0
  AND NOT EXISTS (
    SELECT 1 FROM creator_impact_events e
    WHERE e.referral_id = r.id AND e.event_type = 'pro_converted'
  );

-- ============================================================
-- STEP 13: Backfill creator_impact_events — reward_granted
-- Source: referral_rewards table (has granted_at timestamp)
-- ============================================================
INSERT INTO creator_impact_events (
  id, user_id, referred_user_id, referral_id, event_type,
  plan, event_data_json, event_source, is_backfill, created_at
)
SELECT
  lower(hex(randomblob(16)))                                             AS id,
  CAST(rr.user_id AS INTEGER)                                            AS user_id,
  NULL                                                                   AS referred_user_id,
  NULL                                                                   AS referral_id,
  'reward_granted'                                                       AS event_type,
  rr.reward_plan                                                         AS plan,
  json_object(
    'milestone_count', rr.milestone_count,
    'reward_days',     rr.reward_days,
    'expires_at',      rr.expires_at
  )                                                                      AS event_data_json,
  'backfill'                                                             AS event_source,
  1                                                                      AS is_backfill,
  COALESCE(rr.granted_at, CURRENT_TIMESTAMP)                            AS created_at
FROM referral_rewards rr
WHERE NOT EXISTS (
  SELECT 1 FROM creator_impact_events e
  WHERE e.user_id = CAST(rr.user_id AS INTEGER)
    AND e.event_type = 'reward_granted'
    AND json_extract(e.event_data_json, '$.milestone_count') = rr.milestone_count
);
