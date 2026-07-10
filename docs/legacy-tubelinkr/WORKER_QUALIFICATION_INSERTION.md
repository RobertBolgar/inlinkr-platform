> Legacy TubeLinkr reference only.
> This document exists to preserve historical implementation details.
> New platform work should follow the InLinkr documentation.

# Worker Referral Qualification Insertion

**⚠️ DISABLED FOR LAUNCH**

The public `/api/referrals/qualify` endpoint has been permanently disabled (410 Gone) to prevent unauthenticated callers from triggering referral qualification or reward grants.

## Status

- **Endpoint:** `/api/referrals/qualify` - Returns 410 Gone
- **Reason:** No authentication, no Worker secret, no rate limit
- **Future Implementation:** Must use a Worker-only shared secret or internal-only mechanism

## Target: tubelinkr-go Worker

## Exact Code to Insert

**DO NOT INSERT THIS CODE** - The endpoint is disabled.

```javascript
// Fire-and-forget referral qualification (non-blocking)
try {
  console.log(`[REFERRAL QUALIFY DEBUG] worker fired for user: ${link.user_id}`);
  
  fetch('https://tubelinkr.com/api/referrals/qualify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      referredUserId: link.user_id.toString()
    })
  }).catch(() => {
    // Silently ignore qualification failures - don't break redirect
  });
} catch (e) {
  // Silently ignore setup errors - don't break redirect
}
```

## Insertion Location

**DO NOT INSERT** - The endpoint is disabled.

Find the section in the Worker where the click event is inserted into the database. The insertion should happen right after this succeeds.

**Example pattern to look for:**
```javascript
// AFTER this kind of code:
await env.DB.prepare(`
  INSERT INTO click_events (link_id, timestamp, referrer, user_agent, ip_hash, source)
  VALUES (?, ?, ?, ?, ?, ?)
`).bind(link.id, now, referrer, userAgent, ipHash, normalizedSource).run();

// INSERT THE QUALIFICATION CODE HERE ⬇️

// BEFORE the redirect:
return Response.redirect(link.original_url, 302);
```

## Critical Requirements

1. **DO NOT INSERT THIS CODE** - The endpoint is disabled
2. Future implementation must use Worker-only shared secret or internal-only mechanism
3. Future implementation must prevent unauthenticated callers

## Expected Flow

**CURRENT STATE:** Disabled
1. Click event recorded in database
2. No qualification call
3. Redirect response returned instantly

**FUTURE STATE (when re-enabled):**
1. Click event recorded in database
2. Qualification fetch fired (non-blocking, with Worker secret)
3. Redirect response returned instantly
4. Qualification runs asynchronously in Pages API

## Testing

**DO NOT TEST** - The endpoint is disabled (returns 410 Gone).
