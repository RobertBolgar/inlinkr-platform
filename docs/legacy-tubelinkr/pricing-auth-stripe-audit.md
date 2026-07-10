> Legacy TubeLinkr reference only.
> This document exists to preserve historical implementation details.
> New platform work should follow the InLinkr documentation.

# TubeLinkr Pricing, Authentication, and Purchase Flow Audit

**Date:** June 25, 2026  
**Branch:** pro-dev  
**Purpose:** Architecture audit for public pricing page implementation

---

## 1. Current Purchase Flows

### Logged-out Visitor Clicks Pro

**Current Flow:**
1. Click "Start Pro" button on `/pricing` → redirects to `/signup`
2. Clerk signup page (`SignupPage.tsx`) with `fallbackRedirectUrl="/"`
3. User completes signup → redirected to `/`
4. AuthContext syncs user to backend via `/api/users/sync`
5. User is redirected to `/dashboard` (authenticated users are redirected from `/`)
6. User must navigate to `/upgrade` to complete Pro purchase
7. On `/upgrade`, click "Upgrade to Pro" → calls `/api/stripe/create-checkout-session`
8. Stripe checkout session created → redirects to Stripe hosted checkout
9. Complete payment → Stripe redirects to `/success`
10. Webhook processes `checkout.session.completed` → updates user plan to `pro`
11. `/success` polls for subscription activation → shows success state
12. User navigates to `/dashboard`

**Files Involved:**
- `src/pages/PricingPage.tsx` (button → `/signup`)
- `src/pages/SignupPage.tsx` (Clerk signup)
- `src/contexts/AuthContext.tsx` (user sync)
- `functions/api/users/sync.js` (backend sync)
- `src/pages/UpgradePage.tsx` (checkout trigger)
- `functions/api/stripe/create-checkout-session.js` (Stripe session)
- `functions/api/stripe/webhook.js` (payment processing)
- `src/pages/SuccessPage.tsx` (success confirmation)

---

### Logged-out Visitor Clicks Founder

**Current Flow:**
1. Click "Claim Founder Access" button on `/pricing` → redirects to `/signup`
2. Clerk signup → same as Pro flow
3. Redirected to `/dashboard`
4. Navigate to `/upgrade`
5. Click "Claim founder access" → calls `/api/stripe/create-checkout-session` with `plan='founder'`
6. Founder cap enforced (50 paid founders max)
7. Stripe checkout created in `mode='payment'` (one-time, not subscription)
8. Complete payment → Stripe redirects to `/success`
9. Webhook processes `checkout.session.completed` → inserts row into `founder_access` table
10. Founder welcome email sent
11. `/success` polls for founder access → shows success state

**Key Difference:** Founder uses one-time payment mode, not subscription. Entitlement stored in separate `founder_access` table, not `users.plan`.

---

### Logged-in Free User Upgrades to Pro

**Current Flow:**
1. User on `/upgrade` (or `/pricing` → `/upgrade`)
2. Click "Upgrade to Pro" → calls `/api/stripe/create-checkout-session`
3. If user has existing active subscription → updates subscription directly via Stripe API
4. If no existing subscription → creates new checkout session
5. Stripe checkout → complete payment
6. Webhook updates `users.plan='pro'`, `subscription_status='active'`, stores Stripe IDs
7. Redirect to `/success` → poll for activation
8. Pro welcome email sent (first time only)

**Subscription Update Path:**
- If `user.subscription_status='active'` and has `stripe_subscription_id`:
  - Calls Stripe API to update subscription item price
  - Returns `mode='subscription_update'` with success URL
  - Webhook handles plan change via `customer.subscription.updated`

---

### Logged-in Free User Purchases Founder Access

**Current Flow:**
1. User on `/upgrade`
2. Click "Claim founder access" → calls `/api/stripe/create-checkout-session` with `plan='founder'`
3. Founder cap enforced (count `founder_access` where `is_comped=0`)
4. Stripe checkout in `mode='payment'` (one-time)
5. Complete payment
6. Webhook inserts into `founder_access` table with `is_comped=0`, `source='stripe_payment'`
7. Founder welcome email sent
8. Redirect to `/success` → poll for founder access

**Important:** Founder access is a separate entitlement layer. It does NOT modify `users.plan` or `subscription_status`. The user remains on their existing plan but gains Pro features via `has_founder_access` flag.

---

### Logged-in Pro User

**Current Flow:**
1. User on `/upgrade` sees "Change plan or cancel" button
2. Click → opens Stripe Customer Portal via `/api/stripe/create-billing-portal-session`
3. Stripe portal allows:
   - Switch between monthly/yearly
   - Update payment method
   - Cancel subscription
4. User actions in portal trigger webhooks:
   - `customer.subscription.updated` → plan changes
   - `customer.subscription.deleted` → downgrades to free
5. Portal returns to `/upgrade`

**Guardrails:**
- Only users with `subscription_status='active'` and `stripe_customer_id` can access portal
- Referral-only Pro users (no Stripe subscription) are blocked from portal

