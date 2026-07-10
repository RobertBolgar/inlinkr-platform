> Legacy TubeLinkr reference only.
> This document exists to preserve historical implementation details.
> New platform work should follow the InLinkr documentation.

# Creator Impact Attribution Foundation — Verification Report

Generated: June 2026  
Status: **Complete — Backend/Data Foundation Only**

---

## What Was Implemented

### 1. Database Migrations

| File | Purpose |
|------|---------|
| `migrations/011_evolve_referrals_attribution.sql` | Adds 16 attribution fields to the `referrals` table |
| `migrations/012_create_creator_impact_events.sql` | Creates the append-only `creator_impact_events` ledger |
| `migrations/013_create_creator_impact_stats.sql` | Creates the `creator_impact_stats` rollup table |
| `migrations/014_backfill_creator_impact_data.sql` | Backfills all three tables from existing data (13 steps, idempotent) |

### 2. New Backend Files

| File | Purpose |
|------|---------|
| `functions/api/creator-impact-helper.js` | `logImpactEvent`, `upsertImpactStats`, `stampReferralConversion` |
| `functions/api/creator-impact/status.js` | `GET /api/creator-impact/status` endpoint |

### 3. Modified Files

| File | What Changed |
|------|-------------|
| `functions/api/referral-helper.js` | Import helper; stamp new fields on INSERT; stamp `first_qualified_at` + `attribution_status` on qualify; emit events from capture, qualify, reward |
| `functions/api/stripe/webhook.js` | Import `stampReferralConversion`; call it after Pro upgrade and Founder purchase |

---

## Schema Changes

### `referrals` table — New Fields

| Column | Type | Notes |
|--------|------|-------|
| `referral_code_used` | TEXT NULL | Code used at capture; backfilled from referrer's current code |
| `captured_at` | TEXT NULL | Semantic alias for `created_at`; set at insert time going forward |
| `capture_source` | TEXT NULL | `'signup'` (live) or `'signup_backfill'` (historical) |
| `first_qualified_at` | TEXT NULL | ISO timestamp of first qualification; mirrors `qualified_at` |
| `first_paid_at` | TEXT NULL | ISO timestamp of first paid conversion |
| `first_paid_plan` | TEXT NULL | Plan type at first conversion (`'pro'`, `'founder'`, etc.) |
| `first_pro_at` | TEXT NULL | ISO timestamp of first Pro conversion |
| `first_founder_at` | TEXT NULL | ISO timestamp of first Founder conversion |
| `latest_paid_at` | TEXT NULL | Most recent paid conversion timestamp |
| `latest_paid_plan` | TEXT NULL | Plan type of most recent conversion |
| `paid_conversion_count` | INTEGER DEFAULT 0 | Total number of paid conversions |
| `is_paid_conversion` | INTEGER DEFAULT 0 | Boolean: has ever converted to paid |
| `is_pro_conversion` | INTEGER DEFAULT 0 | Boolean: has ever been Pro |
| `is_founder_conversion` | INTEGER DEFAULT 0 | Boolean: has ever been Founder |
| `attribution_status` | TEXT DEFAULT 'pending' | `pending` → `qualified` → `paid` |
| `metadata_json` | TEXT NULL | Extensible JSON payload |

### New Tables

**`creator_impact_events`** — Append-only impact ledger  
Fields: `id, user_id, referred_user_id, referral_id, event_type, plan, event_data_json, event_source, is_backfill, created_at`

**`creator_impact_stats`** — Per-referrer rollup  
Fields: `id, user_id, total_referrals, qualified_referrals, paid_referrals, pro_referrals, founder_referrals, rewards_granted, first_referral_at, last_referral_at, first_paid_referral_at, last_paid_referral_at, ambassador_status, badges_json, updated_at`

---

## Backfill Coverage

### What Was Backfilled

