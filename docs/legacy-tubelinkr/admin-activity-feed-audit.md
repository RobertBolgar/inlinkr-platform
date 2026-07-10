> Legacy TubeLinkr reference only.
> This document exists to preserve historical implementation details.
> New platform work should follow the InLinkr documentation.

# Admin Activity Feed Audit

**Date:** 2026-05-29  
**Branch:** pro-dev  
**Status:** Audit Only - No Implementation

---

## Executive Summary

TubeLinkr currently has **no dedicated activity/events table** for admin visibility. Platform events are scattered across multiple tables (users, founder_access, referrals, referral_rewards, proof_shares, stripe_webhook_events) and many admin actions are only visible in console logs.

This audit recommends creating a single `activity_events` table to centralize platform event logging, designed to be compatible with future multi-admin roles without requiring a schema rebuild.

---

## Files Audited

### Admin Dashboard & API Routes
- `src/pages/AdminDevPage.tsx` - Admin Command Center UI
- `functions/api/admin/founder-access.js` - Founder grant/revoke/status
- `functions/api/admin/overview-stats.js` - Platform statistics
- `functions/api/admin/set-pro.js` - Dev testing plan override
- `functions/api/admin/referral-rewards/recalculate.js` - Reward recalculation
- `functions/api/admin/feature-flags.js` - Feature flag toggles

### User Lifecycle Events
- `functions/api/users/sync.js` - User signup/sync
- `functions/api/stripe/webhook.js` - Pro upgrade, Founder purchase, subscription events
- `functions/api/referrals/qualify.js` - Referral qualification (disabled)
- `functions/api/referral-helper.js` - Referral capture, qualification, rewards
- `functions/api/proof-shares/create.js` - Proof share creation

### Database Tables
- `cloudflare-schema.sql` - users, links, click_events
- `stripe-webhook-idempotency-migration.sql` - stripe_webhook_events
- `cloudflare-founder-access-migration.sql` - founder_access
- `cloudflare-clean-referrals-migration.sql` - referrals
- `migrations/001_create_referral_rewards.sql` - referral_rewards
- `migrations/002_create_proof_shares.sql` - proof_shares
- `migrations/005_create_proof_share_events.sql` - proof_share_events

### Logging Patterns
- Console logs in all admin routes with "ADMIN" prefix
- Console logs in webhook handlers with event details
- Email guard fields: `pro_welcome_email_sent_at`, `founder_welcome_email_sent_at`, `first_meaningful_click_email_sent_at`

---

## Current State Summary

### 1. Is there already an activity/event table?

**NO.** There is no dedicated activity_events or admin_activity table.

**Closest existing tables:**
- `stripe_webhook_events` - Only for Stripe webhook idempotency (event id, type, processed_at)
- `proof_share_events` - Only for proof engagement analytics (proof_share_id, event_type, created_at)

### 2. What platform events are already persisted somewhere?

| Event | Persistence Location | Fields |
|-------|---------------------|--------|
| User signup | `users` table | `created_at` |
| Pro upgrade | `users` table | `plan`, `subscription_status`, `stripe_subscription_id` |
| Founder purchase | `founder_access` table | `user_id`, `source='stripe_payment'`, `granted_at`, `stripe_checkout_session_id` |
| Admin-granted Founder | `founder_access` table | `user_id`, `source='admin_comp'`, `granted_at`, `granted_by='admin_dev'` |
| Referral capture | `referrals` table | `referrer_user_id`, `referred_user_id`, `created_at` |
| Referral qualification | `referrals` table | `is_qualified`, `qualified_at` |
| Referral reward | `referral_rewards` table | `user_id`, `milestone_count`, `reward_plan`, `granted_at`, `expires_at` |
| Proof creation | `proof_shares` table | `user_id`, `public_token`, `created_at` |
| Stripe webhook processed | `stripe_webhook_events` table | `id`, `type`, `processed_at` |

### 3. What platform events are only visible in logs?