---

### Logged-in Founder User

**Current Flow:**
1. User on `/upgrade` sees "Founder Access granted" (disabled button)
2. No checkout options available
3. Founder access is permanent (one-time payment)
4. User retains Pro features via `has_founder_access` flag
5. If user wants to add a paid subscription later, they can upgrade to Pro (but Founder already covers Pro features)

**Note:** Founder users can still access Stripe portal if they have a separate paid subscription (rare edge case).

---

## 2. Clerk Authentication

### How Clerk Signup Works

**File:** `src/pages/SignupPage.tsx`

```tsx
<SignUp 
  routing="path" 
  path="/signup"
  signInUrl="/login"
  fallbackRedirectUrl="/"
  appearance={{...}}
/>
```

**Process:**
1. User enters email/password or uses OAuth (Google, etc.)
2. Clerk creates user account in Clerk system
3. Clerk generates JWT token
4. Clerk redirects to `fallbackRedirectUrl="/"`
5. `AuthContext.tsx` detects authenticated user
6. Calls `/api/users/sync` to create/update user in D1 database
7. User data synced: email, clerk_user_id, first_name, auto-generated username
8. Auth redirect logic sends user to `/dashboard` (authenticated users redirected from `/`)

**Key Points:**
- Clerk is the source of truth for authentication
- D1 database is the source of truth for user data and entitlements
- Sync happens automatically on every auth state change
- Referral codes are captured during sync if present in URL or localStorage

---

### How Clerk Login Works

**File:** `src/pages/LoginPage.tsx`

```tsx
<SignIn 
  routing="path" 
  path="/login"
  signUpUrl="/signup"
  fallbackRedirectUrl="/"
  appearance={{...}}
/>
```

**Process:**
1. User enters credentials
2. Clerk verifies and generates JWT
3. Redirects to `fallbackRedirectUrl="/"`
4. AuthContext syncs user via `/api/users/sync`
5. Redirected to `/dashboard`

**Same as signup** after authentication completes.

---

### Current Redirect Behavior

**Clerk Component Props:**
- `fallbackRedirectUrl="/"` on both signup and login
- `main.tsx` has global fallbacks: `signInFallbackRedirectUrl="/dashboard"`, `signUpFallbackRedirectUrl="/dashboard"`

**AuthContext Redirects:**
- Authenticated users on `/` → redirect to `/dashboard`
- Authenticated users without username → redirect to `/setup-username` (Pro users only)
- All other pages use `ProtectedRoute` wrapper for authenticated routes

**Problem:** No mechanism to preserve intended destination (e.g., user clicked Pro on `/pricing`, should return to checkout after signup).

---

### Clerk Support for Preserving Intended Destination

**Clerk Capabilities:**
- Clerk supports `redirectUrl` prop to override default redirect
- Clerk supports `afterSignInUrl` and `afterSignUpUrl` for different flows
- Can pass custom redirect URLs via query parameters

**Current Implementation:**
- Not using these features
- Always redirects to `/` then to `/dashboard`
- No preservation of pricing plan selection through auth flow

**Feasibility:** High. Clerk can preserve redirect URLs through auth flow.

---

### Preserving Selected Pricing Plan Through Auth Flow

**Current State:** Not supported.

**Options:**
1. **URL Query Parameter:** Pass `?plan=pro&billing=yearly` through signup, read after auth
2. **LocalStorage:** Store plan selection before signup, read after auth
3. **Session Storage:** Similar to localStorage but cleared on tab close
4. **Clerk Metadata:** Store plan selection in Clerk user metadata (requires Clerk API calls)

**Recommended:** URL query parameter + localStorage fallback. This is standard pattern and works with Clerk's redirect capabilities.

---

## 3. Stripe Integration

### Where Checkout Sessions Are Created

**File:** `functions/api/stripe/create-checkout-session.js`

**Endpoint:** `POST /api/stripe/create-checkout-session`

**Authentication:** Required (Bearer token with Clerk JWT)

**Request Body:**
```json
{
  "plan": "pro" | "founder",
  "billingInterval": "monthly" | "yearly" (optional, defaults to monthly)
}
```

---

### Files Responsible for Stripe Integration

**Checkout Session Creation:**
- `functions/api/stripe/create-checkout-session.js` - Creates Stripe checkout sessions

**Webhook Processing:**
- `functions/api/stripe/webhook.js` - Handles all Stripe webhook events

**Billing Portal:**
- `functions/api/stripe/create-billing-portal-session.js` - Opens Stripe customer portal

**Frontend Checkout Trigger:**
- `src/pages/UpgradePage.tsx` - Calls checkout session API
- `src/pages/PricingPage.tsx` - Links to signup (no direct checkout yet)

---

### How Plan Selection Is Determined

**From Request Body:**
- `plan` field: `"pro"` or `"founder"`
- `billingInterval` field: `"monthly"` or `"yearly"` (pro only)

