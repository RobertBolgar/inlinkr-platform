# Pro Downgrade Behavior Rules

This document defines the behavior requirements when a user downgrades from Pro to Free or cancels their subscription.

## Core Principles

1. **Data Preservation**
   - Downgrading from Pro to Free must never delete user data.
   - Existing links remain active and functional.
   - Existing click history remains stored in the database.
   - Existing video_id attachments remain stored in the database.

2. **Link Continuity**
   - Existing standard `go.tubelinkr.com` links continue working without interruption.
   - `username.tubelinkr.com/slug` should redirect to `go.tubelinkr.com/username/slug` after cancellation.
   - No user-facing links should break due to cancellation.

3. **Pro Feature Access**
   - Pro analytics UI is hidden for free users, but underlying data remains.
   - Free users cannot create or edit Pro-only features after downgrade.
   - Existing Pro features (like video attachments) remain associated with links but are not editable by free users.

4. **Custom Subdomains**
   - Future custom subdomains must be disabled or redirected after cancellation, not broken.
   - Custom domain redirects should fall back to standard `go.tubelinkr.com` URLs.

5. **Billing vs Data**
   - Billing status controls access to features, not data deletion.
   - Access restrictions are UI/behavioral, not destructive to data.

6. **Destructive Actions**
   - Any destructive cleanup (data deletion) must require explicit separate admin/user action.
   - No automatic data deletion on subscription cancellation or downgrade.
   - Users must explicitly request account/data deletion through a separate process.

## Implementation Requirements

- All feature gates should check `isPro` status from billing/subscription, not data presence.
- UI components should conditionally render Pro features based on billing status.
- API endpoints should respect billing status for write operations on Pro features.
- Redirect logic should handle custom domain fallbacks gracefully.
- Data retention policies should be separate from subscription lifecycle.

## Examples

### Video Attachments
- Free users: Cannot attach videos to new or existing links.
- Downgraded Pro users: Existing video attachments remain stored but are not visible/editable in UI.
- Re-upgrading: All previously attached videos become accessible again.

### Analytics
- Free users: See basic click stats only.
- Pro users: See video performance, conversion rates, and advanced analytics.
- Downgraded Pro users: Advanced analytics UI hidden, but data remains in database.

### Custom Domains
- Pro users: Can configure custom domains.
- Cancellation: Custom domains redirect to standard `go.tubelinkr.com` URLs.
- No 404 errors or broken links.
