# Billing

This document describes the InLinkr billing implementation. The canonical architecture is in [docs/02_PLATFORM_SCHEMA.md](../02_PLATFORM_SCHEMA.md).

## Overview

InLinkr uses one Stripe customer per user. Subscriptions can be per-product or platform-wide bundles. Billing is managed from the InLinkr Home, and products surface upgrade prompts inside their own workspaces.

## Subscriptions

- `subscriptions` table stores one row per product subscription or one row for a platform bundle (`product_id IS NULL`).
- `user_entitlements` is the read-optimized view of effective access.
- `subscriptions` status includes `active`, `canceled`, `past_due`, `trialing`, `paused`.

## Stripe Integration

- `users.stripe_customer_id` is the shared Stripe customer id.
- `plans.stripe_price_id` maps to Stripe price objects.
- `plans.features_json` defines feature/permission lists.
- `stripe_webhook_events` provides idempotency.

## Checkout Flow

- `POST /api/billing/checkout` creates a Stripe Checkout session with `product_id` and `plan_key`/`plan_id`.
- `POST /api/billing/portal` creates a Stripe Billing Portal session.
- `functions/api/stripe/webhook.js` processes events and updates `subscriptions` and `user_entitlements`.
- `create-checkout-session.js` and `create-billing-portal-session.js` generalize to accept `product_id`.

## Webhooks

- Webhook handler updates `subscriptions` and `user_entitlements`.
- Idempotency is enforced via `stripe_webhook_events`.
- Checkout success returns to the product workspace.

## Notes

- Referral rewards (`referral_rewards`) grant temporary Pro access and are evaluated before `users` sees `free`.
- Founder access (`founder_access`) is a permanent entitlement stored in `user_entitlements` with `is_founder = 1`.
- Downgrades keep data, links, and access continuous until the period ends.