| Event | Log Location | Log Pattern |
|-------|--------------|-------------|
| Admin founder grant | `functions/api/admin/founder-access.js` | `console.log(\`ADMIN FOUNDER-ACCESS: Granted founder access...\`)` |
| Admin founder revoke | `functions/api/admin/founder-access.js` | `console.log(\`ADMIN FOUNDER-ACCESS: Revoked founder access...\`)` |
| Admin feature flag toggle | `functions/api/admin/feature-flags.js` | `console.log(\`ADMIN FEATURE-FLAGS: Authorized access by...\`)` |
| Admin set-pro (dev) | `functions/api/admin/set-pro.js` | `console.log(\`ADMIN SET-PRO: Setting user plan...\`)` |
| Admin overview stats access | `functions/api/admin/overview-stats.js` | `console.log(\`ADMIN OVERVIEW-STATS: Authorized access by...\`)` |
| Stripe webhook processing | `functions/api/stripe/webhook.js` | `console.log(\`Processing new Stripe webhook event...\`)` |
| Pro welcome email sent | `functions/api/stripe/webhook.js` | `console.log(\`Pro welcome email sent to user...\`)` |
| Founder welcome email sent | `functions/api/stripe/webhook.js` | `console.log(\`Founder welcome email sent to user...\`)` |
| Referral qualification attempt | `functions/api/referral-helper.js` | `console.log(\`[REFERRAL QUALIFY DEBUG]...\`)` |
| Referral reward granted | `functions/api/referral-helper.js` | `console.log(\`[REFERRAL REWARDS DEBUG]...\`)` |

### 4. Email Guard Fields (Existing Pattern)

TubeLinkr already uses email guard fields to prevent duplicate sends:
- `users.pro_welcome_email_sent_at` - Pro welcome email
- `users.founder_welcome_email_sent_at` - Founder welcome email
- `users.first_meaningful_click_email_sent_at` - First meaningful click email

**Pattern:** Check field before sending, update field after successful send.

---

## Recommended activity_events Schema

```sql
CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_user_id INTEGER,
  target_user_id INTEGER,
  event_title TEXT,
  event_description TEXT,
  metadata_json TEXT,
  severity TEXT DEFAULT 'info',
  visibility_scope TEXT DEFAULT 'owner',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for common queries
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_events_event_type ON activity_events(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_events_actor_user_id ON activity_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_target_user_id ON activity_events(target_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_created_at ON activity_events(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_events_visibility_scope ON activity_events(visibility_scope);
```

### Field Rationale

| Field | Purpose | Future-Proofing |
|-------|---------|-----------------|
| `id` | UUID primary key | Standard pattern |
| `event_type` | Categorize events (user_signed_up, founder_granted, etc.) | Filter by type for different admin roles |
| `actor_user_id` | Who performed the action (admin user) | Track which admin performed action |
| `target_user_id` | Who the action was performed on | Filter events by user |
| `event_title` | Human-readable title | Display in UI |
| `event_description` | Detailed description | Context for debugging |
| `metadata_json` | Flexible JSON for event-specific data | Extensible without schema changes |
| `severity` | info, warning, error | Filter by severity for support role |
| `visibility_scope` | owner, support, billing, system | Future role-based filtering |
| `created_at` | Timestamp | Sort and filter by time |

---

## Recommended Event Types (Phase 1)

### User Lifecycle Events
- `user_signed_up` - New user registration
- `first_meaningful_click` - User's first qualifying click (if implemented)
- `pro_upgraded` - User upgraded to Pro via Stripe
- `pro_downgraded` - User downgraded from Pro
- `founder_purchased` - User purchased Founder via Stripe
- `founder_granted_by_admin` - Admin granted Founder access (comped)
- `founder_revoked_by_admin` - Admin revoked Founder access

### Referral Events
- `referral_captured` - New referral relationship created
- `referral_qualified` - Referral qualified (2-click + IP check)
- `referral_reward_unlocked` - Referral milestone reward granted

### Admin Actions
- `admin_feature_flag_toggled` - Feature flag changed
- `admin_set_pro_used` - Dev testing plan override (dev only)
- `admin_referral_recalculated` - Manual reward recalculation

### System Events
- `stripe_webhook_processed` - Stripe webhook handled
- `stripe_webhook_duplicate_ignored` - Duplicate webhook ignored
- `email_sent` - Transactional email sent (pro_welcome, founder_welcome, etc.)

---

## Recommended Insertion Points

### 1. User Signup
**File:** `functions/api/users/sync.js`  
**Location:** After user INSERT (line 249)  
**Event:** `user_signed_up`

```javascript
await logActivityEvent(env, {
  event_type: 'user_signed_up',
  target_user_id: newUser.id,
  event_title: 'New user registered',
  event_description: `User ${newUser.email} signed up via Clerk`,
  metadata_json: JSON.stringify({
    email: newUser.email,
    username: newUser.username,
    referral_code: referralCode || null
  }),
  visibility_scope: 'owner'
});
```

### 2. Pro Upgrade
**File:** `functions/api/stripe/webhook.js`  
**Location:** After plan update in `checkout.session.completed` (line 248)  
**Event:** `pro_upgraded`

