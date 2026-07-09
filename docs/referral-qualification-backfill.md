# Referral Qualification Backfill

Generated: June 2026  
Status: **Applied to Production**

---

## Problem

Repaired referral rows (from migration 015) were unqualified even though the referred users had already completed the qualifying activity (created links, generated clicks) before the referral row existed.

**Example:**
- User 7 was referred by user 1
- User 7 has 1 link and 2 clicks
- User 7 should be qualified, but the referral row was created after the activity occurred

---

## Qualification Rules (from `tryQualifyReferral`)

The production qualification logic requires:

1. **`referrals_enabled` feature flag** must be ON
2. **Referred user must have at least 1 link** in the `links` table
3. **Referred user must have >= 2 click events** in `click_events` (joined via links)
4. **IP check (if enabled):**
   - If `referrals_ip_check_enabled` is ON
   - At least one click must be from a different IP hash than the referrer's signup IP hash
   - If referrer has no signup IP hash, IP check is skipped safely

---

## User 7 Verification

**Before backfill:**
```sql
SELECT COUNT(*) as link_count FROM links WHERE user_id = '7';
-- Result: 1

SELECT COUNT(*) as click_count 
FROM click_events ce JOIN links l ON ce.link_id = l.id 
WHERE l.user_id = '7';
-- Result: 2

SELECT key, enabled FROM feature_flags 
WHERE key IN ('referrals_enabled', 'referrals_ip_check_enabled');
-- Result: both enabled = 1

SELECT signup_ip_hash FROM users WHERE id = '1';
-- Result: 99dae55126b3976d5f98e1edb96943fe140e4d6391192dd577d4bbf957f502cc

SELECT DISTINCT ip_hash 
FROM click_events ce JOIN links l ON ce.link_id = l.id 
WHERE l.user_id = '7' AND ip_hash IS NOT NULL;
-- Result: 134.82.68.164 (different from referrer's IP hash)
```

**Conclusion:** User 7 satisfies all qualification rules.

---

## Migration 017: Backfill Referral Qualification

**What it does:**
1. Applies the same qualification rules as `tryQualifyReferral` in SQL
2. Updates unqualified referrals that meet the criteria:
   - Sets `is_qualified = 1`
   - Sets `qualified_at = CURRENT_TIMESTAMP`
   - Sets `first_qualified_at = CURRENT_TIMESTAMP`
   - Sets `attribution_status = 'qualified'`
3. Emits `creator_impact_events` rows for newly qualified referrals
4. Refreshes `creator_impact_stats` for affected referrers

**Safety:**
- ✅ Idempotent — only processes unqualified referrals
- ✅ Uses NOT EXISTS guards to avoid duplicate events
- ✅ Respects feature flags (`referrals_enabled`, `referrals_ip_check_enabled`)
- ✅ Handles missing referrer IP hash safely (skips IP check)
- ✅ Safe to re-run

---

## Verification Queries

### Before Running Migration

**Count pending/unqualified referrals:**
```sql
SELECT COUNT(*) as pending_referrals
FROM referrals
WHERE is_qualified = 0;
```

**List pending referrals:**
```sql
SELECT r.id, r.referrer_user_id, r.referred_user_id, r.attribution_status
FROM referrals r
WHERE r.is_qualified = 0;
```

### After Running Migration

**Count newly qualified referrals:**
```sql
SELECT COUNT(*) as newly_qualified
FROM referrals
WHERE is_qualified = 1 AND attribution_status = 'qualified';
```

**Verify specific referral (user 7):**
```sql
SELECT id, referrer_user_id, referred_user_id, is_qualified, 
       qualified_at, first_qualified_at, attribution_status
FROM referrals
WHERE referred_user_id = '7';
```

**Verify creator_impact_events was emitted:**
```sql
SELECT * FROM creator_impact_events
WHERE referral_id = '1c7212ca927d452a9a739d67f7169e04';
```

**Verify creator_impact_stats was refreshed:**
```sql
SELECT * FROM creator_impact_stats
WHERE user_id = 1;
```

---

## Post-Migration Results

**Referral row for user 7:**
- `is_qualified = 1`
- `qualified_at = 2026-06-24 02:38:35`
- `first_qualified_at = 2026-06-24 02:38:35`
- `attribution_status = 'qualified'`

**Creator Impact event:**
- `event_type = 'referral_qualified'`
- `event_source = 'qualification_backfill'`
- `is_backfill = 1`

**Creator Impact stats for referrer (user 1):**
- `total_referrals = 1`
- `qualified_referrals = 1`
- `paid_referrals = 0`
- `pro_referrals = 0`
- `founder_referrals = 0`
- `rewards_granted = 0`

---

## Reward Granting

**Note:** Migration 017 does NOT grant referral rewards. It only qualifies referrals.

Reward granting is handled by the existing `checkAndGrantReferralRewards` function, which:
- Checks milestone thresholds (3, 10, 25 referrals)
- Grants rewards based on qualified referral counts
- Updates `users.referral_reward_*` fields
- Inserts into `referral_rewards` table

**To trigger reward granting for user 1:**
- Call the admin endpoint `/api/admin/referral-rewards/recalculate?userId=1`
- Or wait for the next user sync (which auto-repairs missing rewards)

---

## Summary

| Aspect | Status |
|--------|--------|
| User 7 qualification rules verified | ✅ Satisfies all rules |
| Migration 017 applied | ✅ 19 rows written |
| Referral row qualified | ✅ is_qualified = 1 |
| Creator Impact event emitted | ✅ referral_qualified |
| Creator Impact stats refreshed | ✅ qualified_referrals = 1 |
| Reward granting | ⏸️ Not granted (1 referral < 3 threshold) |

**No UI changes required.**  
**No changes to reward logic required.**  
**Migration is idempotent and safe to re-run.**
