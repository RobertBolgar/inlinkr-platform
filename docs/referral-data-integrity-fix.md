# Referral Data Integrity Fix

Generated: June 2026  
Status: **Data Integrity Repair Required**

---

## Problem Found

Production data integrity issues:

1. **Orphaned `users.referred_by` values** — `users.referred_by` is populated but no matching row exists in `referrals` table
   - Example: user id 7 (plrvideomagnets@gmail.com) has `referred_by = 1`, but `SELECT * FROM referrals WHERE referrer_user_id = 1` returns no rows

2. **Self-referrals** — `users.referred_by = users.id` (impossible, indicates data corruption)
   - user id 1 has `referred_by = 1`
   - user id 5 has `referred_by = 5`
   - user id 6 has `referred_by = 6`

---

## Root Cause Analysis

### Why `users.referred_by` can be populated without a matching `referrals` row

**Current code (`referral-helper.js:captureReferralOnSignup`):**
```javascript
// Step 1: Update users.referred_by
const userUpdateResult = await env.DB.prepare(`
  UPDATE users SET referred_by = ?, signup_ip_hash = ? WHERE id = ?
`).bind(cleanReferrerId, ipHash, newUserId).run();

if (!userUpdateResult.success || userUpdateResult.changes === 0) {
  return { success: false, reason: 'user_update_failed' };
}

// Step 2: Insert into referrals
const referralInsertResult = await env.DB.prepare(`
  INSERT INTO referrals (...)
`).bind(...).run();

if (!referralInsertResult.success || referralInsertResult.changes === 0) {
  return { success: false, reason: 'referral_insert_failed' };
}
```

**Issue:** The two writes are NOT atomic. If the `users` UPDATE succeeds but the `referrals` INSERT fails, the database is left in an inconsistent state:
- `users.referred_by` is set
- `referrals` row is missing

**Historical cause:** This could have happened due to:
- Database connection issues between the two writes
- Schema changes where `referrals` table didn't exist yet
- Partial transaction rollbacks
- Manual data manipulation

### Why self-referrals exist

**Current code has self-referral protection:**
```javascript
// Check 1: Before users UPDATE
if (referrer.id === newUserId) {
  return { success: false, reason: 'self_referral_prevented' };
}

// Check 2: Before referrals INSERT
if (cleanReferrerId === cleanReferredUserId) {
  return { success: false, reason: 'self_referral_prevented' };
}
```

**Conclusion:** Self-referrals in production are **historical data corruption**, not a code bug. They were likely caused by:
- Manual database edits
- Legacy code before self-referral protection was added
- Data migration scripts that didn't validate

### Atomicity of `captureReferralOnSignup`

**Current state:** NOT atomic — two separate writes with no transaction wrapper.

**Impact:** If the second write fails, the first write persists, causing orphaned `users.referred_by` values.

**Recommended future improvement:** Wrap both writes in a D1 transaction (if supported) or add rollback logic. For now, the repair migration fixes existing orphaned data.

---

## Code Verification

### Self-referral protection status

**✅ Already present in `referral-helper.js`**
- Line 124-127: Check before `users` UPDATE
- Line 158-161: Check before `referrals` INSERT

**No code change required.**

### Rewards and qualification canonical source

**All reward and qualification logic uses the `referrals` table:**

| Function | Query | Source |
|----------|-------|--------|
| `checkAndGrantReferralRewards` | `SELECT COUNT(*) FROM referrals WHERE referrer_user_id = ? AND is_qualified = 1` | `referrals` |
| `tryQualifyReferral` | `SELECT referrer_user_id, is_qualified FROM referrals WHERE referred_user_id = ?` | `referrals` |
| `checkAndGrantReferralRewards` (count) | `SELECT COUNT(*) FROM referrals WHERE referrer_user_id = ? AND is_qualified = 1` | `referrals` |

**`users.referred_by` is never used for reward or qualification logic.** It is only used for:
- Display purposes (showing who referred you)
- The initial capture flow (which then writes to `referrals`)

**✅ After repair, all systems will use the canonical `referrals` table.**

---

## Migration Plan

### Migration 015: Repair missing referrals rows

**What it does:**
- Scans `users` where `referred_by IS NOT NULL`
- Checks if a matching `referrals` row exists
- If not, creates a `referrals` row with:
  - `referral_code_used = NULL` (unknown for historical repairs)
  - `captured_at = users.created_at` (proxy timestamp)
  - `capture_source = 'repair_backfill'` (audit trail)
  - `attribution_status = 'pending'`
