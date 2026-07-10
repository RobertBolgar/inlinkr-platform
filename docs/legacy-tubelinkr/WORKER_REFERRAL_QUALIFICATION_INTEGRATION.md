> Legacy TubeLinkr reference only.
> This document exists to preserve historical implementation details.
> New platform work should follow the InLinkr documentation.

# Worker Referral Qualification Integration

**⚠️ DISABLED FOR LAUNCH**

The public `/api/referrals/qualify` endpoint has been permanently disabled (410 Gone) to prevent unauthenticated callers from triggering referral qualification or reward grants.

## Status

- **Endpoint:** `/api/referrals/qualify` - Returns 410 Gone
- **Reason:** No authentication, no Worker secret, no rate limit
- **Future Implementation:** Must use a Worker-only shared secret or internal-only mechanism

## Overview
This document described how to integrate referral qualification into the tubelinkr-go Worker to ensure `tryQualifyReferral` runs on every tracked click.

**NOTE:** This integration is currently disabled. The endpoint returns 410 Gone.

## Problem
- Clicks are handled in tubelinkr-go Worker
- Referral qualification logic previously existed in Pages API (`/api/redirect`) - now obsolete
- Worker handles redirects directly
- So qualification logic must be integrated into Worker

**⚠️ SECURITY ISSUE:** The public `/api/referrals/qualify` endpoint has no authentication, no Worker secret, and no rate limit, allowing unauthenticated callers to trigger qualification and reward grants.

## Solution
**DISABLED** - Future implementation must add fire-and-forget fetch call to a protected `/api/referrals/qualify` endpoint after recording each click, using a Worker-only shared secret or internal-only mechanism.

## Implementation

**DO NOT IMPLEMENT** - The endpoint is disabled.

### 1. After Click Recording
In the Worker, after successfully recording the click event, add:

```javascript
// After click event insert succeeds
try {
  console.log(`[REFERRAL QUALIFY DEBUG] from worker - calling qualification for user: ${link.user_id}`);
  
  // Fire-and-forget qualification call (non-blocking)
  fetch('https://tubelinkr.com/api/referrals/qualify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // TODO: Add Worker secret header for authentication
      // 'X-Worker-Secret': env.REFERRAL_WORKER_SECRET,
    },
    body: JSON.stringify({
      referredUserId: link.user_id.toString()
    })
  }).catch(error => {
    // Log but don't fail the redirect
    console.warn('[REFERRAL QUALIFY DEBUG] Worker qualification call failed:', error);
  });
  
  console.log(`[REFERRAL QUALIFY DEBUG] from worker - qualification call fired for user: ${link.user_id}`);
} catch (error) {
  console.warn('[REFERRAL QUALIFY DEBUG] Worker qualification setup failed:', error);
}
```

### 2. Key Requirements

**FUTURE IMPLEMENTATION MUST:**
- Use a Worker-only shared secret or internal-only mechanism
- Prevent unauthenticated callers from triggering qualification
- Be non-blocking (do not await)
- Wrap in try/catch to prevent Worker failures

### 3. Expected Flow

**CURRENT STATE:** Disabled
1. User clicks go.tubelinkr.com link
2. Worker records click event
3. Worker redirects to destination instantly
4. No qualification call

**FUTURE STATE (when re-enabled):**
1. User clicks go.tubelinkr.com link
2. Worker records click event
3. Worker fires qualification fetch (non-blocking, with Worker secret)
4. Worker redirects to destination instantly
5. Pages API receives qualification request (with secret verification)
6. tryQualifyReferral runs with detailed logging
7. referral.is_qualified updated if conditions met

### 4. Debugging

The endpoint would return detailed results when re-enabled:
```javascript
{
  attempted: true,
  qualified: true/false,
  reason: "qualified" | "no_referral_row" | "already_qualified" | "not_enough_links" | "not_enough_clicks" | "ip_check_failed" | "flag_off" | "error",
  linkCount: number,
  clickCount: number
}
```

### 5. Environment Variables

**FUTURE IMPLEMENTATION:**
Ensure the Worker has access to:
- D1 database (same as Pages API)
- Feature flags (referrals_enabled, referrals_ip_check_enabled)
- Worker secret for authentication (REFERRAL_WORKER_SECRET)

## Testing

**DO NOT TEST** - The endpoint is disabled (returns 410 Gone).

**FUTURE TESTING (when re-enabled):**
1. Deploy the Worker with integration
2. Test referral signup flow
3. Click referral link twice
4. Check Cloudflare logs for qualification debug messages
5. Verify referrals.is_qualified becomes 1

## Safety

- All qualification logic is wrapped in try/catch
- Worker redirect continues even if qualification fails
- No impact on redirect performance
- No breaking changes to existing click tracking