**Price ID Mapping (Environment Variables):**
- `PRO_PRICE_ID_MONTHLY` - Pro monthly subscription
- `PRO_PRICE_ID_YEARLY` - Pro yearly subscription
- `FOUNDER_PRICE_ID` - Founder one-time payment

**Code Logic:**
```javascript
if (plan === 'founder') {
  priceId = env.FOUNDER_PRICE_ID;
  mode = 'payment'; // one-time
} else {
  if (billingInterval === 'monthly') {
    priceId = env.PRO_PRICE_ID_MONTHLY;
  } else {
    priceId = env.PRO_PRICE_ID_YEARLY;
  }
  mode = 'subscription'; // recurring
}
```

---

### How Monthly, Yearly, and Founder Plans Are Differentiated

**Monthly Pro:**
- Price ID: `PRO_PRICE_ID_MONTHLY`
- Mode: `subscription`
- Webhook: Maps to `plan='pro'` via `getPlanFromPriceId()`

**Yearly Pro:**
- Price ID: `PRO_PRICE_ID_YEARLY`
- Mode: `subscription`
- Webhook: Maps to `plan='pro'` via `getPlanFromPriceId()`

**Founder:**
- Price ID: `FOUNDER_PRICE_ID`
- Mode: `payment` (one-time, not subscription)
- Webhook: Detected via `metadata.plan='founder'` or absence of subscription_id
- Entitlement: Stored in `founder_access` table, not `users.plan`

**Critical:** `getPlanFromPriceId()` in webhook.js fails loudly on unknown price IDs to prevent silent downgrades.

---

### How Checkout Success Is Handled

**Stripe Redirect:**
- `success_url` parameter set to `${origin}/success`
- Origin sanitized to allowed domains (tubelinkr.com, pro-dev.tubelinkr.com, etc.)

**Success Page:**
- `src/pages/SuccessPage.tsx`
- Polls user status every 2.5 seconds for up to 15 seconds
- Checks for `subscription_status='active'` OR `has_founder_access=true`
- Shows verifying → success → timeout states
- Tracks analytics event `checkoutReturned`

**Webhook Processing:**
- `checkout.session.completed` event
- Updates database immediately (before user returns to success page)
- For Pro: Sets `plan='pro'`, `subscription_status='active'`, stores Stripe IDs
- For Founder: Inserts into `founder_access` table
- Sends welcome email (Pro or Founder, first time only)

---

### How Checkout Cancellation Is Handled

**Stripe Redirect:**
- `cancel_url` parameter set to `${origin}/upgrade`

**Current Behavior:**
- User returns to `/upgrade`
- No specific cancellation handling
- No cancellation analytics tracked
- No "abandoned checkout" recovery flow

**Gap:** No dedicated cancel page or abandoned checkout follow-up.

---

## 4. Webhooks

### Which Stripe Webhooks We Use

**File:** `functions/api/stripe/webhook.js`

**Handled Event Types:**
1. `checkout.session.completed` - Payment successful
2. `customer.subscription.created` - New subscription created
3. `customer.subscription.deleted` - Subscription canceled
4. `customer.subscription.updated` - Subscription modified (plan change, status change)
5. `invoice.payment_failed` - Payment failed

**Unknown Events:**
- Logged but ignored with 200 response
- No processing for unsupported event types

---

### How Successful Payment Updates User Account

**checkout.session.completed:**

**For Pro (subscription):**
1. Extract `userId` from metadata or find user by Stripe IDs
2. Fetch subscription details from Stripe API to get price_id
3. Map price_id to plan via `getPlanFromPriceId()`
4. Update `users` table:
   - `plan = 'pro'`
   - `subscription_status = 'active'`
   - `stripe_customer_id = customerId`
   - `stripe_subscription_id = subscriptionId`
5. Log `pro_upgraded` activity event
6. Stamp referral conversion (if applicable)
7. Send Pro welcome email (first time only)

**For Founder (one-time):**
1. Detect founder checkout via `metadata.plan='founder'` or absence of subscription
2. Insert into `founder_access` table:
   - `user_id`
   - `is_comped = 0`
   - `source = 'stripe_payment'`
   - `granted_at`
   - `stripe_checkout_session_id`
   - `stripe_payment_intent_id`
3. Log `founder_purchased` activity event
4. Stamp referral conversion
5. Send Founder welcome email (first time only)

**customer.subscription.created:**
- Similar to checkout.session.completed for subscriptions
- Sets plan and status based on subscription status

---

### Which Tables Are Modified

**Pro Subscription:**
- `users` table:
  - `plan` → 'pro'
  - `subscription_status` → 'active'
  - `stripe_customer_id` → customer ID
  - `stripe_subscription_id` → subscription ID
  - `subscription_current_period_end` → (if available)

**Founder Access:**
- `founder_access` table:
  - `user_id`
  - `is_comped` → 0
  - `source` → 'stripe_payment'
  - `granted_at`
  - `stripe_checkout_session_id`
  - `stripe_payment_intent_id`
- `users` table:
  - `founder_welcome_email_sent_at` → timestamp (after email sent)

