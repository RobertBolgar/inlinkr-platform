# Pro and Founder Onboarding + Email Lifecycle Plan

**Audit Date:** 2026-05-28  
**Branch:** pro-dev  
**Status:** Audit complete, planning phase

---

## Current State Map

### Existing Email Infrastructure

**Email Helper:** `functions/api/email-helper.js`
- Resend API integration
- From: `hello@notify.tubelinkr.com`
- Simple sendTransactionalEmail function

**Existing Emails:**

1. **Welcome Email** - `functions/api/users/sync.js` (lines 279-310)
   - Trigger: New user creation via `/api/users/sync`
   - Guard: None (sent every time on new user creation)
   - Content: "You're in, [name] — here's your first move" with CTA to create first link
   - Personalization: Uses first_name from Clerk, fallback to email local part

2. **First Meaningful Click Email** - `worker.js` (lines 56-105)
   - Trigger: After 2+ total clicks across all user's links
   - Guard: `first_meaningful_click_email_sent_at` field (prevents duplicates)
   - Content: "Your TubeLinkr links are getting clicks" with dashboard CTA
   - Personalization: Uses first_name from users table

### Missing Emails (Critical Gaps)

- ❌ Pro onboarding/welcome email
- ❌ Founder welcome email
- ❌ Referral reward expiration warning
- ❌ Referral reward granted notification
- ❌ Pro subscription activated email
- ❌ Subscription canceled/downgrade email
- ❌ Founder access granted email

---

## Dashboard Onboarding Logic

### Current Implementation: `src/pages/DashboardPage.tsx` (lines 421-500)

**Checklist Steps (same for all plans):**
1. Create your first Smart Link
2. Add a placement
3. Connect YouTube for video insights
4. Get your first tracked click

**Behavior:**
- Shows for all users (Free, Pro, Founder) until all 4 steps complete
- No plan-based differentiation
- Contextual CTA button points to next incomplete step
- Hides completely when all steps complete

**Issues:**
- No Pro/Founder-specific onboarding
- No emphasis on Pro features (subdomain, creator hub)
- No Founder-specific messaging

---

## Referral Card Visibility Logic

### Current Implementation: `src/components/ReferralCard.tsx`

**Visibility Rules:**
```typescript
// Hides for:
- Paid Pro users (subscription_status === 'active')
- Founder users (getEffectivePlan(user) === 'founder')

// Shows for:
- Free users (when referral system enabled)
- Free users with active referral reward (when system disabled - informational only)
- Referral Pro users (countdown display only)
```

**System Enablement Check:**
- When `referralStatus.enabled === false`: Card completely hidden for users without active reward
- When `referralStatus.enabled === true`: Full card with milestones and CTAs

**Milestone System:**
- 3 qualified referrals → 7 days Pro
- 10 qualified referrals → 30 days Pro

---

## Plan/Effective Access Logic

### Current Implementation: `src/lib/plan.ts`

**`getEffectivePlan(user)` Priority Order:**
1. **Founder Access** (highest) - `has_founder_access === 1` or `true`
2. **Active Paid Subscription** - `subscription_status === 'active'` with plan ('pro' or 'pro_plus')
3. **Active Referral Reward** - `referral_reward_active === 1` + valid `referral_reward_expires_at`
4. **Default to Free**

**Key Helpers:**
- `hasProAccess(user)` - Returns true for pro, pro_plus, founder
- `hasFounderAccess(user)` - Returns true only for founder
- `hasActiveReferralReward(user)` - Checks referral reward validity

**Plan Fields in D1:**
- `plan` TEXT - 'free', 'pro', 'pro_plus'
- `subscription_status` TEXT - 'active', 'canceled', 'past_due', etc.
- `subscription_current_period_end` TEXT
- `stripe_customer_id` TEXT
- `stripe_subscription_id` TEXT

**Referral Reward Fields:**
- `referral_reward_active` INTEGER (0/1)
- `referral_reward_plan` TEXT ('pro' only)
- `referral_reward_expires_at` TEXT

**Founder Access Table:**
- Separate table: `founder_access`
- Fields: `user_id`, `is_comped`, `source`, `granted_at`, `granted_by`, `stripe_checkout_session_id`, `stripe_payment_intent_id`

