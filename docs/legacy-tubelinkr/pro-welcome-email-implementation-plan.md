> Legacy TubeLinkr reference only.
> This document exists to preserve historical implementation details.
> New platform work should follow the InLinkr documentation.

# Pro Welcome Email Implementation Plan

**Date:** 2026-05-28  
**Branch:** pro-dev  
**Status:** Planning phase - NO CODE CHANGES YET

---

## Executive Summary

**Safest Insertion Point:** `functions/api/stripe/webhook.js` - `checkout.session.completed` event handler  
**Risk Level:** LOW  
**Impact:** HIGH (paid user onboarding)  
**Complexity:** LOW

---

## Current System Analysis

### Exact Event Responsible for Pro Activation

**File:** `functions/api/stripe/webhook.js`  
**Event:** `checkout.session.completed` (lines 104-204)  
**Activation Logic:** Lines 169-178

```javascript
if (subscriptionStatus === 'active') {
  await env.DB.prepare(
    "UPDATE users SET plan = ?, subscription_status = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?"
  )
    .bind(plan, "active", customerId, subscriptionId, user.id)
    .run();
}
```

**Key Characteristics:**
- User record is guaranteed to exist (found via `session.metadata.userId` or Stripe IDs)
- Plan is determined from Stripe API call to `/subscriptions/{subscriptionId}` (lines 130-141)
- Founder checkouts are explicitly handled separately (lines 151-166) and do NOT set plan/subscription_status
- Has idempotency protection via `stripe_webhook_events` table (lines 86-95)

### Alternative Event: customer.subscription.created

**Location:** Lines 206-239  
**Status:** Redundant for Pro activation  
**Why NOT to use:** 
- `checkout.session.completed` fires first and is the canonical trigger
- Adding email logic here would risk duplicate emails
- Less context available (no session metadata)

### Founder-Access Interactions

**Founder Checkout Handling:** Lines 151-166
```javascript
const isFounderCheckout = plan === 'founder' || (session.metadata?.plan === 'founder');

if (isFounderCheckout) {
  // Insert founder_access row (separate entitlement layer)
  // Does NOT set plan/subscription_status
}
```

**Safety Guarantee:** Founder checkouts are explicitly isolated and will NOT trigger Pro welcome email because:
- Founder checkouts use `plan === 'founder'` detection
- Founder checkouts insert into `founder_access` table instead of setting `plan`/`subscription_status`
- Pro email trigger will check `plan === 'pro'` or `plan === 'pro_plus'`

---

## Email Pattern Analysis

### Existing Email Helper

**File:** `functions/api/email-helper.js`  
**Function:** `sendTransactionalEmail(env, { to, subject, html })`

**Pattern:**
```javascript
await sendTransactionalEmail(env, {
  to: email,
  subject: `Subject here`,
  html: `<div>HTML content</div>`
});
```

**Error Handling Pattern (from users/sync.js lines 279-310):**
```javascript
try {
  await sendTransactionalEmail(env, { ... });
} catch (emailError) {
  console.error('Failed to send email:', emailError);
  // Don't break the main flow
}
```

### No Separate Template Files

**Finding:** No email template files exist in the codebase  
**Pattern:** Inline HTML templates (see `users/sync.js` lines 287-304)  
**Recommendation:** Follow existing pattern - inline HTML in webhook handler

---

## Exact Implementation Plan

### Step 1: Database Migration

**File to Create:** `migrations/add-pro-welcome-email-guard.sql`

```sql
-- Add guard field to prevent duplicate Pro welcome emails
ALTER TABLE users ADD COLUMN pro_welcome_email_sent_at TEXT;
```

**Safety:** Zero-risk migration - only adds a nullable field  
**Rollback:** `ALTER TABLE users DROP COLUMN pro_welcome_email_sent_at;`

### Step 2: Modify Stripe Webhook

**File to Modify:** `functions/api/stripe/webhook.js`

**Location:** After line 178 (after the subscription activation UPDATE)

**Exact Insertion Point:**

```javascript
// AFTER LINE 178 (current console.log)
console.log(
  `Updated user ${user.id} to plan ${plan} with active subscription, customer: ${customerId}, subscription: ${subscriptionId}`
);

// INSERT PRO WELCOME EMAIL LOGIC HERE
// ...
```