- Skips self-referrals (handled in migration 016)
- Uses `INSERT OR IGNORE` and `NOT EXISTS` guards (idempotent)

**Safety:**
- ✅ Idempotent — safe to re-run
- ✅ Preserves existing valid `referrals` rows
- ✅ Does not modify `users.referred_by`
- ✅ Clearly marks repaired rows with `capture_source = 'repair_backfill'`

### Migration 016: Cleanup self-referrals

**What it does:**
- Sets `users.referred_by = NULL` where `users.id = users.referred_by`
- Idempotent — safe to re-run

**Safety:**
- ✅ Idempotent
- ✅ Only clears impossible self-referrals
- ✅ Does not affect valid referral relationships

---

## Verification Queries

### Before Running Migrations

**Count orphaned referrals (users.referred_by without matching referrals row):**
```sql
SELECT COUNT(*) as orphaned_referrals
FROM users u
WHERE u.referred_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM referrals r
    WHERE CAST(r.referred_user_id AS TEXT) = CAST(u.id AS TEXT)
      AND CAST(r.referrer_user_id AS TEXT) = CAST(u.referred_by AS TEXT)
  );
```

**List orphaned referrals:**
```sql
SELECT u.id, u.email, u.referred_by
FROM users u
WHERE u.referred_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM referrals r
    WHERE CAST(r.referred_user_id AS TEXT) = CAST(u.id AS TEXT)
      AND CAST(r.referrer_user_id AS TEXT) = CAST(u.referred_by AS TEXT)
  );
```

**Count self-referrals:**
```sql
SELECT COUNT(*) as self_referrals
FROM users
WHERE referred_by IS NOT NULL
  AND id = referred_by;
```

**List self-referrals:**
```sql
SELECT id, email, referred_by
FROM users
WHERE referred_by IS NOT NULL
  AND id = referred_by;
```

### After Running Migration 015

**Count repaired referrals:**
```sql
SELECT COUNT(*) as repaired_count
FROM referrals
WHERE capture_source = 'repair_backfill';
```

**List repaired referrals:**
```sql
SELECT r.id, r.referrer_user_id, r.referred_user_id, r.captured_at, r.capture_source
FROM referrals r
WHERE r.capture_source = 'repair_backfill';
```

**Verify no orphaned referrals remain:**
```sql
SELECT COUNT(*) as remaining_orphans
FROM users u
WHERE u.referred_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM referrals r
    WHERE CAST(r.referred_user_id AS TEXT) = CAST(u.id AS TEXT)
      AND CAST(r.referrer_user_id AS TEXT) = CAST(u.referred_by AS TEXT)
  );
```

### After Running Migration 016

**Verify no self-referrals remain:**
```sql
SELECT COUNT(*) as remaining_self_referrals
FROM users
WHERE referred_by IS NOT NULL
  AND id = referred_by;
```

---

## Post-Repair Validation

### Verify rewards still work

**Count qualified referrals for a specific referrer:**
```sql
SELECT COUNT(*) as qualified_count
FROM referrals
WHERE referrer_user_id = '1' AND is_qualified = 1;
```

**Verify referral rewards are still accurate:**
```sql
SELECT rr.user_id, rr.milestone_count, rr.reward_plan, rr.granted_at
FROM referral_rewards rr
ORDER BY rr.user_id, rr.granted_at;
```

### Verify qualification still works

**Check qualification status for a specific referred user:**
```sql
SELECT r.is_qualified, r.qualified_at, r.attribution_status
FROM referrals r
WHERE r.referred_user_id = '7';
```

---

## Summary

| Issue | Root Cause | Fix | Status |
|-------|-----------|-----|--------|
| Orphaned `users.referred_by` | Non-atomic writes in `captureReferralOnSignup` | Migration 015: backfill missing `referrals` rows | ✅ Ready |
| Self-referrals | Historical data corruption | Migration 016: clear `referred_by = NULL` for self-referrals | ✅ Ready |
| Self-referral protection | Already present in code | No code change needed | ✅ Verified |
| Rewards/qualification source | Already uses `referrals` table | No code change needed | ✅ Verified |

**No UI changes required.**  
**No changes to reward or qualification logic required.**  
**Existing valid referral data is preserved.**

---

## Deployment Order

1. Run verification queries (before)
2. Apply migration 015
3. Run verification queries (after 015)
4. Apply migration 016
5. Run verification queries (after 016)
6. Validate rewards and qualification still work

**Rollback:** If needed, delete rows where `capture_source = 'repair_backfill'` and restore `users.referred_by` from backup.
