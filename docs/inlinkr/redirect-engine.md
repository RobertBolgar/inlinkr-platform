# Redirect Engine

This document describes the InLinkr redirect engine implementation. The canonical architecture is in [docs/02_PLATFORM_SCHEMA.md](../02_PLATFORM_SCHEMA.md).

## Overview

The redirect engine is a shared Cloudflare Worker that resolves short URLs, records events, and routes to destinations. It runs on `go.inlinkr.com` in production and `go-dev.inlinkr.com` in development. TubeLinkr's `go.tubelinkr.com` remains live during validation.

## Resolution Order

1. `go.inlinkr.com/{public_code}` — global smart short link (resolve `links.public_code`)
2. `go.inlinkr.com/{public_code}/{placement}` — link with placement code
3. `go.inlinkr.com/{username}/{slug}` — legacy user/slug path
4. `go.inlinkr.com/{username}/{slug}/{placement}` — legacy with placement
5. Subdomain `username.inlinkr.com/{slug}` — branded creator hub
6. Subdomain `username.inlinkr.com/{slug}/{placement}` — branded placement

## Event Recording

On each redirect:

- Resolve link, placement, and `link_context`.
- Insert `events` row with `event_type='click'` and `product_id` from `links.product_id`.
- Set `source` from placement `source_code` or `direct`.
- Hash IP with SHA-256.
- Product-specific `postRedirect` hooks can run after recording.

## Subdomain Routing

Subdomain routing looks up `users.subdomain`, enforces `user_entitlements` (Pro/Founder), serves the React shell for the creator hub, and routes `/slug` and `/slug/placement` through the redirect handler.

## Worker Configuration

- Development Worker: `inlinkr-go-dev` on `go-dev.inlinkr.com`
- Production Worker target: `go.inlinkr.com`
- TubeLinkr compatibility: `go.tubelinkr.com` existing links must continue resolving.
- The Worker loads the product registry and applies product-specific resolution hooks.

## Notes

- The core engine is product-agnostic.
- Product-specific handlers can override resolution or post-redirect behavior.
- `go-dev.inlinkr.com` is used for all development links.
- Obsolete `redirect-worker.js`, `wrangler-redirect.toml`, and `functions/api/redirect.js` must be removed after the new Worker is stable.