**Idempotency:**
- `stripe_webhook_events` table:
  - `id` (event ID)
  - `type`
  - `processed_at`
- Prevents duplicate processing of same webhook event

---

### How Founder Access Differs From Pro Subscriptions

**Pro Subscription:**
- Stored in `users.plan` and `users.subscription_status`
- Requires active Stripe subscription
- Can be canceled → downgrades to free
- Monthly/yearly billing
- Managed via Stripe Customer Portal

**Founder Access:**
- Stored in separate `founder_access` table
- One-time payment, no subscription
- Permanent (no expiration)
- Independent of `users.plan` and `subscription_status`
- Cannot be canceled (one-time purchase)
- Comped founder access (`is_comped=1`) possible (admin grants)
- Entitlement granted via `has_founder_access` flag (EXISTS check on founder_access table)

**Priority in `getEffectivePlan()`:**
1. Founder access (highest priority)
2. Active paid subscription
3. Referral reward
4. Free (default)

---

## 5. Database

### Tables Involved in Purchases

#### users

**Purpose:** Core user table storing authentication, profile, and subscription data.

**Important Columns:**
- `id` - Primary key (integer)
- `email` - User email (unique)
- `username` - Public username (unique)
- `clerk_user_id` - Clerk authentication ID (unique, indexed)
- `plan` - Current plan: 'free', 'pro', 'pro_plus' (default: 'free')
- `subscription_status` - Stripe subscription status: 'active', 'canceled', 'past_due', 'incomplete', null
- `subscription_current_period_end` - Subscription end date (ISO format)
- `stripe_customer_id` - Stripe customer ID (indexed)
- `stripe_subscription_id` - Stripe subscription ID (indexed)
- `referral_reward_active` - Boolean flag for active referral reward
- `referral_reward_plan` - Plan granted by referral: 'pro', 'pro_plus'
- `referral_reward_expires_at` - Referral reward expiration date
- `has_founder_access` - Computed field (EXISTS check on founder_access table)
- `pro_welcome_email_sent_at` - Timestamp when Pro welcome email sent
- `founder_welcome_email_sent_at` - Timestamp when Founder welcome email sent
- `referred_by` - ID of referring user (for referral program)

**Relationships:**
- `clerk_user_id` → Clerk authentication system
- `stripe_customer_id` → Stripe customer
- `stripe_subscription_id` → Stripe subscription
- `referred_by` → `users.id` (self-referential for referrals)

---

#### founder_access

**Purpose:** Separate entitlement layer for Founder Access (lifetime Pro).

**Important Columns:**
- `id` - Primary key (integer)
- `user_id` - User ID (unique, foreign key to users)
- `is_comped` - Boolean: 0 = paid founder, 1 = comped/admin grant
- `source` - Source of grant: 'stripe_payment', 'admin', etc.
- `granted_at` - Grant timestamp (ISO format)
- `granted_by` - Admin user ID who granted (for comped access)
- `stripe_checkout_session_id` - Stripe session ID (for paid founders)
- `stripe_payment_intent_id` - Stripe payment intent ID (for paid founders)

**Relationships:**
- `user_id` → `users.id` (CASCADE delete)

**Indexes:**
- `idx_founder_access_user_id` - Fast user lookups
- `idx_founder_access_is_comped` - Filter paid vs comped founders

**Key Design:** Separate table allows Founder access to coexist with any `users.plan` value. A user can have Founder access AND a paid subscription (though redundant).

---

#### stripe_webhook_events

**Purpose:** Idempotency table to prevent duplicate webhook processing.

**Important Columns:**
- `id` - Stripe event ID (primary key, text)
- `type` - Event type (e.g., 'checkout.session.completed')
- `processed_at` - Processing timestamp

**Relationships:**
- None (standalone table)

**Indexes:**
- `idx_stripe_webhook_events_id` - Fast event ID lookups
- `idx_stripe_webhook_events_type` - Event type queries (analytics/debugging)

**Key Design:** Prevents duplicate processing of same Stripe webhook event. Webhook checks for existing event ID before processing.

---

#### referral_rewards

**Purpose:** Tracks referral milestone rewards granted to users.

**Important Columns:**
- `id` - Reward ID (text, primary key)
- `user_id` - User who received reward
- `milestone_count` - Referral count milestone (e.g., 5, 10)
- `reward_plan` - Plan granted: 'pro', 'pro_plus'
- `reward_days` - Duration of reward in days
- `granted_at` - Grant timestamp
- `expires_at` - Expiration timestamp

**Relationships:**
- `user_id` → `users.id`

**Indexes:**
- `idx_referral_rewards_user_milestone` - Unique per user per milestone
- `idx_referral_rewards_user_id` - User reward lookups
- `idx_referral_rewards_expires_at` - Expiration tracking

**Note:** This table tracks reward grants. Actual entitlement is stored in `users.referral_reward_*` fields.

---

