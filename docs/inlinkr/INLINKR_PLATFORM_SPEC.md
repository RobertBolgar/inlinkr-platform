# InLinkr Platform Specification v1

## Core Decision

InLinkr is the platform.

TubeLinkr and QRLinkr are products built on the InLinkr platform.

The current TubeLinkr build will be used as the reference implementation because the core platform already exists and works.

## Goal

Create a new InLinkr platform project without breaking the current TubeLinkr app.

TubeLinkr remains functional while InLinkr is built separately.

## Final Domain Structure

- `inlinkr.com` = platform website
- `app.inlinkr.com` = logged-in dashboard/app
- `go.inlinkr.com` = redirect engine
- `username.inlinkr.com` = creator profiles
- `tubelinkr.com` = TubeLinkr marketing/product site
- `qrlinkr.com` = QRLinkr marketing/product site

## Account Strategy

Keep existing accounts:

- Cloudflare account
- Stripe account
- Google Cloud project
- Clerk account/project unless a migration is required
- GitHub account
- TubeLinkr Gmail as backup

New:

- InLinkr Gmail
- `inlinkr.com`
- GitHub repo: `inlinkr-platform`
- Cloudflare Pages project: `inlinkr-platform`

## Product Model

One user account can have multiple products enabled.

Initial products:

- TubeLinkr
- QRLinkr

Future products may include:

- PodcastLinkr
- EventLinkr
- AffiliateLinkr
- EmailLinkr

## Shared Platform Services

These belong to InLinkr, not to a single product:

- Authentication
- Users
- Billing
- Subscriptions
- Redirect engine
- Analytics
- Traffic Proof
- Creator profiles
- Referrals
- Event tracking
- Admin dashboard
- Feature flags
- Email notifications

## Product-Specific Services

TubeLinkr:

- Smart Links
- YouTube placements
- YouTube OAuth
- Video analytics
- Creator Hub workflows
- QR placement integration

QRLinkr:

- QR generator
- Static QR codes
- Smart QR codes
- QR downloads
- QR scan analytics
- Upgrade path into TubeLinkr/Smart Links

## Database Philosophy

Prefer generic platform tables.

Good:

- `users`
- `links`
- `placements`
- `events`
- `click_events`
- `subscriptions`
- `products`
- `profiles`
- `referrals`
- `proof_shares`

Avoid unnecessary product-specific tables unless required.

Avoid:

- `tube_users`
- `tube_clicks`
- `qr_users`
- `qr_clicks`

## Initial Build Plan

1. Create new GitHub repo: `inlinkr-platform`.
2. Clone/copy the current TubeLinkr codebase into the new repo.
3. Keep the original TubeLinkr repo untouched.
4. Create new Cloudflare Pages project: `inlinkr-platform`.
5. Connect `app.inlinkr.com` to the new Pages project.
6. Rebrand the app shell from TubeLinkr to InLinkr.
7. Add a Products area.
8. Add TubeLinkr as Product #1.
9. Keep the existing TubeLinkr experience working exactly as it does now.
10. Add QRLinkr as Product #2.
11. Reuse the same auth, database, analytics, billing, referrals, and redirect system.
12. Only after testing, point TubeLinkr login/signup flows to `app.inlinkr.com`.

## Do Not Do Yet

- Do not delete current TubeLinkr app.
- Do not remove current TubeLinkr Cloudflare Pages project.
- Do not remove old Stripe webhook.
- Do not remove old Google OAuth redirect URLs.
- Do not delete old workers until confirmed unused.
- Do not create separate QRLinkr auth.
- Do not create separate QRLinkr billing.
- Do not create separate QRLinkr database.
- Do not rename every infrastructure resource immediately.

## Audit Findings To Address

Before production launch, review and fix:

1. `placements.source_code` uniqueness conflict.
2. Obsolete `redirect-worker.js`.
3. Obsolete `wrangler-redirect.toml`.
4. Dead or misconfigured `functions/api/redirect.js`.
5. Migration history split between `migrations/` and root `cloudflare-*.sql`.
6. Referral logic duplicated between Worker and Pages Functions.
7. Verify referral reward columns exist in production D1.
8. Confirm IP hashing consistency.

## Migration Principle

Do not rewrite what works.

Clone the current working TubeLinkr build.

Rebrand the platform.

Keep TubeLinkr as the first product.

Add QRLinkr as the second product.

Only flip domains after the InLinkr build is tested.

## Success Criteria

InLinkr is ready when:

- A user can sign up at `app.inlinkr.com`.
- A user sees an InLinkr dashboard.
- TubeLinkr works inside the InLinkr dashboard.
- QRLinkr works inside the same dashboard.
- Smart Links redirect through `go.inlinkr.com`.
- Creator profiles work on `username.inlinkr.com`.
- Stripe checkout works.
- YouTube OAuth works.
- Referrals work.
- Traffic Proof works.
- Current TubeLinkr functionality is not broken.