| Data | Source | Quality |
|------|--------|---------|
| `referral_code_used` | `users.referral_code` of referrer | Best-effort — code may have changed |
| `captured_at` | `referrals.created_at` | Exact |
| `capture_source` | N/A | Tagged `signup_backfill` uniformly |
| `first_qualified_at` | `referrals.qualified_at` | Exact |
| `attribution_status` | Derived from existing flags | Computed |
| Founder conversions | `founder_access.granted_at` | **Exact date known** |
| Pro conversions | `users.plan` + `subscription_status` | **Best-effort — date unknown** |
| `creator_impact_stats` | Recomputed from `referrals` | Accurate at time of migration |
| `creator_impact_events` | All 5 event types from existing tables | Flagged `is_backfill = 1` |

### Pro Conversion Date Limitation

Historical Pro conversion dates cannot be known from current data. The backfill uses `CURRENT_TIMESTAMP` as the `first_pro_at` value and sets `metadata_json.backfill_note = 'pro_conversion_date_unknown_best_effort'` on affected rows. This is clearly distinguished from live records.

**Affected rows:** Any row in `referrals` where `referred_user_id` maps to a user with `plan IN ('pro', 'pro_plus') AND subscription_status = 'active'`.

**Not affected:** Founder conversions (exact date from `founder_access.granted_at`).

---

## How Pro Conversions Are Now Stamped (Live — Going Forward)

1. User clicks upgrade, completes Stripe checkout
2. Stripe fires `checkout.session.completed`
3. Webhook verifies subscription is `active`, updates `users.plan = 'pro'`
4. `stampReferralConversion(env, userId, plan, { conversionDate, metadata })` is called
5. `stampReferralConversion` looks up `referrals WHERE referred_user_id = userId`
6. If found: stamps `first_paid_at`, `first_pro_at`, `latest_paid_at`, `is_pro_conversion = 1`, `attribution_status = 'paid'`, `paid_conversion_count++`
7. Inserts `creator_impact_events` row with `event_type = 'pro_converted'`, `event_source = 'live'`, `is_backfill = 0`
8. Calls `upsertImpactStats` to refresh the referrer's rollup row

**Conversion is only recorded if the converted user was originally referred.** Non-referred users are silently skipped (`reason: 'not_referred'`).

---

## How Founder Conversions Are Now Stamped (Live — Going Forward)

1. User completes Stripe one-time Founder payment
2. Stripe fires `checkout.session.completed`
3. Webhook detects `isFounderCheckout = true`, inserts `founder_access` row
4. `stampReferralConversion(env, userId, 'founder', { conversionDate: grantedAt, metadata })` is called
5. Same stamp flow as Pro, but sets `is_founder_conversion = 1` and `first_founder_at`
6. Inserts `creator_impact_events` row with `event_type = 'founder_converted'`
7. Refreshes `creator_impact_stats` for the referrer

`conversionDate` is set to `grantedAt` (the exact moment the Founder access was granted), ensuring precise timestamp.

---

## How Referral Qualification Emits Events

1. `tryQualifyReferral(env, referredUserId)` is called (triggered on link creation or click events)
2. Qualification checks pass (links ≥ 1, clicks ≥ 2, optional IP check)
3. `referrals` UPDATE now also sets:
   - `first_qualified_at = CASE WHEN first_qualified_at IS NULL THEN ? ELSE first_qualified_at END`
   - `attribution_status = 'qualified'`
4. Reward check runs (`checkAndGrantReferralRewards`)
5. `logImpactEvent` fires with `event_type = 'referral_qualified'`, linking `referral_id`
6. `upsertImpactStats` refreshes the referrer's rollup

---

## How Referral Captures Emit Events

1. `captureReferralOnSignup(env, userId, code, request)` is called on user signup
2. `referrals` INSERT now includes: `referral_code_used`, `captured_at`, `capture_source = 'signup'`, `attribution_status = 'pending'`
3. `logImpactEvent` fires with `event_type = 'referral_captured'`
4. `upsertImpactStats` creates or refreshes the referrer's row

---

## How Existing Referral Rewards Are Preserved

- **No changes to `referral_rewards` table** — existing rows untouched
- **No changes to `users.referral_reward_*` fields** — expiration, active state, plan untouched
- **No changes to `checkAndGrantReferralRewards` logic** — existing milestone rules unchanged
- **New behaviour added only:** After the existing `referral_rewards` INSERT, `logImpactEvent` fires and `upsertImpactStats` updates `rewards_granted` counter
- The rewards page, settings page, and `ReferralCard` component are entirely unaffected