```javascript
await logActivityEvent(env, {
  event_type: 'pro_upgraded',
  target_user_id: user.id,
  event_title: 'User upgraded to Pro',
  event_description: `User ${user.id} upgraded to ${plan} via Stripe`,
  metadata_json: JSON.stringify({
    plan,
    subscription_id: subscriptionId,
    customer_id: customerId
  }),
  visibility_scope: 'billing'
});
```

### 3. Founder Purchase
**File:** `functions/api/stripe/webhook.js`  
**Location:** After founder_access INSERT (line 160)  
**Event:** `founder_purchased`

```javascript
await logActivityEvent(env, {
  event_type: 'founder_purchased',
  target_user_id: user.id,
  event_title: 'Founder purchased',
  event_description: `User ${user.id} purchased Founder access via Stripe`,
  metadata_json: JSON.stringify({
    checkout_session_id: session.id,
    payment_intent_id: paymentIntentId
  }),
  visibility_scope: 'billing'
});
```

### 4. Admin-Granted Founder
**File:** `functions/api/admin/founder-access.js`  
**Location:** After founder_access INSERT (line 151)  
**Event:** `founder_granted_by_admin`

```javascript
await logActivityEvent(env, {
  event_type: 'founder_granted_by_admin',
  actor_user_id: user.id, // Admin who granted
  target_user_id: user.id, // User who received
  event_title: 'Founder access granted by admin',
  event_description: `Admin granted Founder access to ${user.email}`,
  metadata_json: JSON.stringify({
    admin_email: user.email,
    target_email: user.email,
    source: 'admin_comp'
  }),
  visibility_scope: 'owner'
});
```

### 5. Referral Qualified
**File:** `functions/api/referral-helper.js`  
**Location:** After referral UPDATE (line 349)  
**Event:** `referral_qualified`

```javascript
await logActivityEvent(env, {
  event_type: 'referral_qualified',
  target_user_id: referrerUserId,
  event_title: 'Referral qualified',
  event_description: `Referral for user ${referredUserId} qualified`,
  metadata_json: JSON.stringify({
    referrer_user_id: referrerUserId,
    referred_user_id: referredUserId,
    link_count,
    click_count
  }),
  visibility_scope: 'owner'
});
```

### 6. Referral Reward Granted
**File:** `functions/api/referral-helper.js`  
**Location:** After reward INSERT (line 612)  
**Event:** `referral_reward_unlocked`

```javascript
await logActivityEvent(env, {
  event_type: 'referral_reward_unlocked',
  target_user_id: userId,
  event_title: 'Referral reward unlocked',
  event_description: `User unlocked ${milestone.days} days of ${milestone.plan} for ${milestone.count} referrals`,
  metadata_json: JSON.stringify({
    milestone_count: milestone.count,
    reward_plan: milestone.plan,
    reward_days: milestone.days,
    expires_at: expiresAtISO
  }),
  visibility_scope: 'billing'
});
```

### 7. Proof Created
**File:** `functions/api/proof-shares/create.js`  
**Location:** After proof_shares INSERT (line 230)  
**Event:** `proof_created`

```javascript
await logActivityEvent(env, {
  event_type: 'proof_created',
  target_user_id: authUser.id,
  event_title: 'Proof share created',
  event_description: `User created proof share for video ${finalYoutubeVideoId}`,
  metadata_json: JSON.stringify({
    public_token: publicToken,
    youtube_video_id: finalYoutubeVideoId,
    link_id: link_id
  }),
  visibility_scope: 'owner'
});
```

---

## Owner/Admin Role Future-Proofing Notes

### Current Admin Model
- Single admin via `ADMIN_EMAIL_ALLOWLIST` environment variable
- All admin actions require `ADMIN_TEST_KEY` header
- No role differentiation (all admins have full access)

### Future Role Considerations
The `activity_events` schema supports future role filtering via `visibility_scope`:

| visibility_scope | Current Use | Future Use |
|-----------------|-------------|------------|
| `owner` | All events | Owner-only events (sensitive admin actions) |
| `support` | Not used | Support-visible events (user issues, non-sensitive) |
| `billing` | Not used | Billing-sensitive events (Stripe, refunds) |
| `system` | Not used | System events (webhooks, errors) |

### Implementation Pattern (Future)
```javascript
// Future: Filter events by role
const allowedScopes = {
  owner: ['owner', 'support', 'billing', 'system'],
  support: ['support', 'system'],
  billing: ['billing', 'system']
};

const userScope = getUserRole(userId); // 'owner', 'support', 'billing'
const query = `
  SELECT * FROM activity_events
  WHERE visibility_scope IN (${allowedScopes[userScope].join(',')})
  ORDER BY created_at DESC
  LIMIT 100
`;
```