**Implementation Code:**

```javascript
// Send Pro welcome email for Pro/Pro+ subscriptions only
if ((plan === 'pro' || plan === 'pro_plus') && subscriptionStatus === 'active') {
  try {
    // Fetch user email and first_name for personalization
    const userData = await env.DB.prepare(
      'SELECT email, first_name, pro_welcome_email_sent_at FROM users WHERE id = ?'
    ).bind(user.id).first();

    if (userData && userData.email && !userData.pro_welcome_email_sent_at) {
      const firstName = userData.first_name || 'there';
      
      await sendTransactionalEmail(env, {
        to: userData.email,
        subject: `Welcome to Pro, ${firstName} — let's set up your creator hub`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
            <h2>Hey ${firstName},</h2>
            
            <p>Welcome to TubeLinkr Pro! You now have access to unlimited links, branded subdomains, and your creator hub.</p>
            
            <p><strong>Here's what to do next:</strong></p>
            
            <ul>
              <li>Set up your branded subdomain (username.tubelinkr.com)</li>
              <li>Customize your creator hub in Settings</li>
              <li>Create unlimited smart links</li>
            </ul>
            
            <p>
              <a href="https://tubelinkr.com/settings"
                 style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">
                Go to Settings →
              </a>
            </p>
            
            <p>— TubeLinkr</p>
          </div>
        `
      });

      // Update guard field only after successful email send
      const emailTimestamp = new Date().toISOString();
      await env.DB.prepare(
        'UPDATE users SET pro_welcome_email_sent_at = ? WHERE id = ?'
      ).bind(emailTimestamp, user.id).run();

      console.log(`Pro welcome email sent to user ${user.id} (${userData.email})`);
    }
  } catch (emailError) {
    // Log error but don't break subscription activation
    console.error('Failed to send Pro welcome email:', emailError);
  }
}
```

**Import Required:** Add at top of file
```javascript
import { sendTransactionalEmail } from '../email-helper.js';
```

---

## Duplicate-Prevention Strategy

### Primary Guard: Database Field

**Field:** `pro_welcome_email_sent_at` TEXT  
**Check:** `!userData.pro_welcome_email_sent_at`  
**Update:** Set timestamp only after successful email send

### Secondary Guard: Webhook Idempotency

**Existing Protection:** `stripe_webhook_events` table (lines 86-95)  
**Mechanism:** Duplicate webhook events are ignored before business logic runs  
**Coverage:** Prevents re-processing of the same Stripe event

### Tertiary Guard: Plan Check

**Check:** `plan === 'pro' || plan === 'pro_plus'`  
**Coverage:** Prevents email for Founder checkouts (plan === 'founder')

---

## Rollback Strategy

### Immediate Rollback (Code Only)

**Action:** Remove email sending logic from webhook  
**Impact:** Existing users keep their guard field values, new Pro users won't get email  
**Risk:** ZERO

### Database Rollback (If Needed)

**Action:** 
```sql
ALTER TABLE users DROP COLUMN pro_welcome_email_sent_at;
```

**Impact:** Removes guard field completely  
**Risk:** LOW (nullable field, no constraints)

### Graceful Degradation

**Current Error Handling:** Try/catch around email send (line 307 in users/sync.js pattern)  
**Behavior:** If email fails, subscription activation still succeeds  
**User Impact:** User gets Pro access but no welcome email (acceptable failure mode)

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Email send fails | LOW | LOW | Try/catch, don't break subscription |
| Duplicate email sent | VERY LOW | LOW | Guard field + webhook idempotency |
| Founder gets Pro email | ZERO | HIGH | Explicit plan check (founder ≠ pro) |
| Migration fails | VERY LOW | LOW | Simple ALTER TABLE, no constraints |
| Webhook timeout | LOW | MEDIUM | Email send is non-blocking (async) |

### Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Email content errors | LOW | MEDIUM | Test with test checkout first |
| Wrong users get email | VERY LOW | HIGH | Plan check + guard field |
| Email sends too late | LOW | LOW | Webhook fires immediately after payment |