---

## User Lifecycle by Plan

### Free User Lifecycle

**Current State:**
1. Sign up → Welcome email sent
2. Dashboard shows 4-step onboarding checklist
3. Referral card visible (if system enabled)
4. Get 2+ clicks → First meaningful click email sent
5. No further lifecycle emails

**Missing:**
- No upgrade nudges after onboarding complete
- No re-engagement emails if inactive
- No referral progress emails

### Pro User Lifecycle (Paid)

**Current State:**
1. Upgrade via Stripe → No email sent
2. Dashboard shows same 4-step checklist (no Pro-specific onboarding)
3. Referral card hidden
4. No Pro welcome/onboarding email
5. No subscription lifecycle emails

**Missing:**
- ❌ Pro welcome email (feature highlights, subdomain setup guide)
- ❌ Subscription activated confirmation
- ❌ Creator hub setup guidance
- ❌ Subscription expiration warnings
- ❌ Canceled/downgrade notifications

### Founder User Lifecycle

**Current State:**
1. Purchase Founder Access via Stripe → No email sent
2. Admin comped Founder Access → No email sent
3. Dashboard shows same 4-step checklist (no Founder-specific onboarding)
4. Referral card hidden
5. No Founder welcome email
6. No Founder-specific messaging anywhere

**Missing:**
- ❌ Founder welcome email (thank you, early supporter status)
- ❌ Founder badge/notification in dashboard
- ❌ Founder-specific onboarding (feature roadmap input, etc.)

---

## Dashboard Card Behavior by User State

### Free User (No Referral Reward)
- ✅ Onboarding checklist (4 steps)
- ✅ Referral card (if system enabled)
- ✅ Referral footer banner (if system enabled)
- ✅ Proof Momentum section (with YouTube connect CTA if not connected)

### Free User (Active Referral Reward)
- ✅ Onboarding checklist (4 steps)
- ✅ Referral card (countdown only, no milestones if system disabled)
- ✅ Referral footer banner (countdown + upgrade CTA)
- ✅ Proof Momentum section

### Pro User (Paid)
- ✅ Onboarding checklist (4 steps) - *same as Free*
- ❌ Referral card (hidden)
- ❌ Referral footer banner (hidden)
- ✅ Proof Momentum section
- ✅ Creator Hub settings in Settings page

### Founder User
- ✅ Onboarding checklist (4 steps) - *same as Free*
- ❌ Referral card (hidden)
- ❌ Referral footer banner (hidden)
- ✅ Proof Momentum section
- ✅ Creator Hub settings in Settings page
- ✅ "Lifetime Founder" badge in Settings page

---

## Email Events That Already Exist

| Event | Trigger | Guard Field | Location |
|-------|---------|-------------|----------|
| Welcome | New user creation | None | `functions/api/users/sync.js` |
| First Meaningful Click | 2+ total clicks | `first_meaningful_click_email_sent_at` | `worker.js` |

---

## Email Events That Should Be Added

### Priority 1: Pro Onboarding (Immediate)

1. **Pro Welcome Email**
   - Trigger: `subscription_status` changes to 'active' with plan 'pro' or 'pro_plus'
   - Guard: `pro_welcome_email_sent_at`
   - Content: Feature highlights, subdomain setup guide, creator hub introduction
   - Target: New paid Pro users

### Priority 2: Founder Onboarding (Immediate)

2. **Founder Welcome Email**
   - Trigger: Row inserted into `founder_access` table
   - Guard: `founder_welcome_email_sent_at`
   - Content: Thank you, early supporter status, founder badge, roadmap input invitation
   - Target: New Founder users (paid or comped)

### Priority 3: Referral Lifecycle (High)

3. **Referral Reward Granted Email**
   - Trigger: `referral_reward_active` changes from 0 to 1
   - Guard: `referral_reward_granted_email_sent_at`
   - Content: "You unlocked Pro!" with expiry date and upgrade CTA
   - Target: Users who earn referral rewards

