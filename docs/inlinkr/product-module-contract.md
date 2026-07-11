# Product Module Contract

This document describes how a product module registers with and operates on the InLinkr platform. The canonical product model is in [docs/01_PRODUCT_VISION.md](../01_PRODUCT_VISION.md) and the platform architecture is in [docs/02_PLATFORM_SCHEMA.md](../02_PLATFORM_SCHEMA.md).

## Overview

Each product (TubeLinkr, QRLinkr, future products) is an independent workspace that consumes platform services. The platform does not dictate product UX.

## Product Registration

A product is registered by:

1. Adding a `products` record.
2. Defining `plans` for the product.
3. Declaring feature permission keys.
4. Adding a route namespace `/dashboard/{key}` and `/api/products/{key}/`.
5. Building a dashboard component.
6. Wiring into shared events, redirects, and traffic proof.

## Dashboard Routes

Example TubeLinkr routes:

- `/dashboard/tubelinkr` — main dashboard
- `/dashboard/tubelinkr/links` — link management
- `/dashboard/tubelinkr/links/new` — create Smart Link
- `/dashboard/tubelinkr/video/:videoId` — video performance
- `/dashboard/tubelinkr/proofs` — traffic proof
- `/dashboard/tubelinkr/settings/hub` — creator hub

Example QRLinkr routes:

- `/dashboard/qrlinkr` — QR dashboard
- `/dashboard/qrlinkr/codes` — list QR codes
- `/dashboard/qrlinkr/codes/new` — create QR code
- `/dashboard/qrlinkr/analytics` — scan analytics

## API Namespace

Product-specific API endpoints live under `/api/products/{key}/`. Shared platform endpoints (`/api/users/*`, `/api/billing/*`, `/api/oauth/*`, `/api/redirect/*`) remain platform-owned.

## Feature Permissions

Examples:

- `youtube_single` — attach a single YouTube video
- `custom_subdomain` — branded creator hub
- `qr_static` — static QR codes
- `qr_dynamic` — smart/dynamic QR codes
- `advanced_analytics` — detailed analytics views

Permissions are checked by the platform entitlement helper against `user_entitlements` and `plans`.

## Plan Associations

A product can have its own plans:

- TubeLinkr Free, Pro, Founder.
- QRLinkr Free, Pro.
- Platform bundle (e.g., InLinkr Pro) grants access to multiple products.

Each plan row references `product_id` or is `NULL` for a platform bundle.

## Notes

- Products do not implement their own auth, billing, or analytics.
- The platform shell is neutral; product branding is preserved.
- New products are added without changing the platform core.