### Summary of Purchase-Related Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | Core user data + subscription state | plan, subscription_status, stripe_customer_id, stripe_subscription_id, referral_reward_*, has_founder_access |
| `founder_access` | Founder entitlement layer | user_id, is_comped, source, granted_at, stripe_* |
| `stripe_webhook_events` | Webhook idempotency | id, type, processed_at |
| `referral_rewards` | Referral reward grants | user_id, milestone_count, reward_plan, expires_at |

---

## 6. Current Routing

### Route Structure

**File:** `src/App.tsx`

**Public Routes (No Auth Required):**
- `/` - Homepage (redirects authenticated users to `/dashboard`)
- `/b` - Homepage B variant (split test)
- `/pricing` - Public pricing page (NEW)
- `/privacy` - Privacy policy
- `/terms` - Terms of service
- `/support` - Support page
- `/proof/:token` - Public proof page
- `/hub/:subdomain` - Public link hub (fallback/debug)

**Authentication Routes:**
- `/login` - Clerk login (redirects authenticated users to `/`)
- `/signup` - Clerk signup (redirects authenticated users to `/`)
- `/login/sso-callback` - SSO callback
- `/signup/sso-callback` - SSO callback

**Protected Routes (Auth Required):**
- `/setup-username` - Username setup (Pro users only)
- `/dashboard` - Main dashboard
- `/links` - Links management
- `/links/new` - Create new link
- `/links/:id/edit` - Edit link
- `/analytics` - Analytics dashboard
- `/video/:videoId` - Video performance
- `/proofs` - Proof pages management
- `/settings` - Account settings
- `/settings/hub` - Creator hub settings
- `/upgrade` - In-app upgrade page
- `/links/:linkId/placements` - Link placements
- `/admin/dev` - Admin dev page
- `/rewards` - Referral rewards

**Success/Error Routes:**
- `/success` - Purchase success page

**Redirect Routes:**
- `/:username/:slug` - Link redirect (catch-all)

---

### How Users Move Between Pages

**New Visitor Flow:**
```
/ or /b → /pricing → /signup → /dashboard → /upgrade → Stripe → /success → /dashboard
```

**Logged-in Free User Flow:**
```
/dashboard → /upgrade → Stripe → /success → /dashboard
```

**Logged-in Pro User Flow:**
```
/dashboard → /upgrade → Stripe Portal → /upgrade
```

**Logged-in Founder User Flow:**
```
/dashboard → /upgrade (no action needed, already has access)
```

**Branded Subdomain Flow:**
```
username.tubelinkr.com → PublicLinkHubPage (no auth required)
```

---

### Key Routing Observations

1. **No dedicated cancel page:** Stripe cancel redirects to `/upgrade`
2. **No checkout flow for logged-out users:** Must signup first, then navigate to upgrade
3. **No plan preservation through auth:** Signup loses pricing selection
4. **Success page is protected:** Requires auth (uses Layout component)
5. **Pricing page is public:** No auth required (correct for public pricing)

---

## 7. Button Logic

### Where Click Handlers Live

**UpgradePage.tsx (In-App Upgrade):**

**File:** `src/pages/UpgradePage.tsx`

**Key Functions:**
- `handleUpgradeClick(planName)` - Main upgrade handler
- `executeCheckout(planName)` - Calls Stripe API
- `handleManageBilling()` - Opens Stripe portal
- `getButtonForPlan(plan)` - Returns button config based on user state

**Button Config Logic:**
```typescript
const getButtonForPlan = (plan: any) => {
  if (plan.name === 'Free') {
    return { text: '', disabled: true, show: false, isBilling: false };
  }

  if (plan.name === 'Pro') {
    if (isPaidPro) {
      if (user?.subscription_status === 'canceled') {
        return { text: 'Resubscribe', disabled: false, show: true, isBilling: false };
      }
      if (user?.subscription_status === 'past_due') {
        return { text: 'Change plan or cancel', disabled: false, show: true, isBilling: true };
      }
      return { text: 'Change plan or cancel', disabled: false, show: true, isBilling: true };
    }

    if (isReferralPro) {
      return { text: 'Upgrade to paid Pro', disabled: false, show: true, isBilling: false };
    }

    return { text: 'Upgrade to Pro', disabled: false, show: true, isBilling: false };
  }

  if (plan.name === 'Founder Access') {
    if (isFounder) {
      return { text: 'Founder Access granted', disabled: true, show: true, isBilling: false };
    }

    if (founderSoldOut) {
      return { text: 'Sold out', disabled: true, show: true, isBilling: false };
    }

    return { text: 'Claim founder access', disabled: false, show: true, isBilling: false };
  }

  return { text: '', disabled: true, show: false, isBilling: false };
};
```

**Checkout Call:**
```typescript
const response = await fetch('/api/stripe/create-checkout-session', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify(body),
});
```

---

**PricingPage.tsx (Public Pricing):**

**File:** `src/pages/PricingPage.tsx`

**Current State:**
- No click handlers
- All buttons are `<Link>` components
- All buttons link to `/signup`
- No plan selection preservation
- No direct checkout for logged-in users

**Button Config:**
```typescript
cta: { 
  text: 'Start Free', 
  link: '/signup', 
  primary: false 
}
```