4. **Referral Reward Expiring Soon Email**
   - Trigger: `referral_reward_expires_at` < 3 days from now
   - Guard: `referral_reward_expiring_email_sent_at` (per expiry period)
   - Content: "Your Pro access expires in X days" with upgrade CTA
   - Target: Users with expiring referral rewards

### Priority 4: Subscription Lifecycle (Medium)

5. **Subscription Activated Email**
   - Trigger: `subscription_status` changes to 'active'
   - Guard: `subscription_activated_email_sent_at`
   - Content: Payment confirmation, plan details, billing portal link
   - Target: New paid subscribers

6. **Subscription Canceled Email**
   - Trigger: `subscription_status` changes to 'canceled'
   - Guard: `subscription_canceled_email_sent_at`
   - Content: Cancellation confirmation, access end date, re-subscribe CTA
   - Target: Users who cancel subscriptions

7. **Subscription Past Due Email**
   - Trigger: `subscription_status` changes to 'past_due'
   - Guard: `subscription_past_due_email_sent_at`
   - Content: Payment failed, update payment method CTA
   - Target: Users with failed payments

---

## Fields Needed to Prevent Duplicate Emails

### Existing Fields
- ✅ `first_meaningful_click_email_sent_at` TEXT

### Fields to Add
```sql
-- Pro onboarding
ALTER TABLE users ADD COLUMN pro_welcome_email_sent_at TEXT;

-- Founder onboarding
ALTER TABLE users ADD COLUMN founder_welcome_email_sent_at TEXT;

-- Referral lifecycle
ALTER TABLE users ADD COLUMN referral_reward_granted_email_sent_at TEXT;
ALTER TABLE users ADD COLUMN referral_reward_expiring_email_sent_at TEXT;

-- Subscription lifecycle
ALTER TABLE users ADD COLUMN subscription_activated_email_sent_at TEXT;
ALTER TABLE users ADD COLUMN subscription_canceled_email_sent_at TEXT;
ALTER TABLE users ADD COLUMN subscription_past_due_email_sent_at TEXT;
```

### Indexes for Performance
```sql
CREATE INDEX IF NOT EXISTS idx_users_referral_reward_expires ON users(referral_reward_expires_at);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
```

---

## Safest Implementation Phases

### Phase 1: Database Migration (Zero Risk)
- Add all email guard fields to users table
- Create necessary indexes
- **No code changes, no email sending**
- **Safe to run on production**

### Phase 2: Pro Welcome Email (Low Risk)
- Add email sending logic to Stripe webhook (`customer.subscription.created` or `checkout.session.completed`)
- Add guard field update after successful send
- Test with test Stripe checkout
- **Only affects new Pro subscribers**

### Phase 3: Founder Welcome Email (Low Risk)
- Add email sending logic to Stripe webhook for founder checkout
- Add email sending logic to admin founder-access endpoint
- Add guard field update after successful send
- **Only affects new Founder users**

### Phase 4: Referral Granted Email (Medium Risk)
- Add email sending logic to referral reward grant logic
- Add guard field update after successful send
- Test with referral qualification flow
- **Only affects users who earn referral rewards**

### Phase 5: Referral Expiring Email (Medium Risk)
- Add scheduled job or webhook trigger to check expiring rewards
- Add guard field update after successful send
- Test with expiring reward dates
- **Affects users with expiring rewards**

### Phase 6: Subscription Lifecycle Emails (Low Risk)
- Add email sending to Stripe webhook for subscription events
- Add guard field updates after successful send
- Test with subscription lifecycle
- **Only affects paid subscribers**

---

## Do-Not-Touch Areas (Per Branch Safety Rules)