### Important Design Principle
**Activity feed should track platform events. Admin permissions should be separate later. Do not mix event logging with access control.**

The `activity_events` table stores events neutrally. Access control is applied at query time, not at write time. This prevents schema rebuilds when adding new roles.

---

## Phase 1 Implementation Plan

### Step 1: Create activity_events table
- Migration file: `migrations/006_create_activity_events.sql`
- Run migration on pro-dev D1 database

### Step 2: Create helper function
- File: `functions/api/activity-helper.js`
- Function: `logActivityEvent(env, eventData)`
- Centralized insertion logic with error handling

### Step 3: Insert at high-value events (Priority Order)
1. `user_signed_up` - Track growth
2. `pro_upgraded` - Track revenue
3. `founder_purchased` - Track founder sales
4. `founder_granted_by_admin` - Track admin actions
5. `referral_qualified` - Track referral program
6. `referral_reward_unlocked` - Track reward grants
7. `proof_created` - Track feature usage

### Step 4: Create admin activity feed API
- File: `functions/api/admin/activity-feed.js`
- GET endpoint with pagination
- Filter by event_type, visibility_scope
- Require admin authentication (existing pattern)

### Step 5: Add activity feed to Admin Command Center
- File: `src/pages/AdminDevPage.tsx`
- New section: "Activity Feed"
- Display recent events with filtering
- Show event_title, event_description, created_at

---

## Explicit Do-Not-Build-Yet List

### Do NOT Implement in Phase 1:
- Multi-admin role system (owner, admin, support)
- Role-based access control middleware
- User-facing activity feed
- Real-time activity streaming (WebSocket)
- Activity event editing/deletion UI
- Activity event export/download
- Advanced filtering (date ranges, user search)
- Activity event analytics/aggregation
- Email notifications for activity events
- Activity event retention policies
- Activity event archiving

### Do NOT Mix With:
- Stripe webhook idempotency (keep separate)
- Proof share engagement analytics (keep separate)
- Click events tracking (keep separate)

---

## Risk Assessment

### Low Risk
- Adding `activity_events` table is non-destructive
- Existing tables are not modified
- Logging is additive (no breaking changes)
- Console logs remain as fallback

### Medium Risk
- If insertion fails, could break user signup/upgrade flows
- **Mitigation:** Wrap in try-catch, log errors, don't fail main flow

### High Risk
- None identified for Phase 1

### Schema Migration Risk
- **Low:** New table only, no ALTER TABLE on existing tables
- **Low:** No foreign key constraints that could break existing code
- **Low:** Can be rolled back by dropping table

---

## Questions Answered

### 1. Is there already an activity/event table?
**NO.** No dedicated activity_events table exists.

### 2. What platform events are already persisted somewhere?
User signup (users.created_at), Pro upgrade (users.plan), Founder purchase (founder_access), referral qualification (referrals.qualified_at), referral rewards (referral_rewards), proof creation (proof_shares.created_at).

### 3. What platform events are only visible in logs?
Admin actions (founder grant/revoke, feature flag toggles, set-pro), Stripe webhook processing details, referral qualification attempts, email sends.

### 4. What events should be added first?
user_signed_up, pro_upgraded, founder_purchased, founder_granted_by_admin, referral_qualified, referral_reward_unlocked, proof_created.

### 5. What is the smallest useful activity feed?
7 core events + simple GET API + basic UI display in Admin Command Center.

### 6. What schema would support future multi-admin roles without requiring a rebuild?
activity_events table with visibility_scope field for role-based filtering at query time.

### 7. Should the activity feed table include all recommended fields?
YES. All 9 fields (id, event_type, actor_user_id, target_user_id, event_title, event_description, metadata_json, severity, visibility_scope, created_at) are recommended for future-proofing.

### 8. Should admin actions be logged separately from user lifecycle events?
NO. Single activity_events table with event_type field is simpler and more flexible. Separation is achieved via filtering.

### 9. Should this be shown only to owner for now?
YES. Set visibility_scope='owner' for all Phase 1 events. Add role-based filtering later when multi-admin system is built.

### 10. What should not be implemented yet?
Multi-admin roles, role-based access control, user-facing feed, real-time streaming, advanced filtering, analytics, notifications, retention policies.

---

## Conclusion

TubeLinkr has no centralized activity logging system. Platform events are scattered across multiple tables and admin actions are only visible in console logs.

**Recommendation:** Implement Phase 1 activity_events table with 7 core events, following the schema and insertion points outlined in this audit. This provides immediate visibility without overbuilding and is designed to support future multi-admin roles without schema changes.

**Next Steps:** If approved, proceed with Phase 1 implementation plan (5 steps).
