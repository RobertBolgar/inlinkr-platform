# Authentication

This document describes the InLinkr authentication implementation. The canonical architecture is in [docs/02_PLATFORM_SCHEMA.md](../02_PLATFORM_SCHEMA.md). The temporary development auth is in [DEVIN_FLOW.md](DEVIN_FLOW.md).

## Overview

InLinkr uses a single Clerk account for every product. The sign-in/sign-up flow lives at `app.inlinkr.com/login` and `app.inlinkr.com/signup`. Product marketing sites redirect to platform auth with `product` and `ref` referral parameters.

## Authentication Providers

- Clerk is the primary provider (JWT / RS256).
- OAuth providers (YouTube, Google, Spotify, etc.) are stored in `oauth_connections` (target rename of `youtube_connections`).
- OAuth state tokens are stored in `oauth_states` (target rename of `youtube_oauth_states`).

## User Sync

1. Frontend obtains Clerk JWT.
2. Frontend calls `POST /api/users/sync` with `clerk_user_id` and optional `referralCode`.
3. Backend verifies JWT via `CLERK_JWKS_URL`.
4. Backend fetches email and `first_name` from Clerk API.
5. Backend creates/updates `users` and `profiles` rows.
6. Backend ensures `user_products` contains the default product.
7. Backend captures referral if `referralCode` is provided.

## Session Management

- Clerk JWT session is the source of truth.
- Frontend reads `window.Clerk` global for authenticated requests.
- Backend validates Clerk JWT on protected routes.
- Dev auth bypasses the frontend only; backend JWT validation is unchanged.

## Permissions

- `user_entitlements` is the read source for effective access.
- Product feature permission keys are checked against `user_entitlements` and `plans`.
- Roles and scopes (free, pro, founder, admin) are derived from subscription and reward state.

## Notes

- Dev auth (`VITE_DEV_AUTH=true`) is temporary and forbidden for final launch.
- Backend endpoints that require Clerk JWT will still reject the mock dev-auth user.
- See [DEVIN_FLOW.md](DEVIN_FLOW.md) for the development-only bypass.