**DO NOT MODIFY:**
- ❌ Stripe billing logic (`functions/api/stripe/webhook.js` - only add email sending, don't change billing state)
- ❌ Referral rewards logic (`functions/api/referral-helper.js`)
- ❌ Effective plan logic (`src/lib/plan.ts`)
- ❌ Clerk auth logic (`functions/api/auth-helper.js`)
- ❌ Worker routing (`worker.js` - only add email sending, don't change routing)
- ❌ D1 bindings/schema (except adding email guard fields)
- ❌ Cloudflare config (`wrangler.toml`)
- ❌ Email sending logic in `functions/api/email-helper.js` (it's fine as-is)

**SAFE TO MODIFY:**
- ✅ Add email sending calls to existing webhook handlers
- ✅ Add email guard fields to users table via migration
- ✅ Create new API endpoints for email testing
- ✅ Add email templates/content

---

## Recommended First Implementation

### Start with: Pro Welcome Email

**Why:**
- Highest impact for paid users
- Lowest risk (only affects new Pro subscribers)
- Clear trigger point (Stripe webhook)
- Easy to test with test checkout

**Implementation Steps:**

1. **Create migration** (`migrations/add-pro-welcome-email-guard.sql`):
```sql
ALTER TABLE users ADD COLUMN pro_welcome_email_sent_at TEXT;
```

2. **Add email template** (new file `functions/api/email-templates/pro-welcome.js`):
```javascript
export function getProWelcomeEmail(firstName) {
  return {
    subject: `Welcome to Pro, ${firstName} — let's set up your creator hub`,
    html: `...template content...`
  };
}
```

3. **Add email sending to Stripe webhook** (`functions/api/stripe/webhook.js`):
- In `checkout.session.completed` handler
- After setting subscription_status to 'active'
- Check if `pro_welcome_email_sent_at` is null
- Send email, then update guard field

4. **Test flow:**
- Create test Stripe checkout for Pro
- Complete checkout
- Verify email sent
- Verify guard field updated
- Retry checkout to verify no duplicate email

**Success Criteria:**
- New Pro subscribers receive welcome email within 1 minute of checkout
- No duplicate emails sent
- Email contains correct personalization
- Guard field prevents re-sends

---

## Audit Summary

### Files Audited

**Frontend:**
- `src/pages/DashboardPage.tsx` - Onboarding checklist
- `src/components/ReferralCard.tsx` - Referral card visibility
- `src/lib/plan.ts` - Plan/effective access logic
- `src/pages/SettingsPage.tsx` - Settings/profile experience
- `src/pages/UpgradePage.tsx` - Upgrade page

**Backend:**
- `functions/api/email-helper.js` - Email helper
- `functions/api/users/sync.js` - Welcome email trigger
- `functions/api/stripe/webhook.js` - Stripe webhook (no email handling)
- `functions/api/admin/founder-access.js` - Founder access admin (no email handling)
- `worker.js` - First meaningful click email trigger

**Database:**
- `cloudflare-schema.sql` - Base schema
- `cloudflare-first-meaningful-click-email-migration.sql` - Email guard field
- `cloudflare-founder-access-migration.sql` - Founder access table
- `cloudflare-pro-plan-migration.sql` - Pro plan fields
- `cloudflare-users-referral-fields-safe-migration.sql` - Referral fields
- `phase-2a-referral-reward-fields-migration.sql` - Referral reward fields

### Existing Emails Found
1. Welcome email (triggered on new user creation)
2. First meaningful click email (triggered after 2+ clicks)

### Current Dashboard Onboarding Logic Summary
- 4-step checklist (same for all plans)
- No plan-based differentiation
- Hides when complete
- Contextual CTA based on next step

### Recommended Pro Onboarding Flow
1. User upgrades to Pro via Stripe
2. Stripe webhook triggers Pro welcome email
3. Email includes: feature highlights, subdomain setup guide, creator hub introduction
4. Dashboard shows Pro-specific onboarding (future enhancement)
5. No referral card or banner (hidden for paid users)

### Recommended Founder Onboarding Flow
1. User purchases Founder Access OR admin comps Founder Access
2. Stripe webhook or admin endpoint triggers Founder welcome email
3. Email includes: thank you, early supporter status, founder badge, roadmap input invitation
4. Dashboard shows Founder badge (future enhancement)
5. No referral card or banner (hidden for Founder users)

### Recommended First Email to Implement
**Pro Welcome Email**
- Trigger: Stripe `checkout.session.completed` for Pro plan
- Guard: `pro_welcome_email_sent_at` field
- Impact: High (paid user onboarding)
- Risk: Low (only affects new Pro subscribers)
- Implementation complexity: Low

### Document Status
✅ Created: `docs/pro-founder-onboarding-email-plan.md`