---

## New API Endpoint

### `GET /api/creator-impact/status`

**Auth:** Clerk JWT (same as all other authenticated endpoints)

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "total_referrals": 12,
      "qualified_referrals": 8,
      "paid_referrals": 3,
      "pro_referrals": 2,
      "founder_referrals": 1,
      "rewards_granted": 2,
      "first_referral_at": "2024-01-15T10:30:00.000Z",
      "last_referral_at": "2024-06-01T14:22:00.000Z",
      "first_paid_referral_at": "2024-03-10T09:00:00.000Z",
      "last_paid_referral_at": "2024-05-20T11:45:00.000Z",
      "ambassador_status": null,
      "badges_json": null,
      "updated_at": "2024-06-23T18:00:00.000Z"
    },
    "referralCode": "ABC123",
    "referralUrl": "https://go.tubelinkr.com/username/invite",
    "recentReferrals": [
      {
        "id": "uuid",
        "referred_user_id": "42",
        "is_qualified": 1,
        "is_paid_conversion": 1,
        "is_pro_conversion": 1,
        "is_founder_conversion": 0,
        "attribution_status": "paid",
        "captured_at": "2024-04-01T12:00:00.000Z",
        "first_qualified_at": "2024-04-03T08:30:00.000Z",
        "first_paid_at": "2024-04-10T16:00:00.000Z",
        "first_paid_plan": "pro",
        "latest_paid_at": "2024-04-10T16:00:00.000Z",
        "latest_paid_plan": "pro",
        "paid_conversion_count": 1
      }
    ]
  }
}
```

**Returns zeros (not null) for all stat counts when no referral data exists.** Safe to render directly.

---

## Error Handling & Safety

All Creator Impact calls are **non-blocking** and wrapped in `try/catch`:
- Failures log to `console.error` / `console.warn` but never throw
- No existing referral flow is disrupted if Creator Impact tables don't exist yet
- Stripe webhook failures in the impact stamp do not affect the primary plan upgrade

---

## Known Limitations

1. **Pro conversion date unknown for historical records** — backfill uses `CURRENT_TIMESTAMP`. Only future conversions have accurate dates.
2. **`referral_code_used` may be stale for historical records** — if a user generated a new code after a referral was created, the backfilled value reflects their current code, not the original.
3. **`customer.subscription.updated` not stamped** — Stripe renewal events are not stamped (intentional: we want first conversion, not recurring billing events). Re-subscription via a new subscription ID is not yet tracked.
4. **`creator_impact_stats` is not computed in real-time** — it's updated on each event but could drift if DB writes fail. It is fully recomputable by re-running the `upsertImpactStats` function for a user.
5. **Legacy `referral_codes` and `user_referrals` tables** — still present, not removed. These remain dormant.

---

## Running the Migrations

Apply in order against the Cloudflare D1 database:

```bash
wrangler d1 execute tubelinkr-db --file migrations/011_evolve_referrals_attribution.sql
wrangler d1 execute tubelinkr-db --file migrations/012_create_creator_impact_events.sql
wrangler d1 execute tubelinkr-db --file migrations/013_create_creator_impact_stats.sql
wrangler d1 execute tubelinkr-db --file migrations/014_backfill_creator_impact_data.sql
```

Migration 014 is safe to re-run — all INSERT steps use `INSERT OR IGNORE` or `NOT EXISTS` guards.

---

## What This Enables (Future)

With this foundation in place, the following features can be built without further schema changes:

- **Creator Impact Settings section** — read from `creator_impact_stats` + `GET /api/creator-impact/status`
- **Referral leaderboards** — `ORDER BY paid_referrals DESC` on `creator_impact_stats`
- **Ambassador tier badges** — update `ambassador_status` field on `creator_impact_stats`
- **Founder referral rewards** — query `founder_referrals > 0` on referrers
- **Lifetime impact stats** — all fields are lifetime, never reset
- **Impact event audit log** — full history in `creator_impact_events`, filterable by `event_type`, `is_backfill`, `created_at`
