# Migration Plan

This document is the implementation migration plan. The canonical architecture and migration strategy are in [docs/02_PLATFORM_SCHEMA.md](../02_PLATFORM_SCHEMA.md). The roadmap is in [docs/03_ROADMAP.md](../03_ROADMAP.md).

## Overview

The migration from TubeLinkr to the InLinkr platform is additive and feature-flagged. Existing TubeLinkr production is not modified until the new platform is fully validated.

## Phases

### Phase 1 — Platform metadata (no risk)

1. Create `products`, `user_products`, `plans`, `profiles`, `subscriptions` tables.
2. Seed `products` (`tubelinkr`, `qrlinkr`) and `plans` for existing `free`, `pro`, `founder`.
3. Backfill `user_products` for every existing user: `tubelinkr` active.
4. Backfill `subscriptions` from existing `users` Stripe fields and `founder_access`.
5. Backfill `profiles` from existing `users` and `creator_hub_settings`.
6. Add `product_id` to `links`, `placements`, `click_events`, `proof_shares` with default `tubelinkr`.
7. Add `context_type` / `context_id` to `link_usages` and `placements` and treat `youtube_video_id` as the initial context.

### Phase 2 — Entitlement and billing abstraction

1. Create `user_entitlements` table.
2. Build an entitlement sync job that populates `user_entitlements` from `subscriptions`, `referral_rewards`, and `founder_access`.
3. Update `functions/api/entitlement-helper.js` to read `user_entitlements` first, with fallback to `users` columns.
4. Update `functions/api/stripe/webhook.js` to write `subscriptions` and trigger entitlement sync.
5. Keep `users` columns as a cache until the new flow is stable.

### Phase 3 — QRLinkr as product #2

1. Add `qrlinkr` product, plans, and features.
2. Add QRLinkr module: routes, dashboard, API namespace (`/api/products/qrlinkr/`).
3. Add QR code placement type and context type to `placements` and `link_contexts`.
4. Add `event_type='scan'` to the event pipeline.
5. Build QR creation and analytics dashboards that query `events` with `product_id='qrlinkr'`.
6. Enable QRLinkr for beta users via `feature_flags` and `user_products`.

### Phase 4 — Domain and brand cutover

1. Deploy `app.inlinkr.com` and `go.inlinkr.com`.
2. Point `tubelinkr.com` login/signup to `app.inlinkr.com`.
3. Keep `go.tubelinkr.com` as a fallback alias to `go.inlinkr.com` for existing links.
4. Add `username.inlinkr.com` creator profiles.
5. Update `functions/api/stripe/create-checkout-session.js` allowed origins to include `app.inlinkr.com`.

### Phase 5 — Cleanup and rename

1. Once `events` is fully populated and dashboards use it, stop writing to `click_events` and rename `click_events` to `events` (or keep `events` and drop `click_events`).
2. Rename `link_usages` → `link_contexts` and `proof_shares` → `traffic_proofs`.
3. Rename `youtube_connections` → `oauth_connections` and add providers as needed.
4. Remove `redirect-worker.js`, `wrangler-redirect.toml`, and `functions/api/redirect.js`.
5. Drop deprecated tables `user_referrals`, `referral_codes`, `magic_link_tokens` after confirming no data is needed.

## Database Migrations

- All migrations are additive until Phase 5.
- Each migration includes idempotent backfills.
- `feature_flags` gate new behavior.
- `stripe_webhook_events` provides idempotency.
- Rollback is safe because legacy tables and columns remain.

## Domain Cutover

- Final: `go.inlinkr.com` primary redirect; `go.tubelinkr.com` compatibility alias.
- `app.inlinkr.com` becomes production only after validation.
- `tubelinkr.com` continues to serve existing traffic.

## Rollback

- Disable feature flags.
- Revert to legacy tables and columns.
- Keep `click_events` and `link_usages` until final cutover.
- Rollback DNS only if `go.inlinkr.com` is not stable.

## Notes

- Do not rename databases during migration.
- Do not connect InLinkr development to `tubelinkr-prod-db`.
- Production rollout source of truth is migration files, not development data.