**Pro Button (Dynamic):**
```typescript
cta: { 
  text: billingInterval === 'yearly' ? 'Start Pro — $197/year' : 'Start Pro — $19/mo', 
  link: '/signup', 
  primary: true 
}
```

**Founder Button:**
```typescript
cta: { 
  text: 'Claim Founder Access — $97 Once', 
  link: '/signup', 
  primary: true, 
  urgency: '50 spots total. Closes permanently when full.' 
}
```

---

### Do /pricing and /upgrade Share Logic?

**No.** They are completely separate:

**UpgradePage.tsx:**
- Full checkout logic
- Authenticated user state handling
- Stripe subscription updates
- Billing portal integration
- Plan change confirmation modal
- Complex button state logic

**PricingPage.tsx:**
- Static display only
- No checkout logic
- Links to signup
- No user state handling
- Simple button text

**Potential Duplication:** If we add checkout logic to `/pricing`, we'll need to either:
1. Extract shared logic to a custom hook
2. Copy logic from UpgradePage
3. Redirect to `/upgrade` with plan selection preserved

---

### Can Buttons Support Different Behavior?

**Yes.** The current structure allows:

**PricingPage.tsx:**
- Can replace `<Link>` with `<button>` + click handler
- Can check auth state via `useAuth()`
- Can conditionally redirect to signup vs checkout
- Can preserve plan selection via URL params or localStorage

**UpgradePage.tsx:**
- Already has complex conditional logic
- Can be refactored to accept plan/billing as props
- Can be reused by pricing page

**Recommendation:** Extract checkout logic to a shared hook (`useCheckout`) that both pages can use.

---

## 8. Public Pricing Recommendation

### Option A: Click Pro → Create Free Account → Continue to Stripe

**Flow:**
1. User clicks "Start Pro" on `/pricing`
2. Redirect to `/signup?plan=pro&billing=yearly`
3. Clerk signup with preserved redirect
4. After signup, redirect to `/checkout?plan=pro&billing=yearly`
5. Checkout page calls `/api/stripe/create-checkout-session`
6. Redirect to Stripe
7. Complete payment → `/success` → `/dashboard`

**Pros:**
- User has account before payment (better for abandoned checkout recovery)
- Can send follow-up emails to users who signed up but didn't complete purchase
- Consistent with current auth-first architecture
- Easier to implement (reuse existing signup flow)
- Better for referral tracking (user exists before purchase)

**Cons:**
- Extra step (signup) before checkout
- Higher friction (might reduce conversion)
- Requires plan preservation through auth flow
- Need new `/checkout` route

---

### Option B: Go Directly to Stripe → Create Account Afterward

**Flow:**
1. User clicks "Start Pro" on `/pricing`
2. Call `/api/stripe/create-checkout-session` with `customer_email` (no auth required)
3. Redirect to Stripe
4. Complete payment → Stripe redirects to `/success?plan=pro`
5. `/success` prompts user to create account
6. User completes signup → account linked to Stripe customer via email
7. Webhook activates Pro features

**Pros:**
- Faster path to payment (higher conversion)
- Less friction
- No plan preservation needed
- Simpler flow for logged-out users

**Cons:**
- User doesn't have account until after payment
- Harder to recover abandoned checkouts (no email to follow up)
- Requires unauthenticated checkout session creation (security risk)
- Account linking via email is fragile (email typos, different emails)
- Referral tracking becomes complex (no user ID at purchase time)
- Webhook must handle user creation (complex)
- Stripe customer email must match signup email (user confusion risk)

---

### Recommendation: Option A (Account First, Then Checkout)

**Rationale:**

1. **Fits Existing Architecture:**
   - Current system is auth-first (all protected routes require auth)
   - `/api/stripe/create-checkout-session` requires authentication
   - User sync happens via Clerk on every auth state change
   - Referral system expects user to exist before purchase

2. **Better User Experience Long-Term:**
   - Can send abandoned checkout emails
   - Can track user journey from signup to purchase
   - Can offer incentives to complete purchase
   - Account setup happens once, not split across payment

3. **Security:**
   - No unauthenticated checkout sessions
   - User identity verified before payment
   - No email-based account linking fragility

4. **Referral Tracking:**
   - Referral codes captured during signup
   - Referral attribution clear at purchase time
   - Creator impact tracking works correctly

5. **Implementation Simplicity:**
   - Reuse existing signup flow
   - Add plan preservation via URL params
   - Create simple `/checkout` route that calls existing API
   - Minimal changes to existing code

**Implementation Path:**
1. Add plan/billing preservation to signup via URL params
2. Create `/checkout` route that reads params and calls checkout API
3. Update `/pricing` buttons to link to `/signup?plan=pro&billing=yearly`
4. Update Clerk redirect to `/checkout` after signup
5. Add abandoned checkout email flow (future enhancement)

---

## 9. Risks

### Duplicate Checkout Logic

**Risk:** `/pricing` and `/upgrade` may end up with duplicate checkout logic.