### Overall Risk Level: **LOW**

**Reasoning:**
- Isolated to new Pro subscribers only
- Multiple duplicate-prevention layers
- Graceful error handling
- Founder checkouts explicitly excluded
- Simple, well-understood pattern

---

## Testing Strategy

### Pre-Deployment Testing

1. **Test Migration**
   - Run migration on local D1
   - Verify field added successfully
   - Test rollback

2. **Test Email Send**
   - Create test Stripe checkout for Pro
   - Complete checkout
   - Verify email received
   - Verify guard field updated
   - Retry same checkout (verify no duplicate)

3. **Test Founder Exclusion**
   - Create test Stripe checkout for Founder
   - Complete checkout
   - Verify NO Pro email sent
   - Verify founder_access row created

4. **Test Error Handling**
   - Temporarily break RESEND_API_KEY
   - Complete checkout
   - Verify subscription still activates
   - Verify error logged

### Production Rollout

1. **Deploy Migration First**
   - Run migration on production D1
   - Verify success
   - No code changes yet

2. **Deploy Code Changes**
   - Deploy webhook changes
   - Monitor logs for email sends
   - Monitor for errors

3. **Smoke Test**
   - Complete real Pro checkout
   - Verify email received
   - Verify guard field updated

---

## Files to Modify

### 1. Create New File
- `migrations/add-pro-welcome-email-guard.sql`

### 2. Modify Existing File
- `functions/api/stripe/webhook.js`
  - Add import: `import { sendTransactionalEmail } from '../email-helper.js';`
  - Add email logic after line 178

### Files NOT to Modify
- ❌ `functions/api/email-helper.js` (no changes needed)
- ❌ `functions/api/users/sync.js` (no changes needed)
- ❌ `wrangler.toml` (no changes needed)
- ❌ Any Stripe billing logic (only add email, don't change billing state)

---

## Exact Migration Required

```sql
-- File: migrations/add-pro-welcome-email-guard.sql
-- Description: Add guard field to prevent duplicate Pro welcome emails
-- Risk: LOW (nullable field, no constraints)

ALTER TABLE users ADD COLUMN pro_welcome_email_sent_at TEXT;
```

**Execution Order:**
1. Run migration on production D1
2. Verify field exists
3. Deploy webhook code changes
4. Test with real checkout

---

## Success Criteria

1. ✅ Migration runs successfully on production D1
2. ✅ New Pro subscribers receive welcome email within 1 minute of checkout
3. ✅ No duplicate emails sent (verified by guard field)
4. ✅ Founder users do NOT receive Pro welcome email
5. ✅ Email send failure does not break subscription activation
6. ✅ Webhook logs show email send attempts
7. ✅ Guard field is updated only after successful email send

---

## Post-Implementation Monitoring

### Metrics to Track
- Number of Pro welcome emails sent
- Email send failure rate
- Time from checkout to email send
- Duplicate email attempts (should be zero)

### Log Queries
```javascript
// Check email sends
console.log(`Pro welcome email sent to user ${user.id} (${userData.email})`);

// Check email failures
console.error('Failed to send Pro welcome email:', emailError);
```

### Database Queries
```sql
-- Check how many users received Pro welcome email
SELECT COUNT(*) FROM users WHERE pro_welcome_email_sent_at IS NOT NULL;

-- Check for any Pro users without email (should be old users only)
SELECT id, email, created_at FROM users 
WHERE plan = 'pro' 
  AND subscription_status = 'active' 
  AND pro_welcome_email_sent_at IS NULL;
```

---

## Summary

**Safest Trigger:** `checkout.session.completed` in `functions/api/stripe/webhook.js`  
**Insertion Point:** After line 178 (after subscription activation)  
**Guard Field:** `pro_welcome_email_sent_at` TEXT  
**Risk Level:** LOW  
**Founder Safety:** Explicit plan check prevents Founder emails  
**Pattern:** Follow existing inline HTML pattern from `users/sync.js`  
**Error Handling:** Try/catch, don't break subscription activation  
**Rollback:** Simple code removal + optional field drop

**Ready for implementation after migration is created and tested.**