**Mitigation:**
- Extract checkout logic to shared hook (`useCheckout`)
- Or redirect `/pricing` → `/upgrade` with plan selection preserved
- Keep single source of truth for checkout in UpgradePage

---

### Duplicated Pricing Components

**Risk:** PricingPage and UpgradePage both render pricing cards with different logic.

**Current State:** Already duplicated (different components, different logic).

**Mitigation:**
- Accept duplication for now (public vs in-app use cases are different)
- Future: Extract shared `PricingCard` component
- Keep styling consistent between both pages

---

### Authentication Edge Cases

**Risk 1:** Plan preservation through auth flow may fail.

**Mitigation:**
- Use URL params + localStorage fallback
- Validate params after auth
- Default to `/upgrade` if params invalid

**Risk 2:** User signs up on `/pricing` but gets redirected to `/dashboard` instead of checkout.

**Mitigation:**
- Update Clerk redirect logic to check for plan params
- Add conditional redirect in AuthContext
- Test full flow end-to-end

**Risk 3:** User has account but is logged out when clicking pricing button.

**Mitigation:**
- Check auth state on `/pricing`
- If logged in, redirect to `/upgrade` with plan selection
- If logged out, redirect to `/signup` with plan selection

---

### Webhook Concerns

**Risk 1:** Webhook processing fails → user pays but doesn't get access.

**Mitigation:**
- Webhook already has idempotency table
- Webhook logs errors
- Success page polls for activation (15-second timeout)
- User can refresh to check status
- Add manual admin fix endpoint (future)

**Risk 2:** Stale webhook events reactivate canceled subscriptions.

**Mitigation:**
- Already implemented: event-order protection in `customer.subscription.updated`
- Checks if same subscription was already canceled
- Allows new subscriptions (different ID) to reactivate

**Risk 3:** Founder webhook processes but user already has founder access.

**Mitigation:**
- Uses `INSERT OR IGNORE` on founder_access table
- Idempotent - safe to retry

---

### Subscription Sync Issues

**Risk 1:** Stripe subscription updates but webhook delayed/lost.

**Mitigation:**
- Webhook idempotency prevents double-processing
- Success page polling catches activation
- User can refresh to check status
- Admin can manually fix via admin panel

**Risk 2:** User has multiple subscriptions (rare edge case).

**Mitigation:**
- Webhook finds user by subscription_id or customer_id
- Subscription_id takes precedence
- Customer_id fallback for new subscriptions

---

### Founder Purchase Edge Cases

**Risk 1:** Founder cap (50) reached during checkout.

**Mitigation:**
- Cap enforced in `create-checkout-session.js` before creating Stripe session
- Returns 409 error with sold-out message
- UI shows sold-out state

**Risk 2:** User purchases Founder but already has paid Pro subscription.

**Mitigation:**
- Founder access is separate entitlement layer
- Both can coexist (redundant but not harmful)
- User keeps both (no refund logic needed)

**Risk 3:** Founder webhook processes but user doesn't exist in database.

**Mitigation:**
- Webhook finds user by metadata.userId or Stripe IDs
- If user not found, webhook returns error
- Requires user to exist before purchase (auth-first flow prevents this)

---

### Referral Tracking Edge Cases

**Risk 1:** Referral code lost during signup → no attribution.

**Mitigation:**
- Referral code stored in localStorage
- URL params checked as fallback
- Sync endpoint accepts referralCode in body
- Auto-repair logic checks for missing rewards

**Risk 2:** User purchases before referral code captured.

**Mitigation:**
- Auth-first flow prevents this (user exists before purchase)
- Referral captured during signup
- Purchase happens after signup

---

### Future Maintenance Problems

**Risk 1:** Pricing logic scattered across multiple files.

**Mitigation:**
- Document current architecture (this audit)
- Consider extracting shared pricing component
- Keep pricing config in single source of truth

**Risk 2:** Stripe price IDs hardcoded in multiple places.

**Mitigation:**
- Price IDs already in environment variables
- Only `create-checkout-session.js` and `webhook.js` reference them
- Webhook fails loudly on unknown price IDs

**Risk 3:** Founder cap hardcoded to 50.

**Mitigation:**
- Cap enforced in `create-checkout-session.js`
- Founder stats API returns limit
- Consider making limit configurable via env var

---

## 10. Recommended Architecture

### End-State Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Visitor Flow                               │
└─────────────────────────────────────────────────────────────────┘

New Visitor:
  / or /b (Homepage)
    ↓
  /pricing (Public Pricing Page)
    ↓ Click "Start Pro — $197/year"
  /signup?plan=pro&billing=yearly (Clerk Signup)
    ↓ Complete Signup
  /checkout?plan=pro&billing=yearly (Checkout Page)
    ↓ Calls /api/stripe/create-checkout-session
  Stripe Hosted Checkout
    ↓ Complete Payment
  /success (Success Page)
    ↓ Poll for activation
  /dashboard (Dashboard)

Logged-in Free User:
  /pricing
    ↓ Click "Start Pro"
  /upgrade?plan=pro&billing=yearly (Redirect)
    ↓ Click "Upgrade to Pro"
  Stripe Checkout
    ↓ Complete Payment
  /success
    ↓
  /dashboard

Logged-in Pro User:
  /pricing
    ↓ Click "Start Pro"
  /upgrade (Redirect)
    ↓ See "Change plan or cancel"
  Stripe Portal
    ↓
  /upgrade

Logged-in Founder User:
  /pricing
    ↓ Click "Claim Founder Access"
  /upgrade (Redirect)
    ↓ See "Founder Access granted"
  /dashboard
```

---

### Page Responsibilities

**/ (Homepage)**
- Marketing copy
- Links to `/pricing`
- Redirects authenticated users to `/dashboard`

**/b (Homepage B)**
- Long-form sales copy (split test)
- Links to `/pricing`
- Redirects authenticated users to `/dashboard`

**/pricing (Public Pricing)**
- Public pricing display
- No auth required
- Links to `/signup` with plan selection
- Shows founder counter (50 remaining)
- Shows sold-out state when founder cap reached

**/signup (Clerk Signup)**
- Clerk authentication
- Accepts `?plan=pro&billing=yearly` params
- Preserves plan selection through auth
- Redirects to `/checkout` after signup (if plan selected)
- Redirects to `/dashboard` (default)

**/checkout (NEW - Checkout Page)**
- Reads plan/billing from URL params
- Calls `/api/stripe/create-checkout-session`
- Redirects to Stripe
- Protected route (auth required)
- Simple wrapper around existing API

**/upgrade (In-App Upgrade)**
- Full upgrade page for logged-in users
- Shows current plan status
- Handles subscription updates
- Opens Stripe portal
- Complex button state logic
- Founder cap enforcement

**/success (Success Page)**
- Polls for subscription activation
- Shows verifying → success → timeout states
- Links to `/dashboard`
- Protected route (auth required)

**/dashboard (Dashboard)**
- Main app interface
- Protected route
- Shows features based on effective plan

---

### API Endpoints

**Authentication:**
- `POST /api/users/sync` - Sync Clerk user to D1

**Stripe:**
- `POST /api/stripe/create-checkout-session` - Create checkout (auth required)
- `POST /api/stripe/create-billing-portal-session` - Open portal (auth required)
- `POST /api/stripe/webhook` - Stripe webhook (no auth, signature verified)

**Founder:**
- `GET /api/founder-stats` - Get founder count (public)

---

### Database Schema Summary

```
users
├── id, email, username, clerk_user_id
├── plan, subscription_status, subscription_current_period_end
├── stripe_customer_id, stripe_subscription_id
├── referral_reward_active, referral_reward_plan, referral_reward_expires_at
├── has_founder_access (computed)
└── pro_welcome_email_sent_at, founder_welcome_email_sent_at

founder_access
├── id, user_id
├── is_comped, source, granted_at, granted_by
└── stripe_checkout_session_id, stripe_payment_intent_id

stripe_webhook_events
├── id, type
└── processed_at

referral_rewards
├── id, user_id
├── milestone_count, reward_plan, reward_days
└── granted_at, expires_at
```

---

### Implementation Priority

**Phase 1: Public Pricing (Current)**
- ✅ Create `/pricing` page
- ✅ Add route to App.tsx
- ✅ Update nav links
- ✅ Founder counter integration
- ✅ Sold-out state

**Phase 2: Auth-First Checkout Flow**
- Add plan preservation to signup via URL params
- Create `/checkout` route
- Update Clerk redirect logic
- Update `/pricing` buttons to use new flow
- Test end-to-end

**Phase 3: Logged-in User Handling**
- Add auth check to `/pricing`
- Redirect logged-in users to `/upgrade` with plan selection
- Preserve billing interval selection

**Phase 4: Refinement**
- Add abandoned checkout email flow
- Add checkout analytics
- Extract shared checkout logic to hook
- Consider shared pricing component

---

### Key Design Decisions

1. **Auth-First Flow:** User must have account before checkout
2. **Plan Preservation:** URL params + localStorage fallback
3. **Separate Pages:** `/pricing` (public) vs `/upgrade` (in-app)
4. **Founder Entitlement:** Separate table, not tied to subscription
5. **Webhook Idempotency:** Prevents duplicate processing
6. **Event-Order Protection:** Prevents stale webhook reactivations
7. **Price ID Validation:** Fails loudly on unknown price IDs

---

### Conclusion

The current architecture is well-designed for an auth-first purchase flow. The main gap is the lack of plan preservation through the signup flow and the absence of a dedicated checkout route for logged-out users.

**Recommended approach:** Implement Option A (account first, then checkout) with the following changes:
1. Add plan/billing preservation to signup via URL params
2. Create `/checkout` route as simple wrapper around existing API
3. Update `/pricing` to use new flow
4. Add auth check to redirect logged-in users to `/upgrade`

This approach fits the existing architecture, maintains security, enables abandoned checkout recovery, and provides the best long-term user experience.
