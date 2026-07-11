# InLinkr Platform Architecture — PLATFORM_SCHEMA_V1

> **Status:** Architecture blueprint / design-only document  
> **Scope:** Defines the shared platform that powers TubeLinkr, QRLinkr, and future products.  
> **Constraint:** No code changes, no migrations, and no table renames are prescribed in this phase. Existing TubeLinkr behavior must remain intact.

---

## 1. Platform Overview

### 1.1 Core idea

InLinkr is the platform. **TubeLinkr** and **QRLinkr** are product modules that sit on top of it. Future products (PodcastLinkr, EventLinkr, AffiliateLinkr, etc.) will follow the same module pattern.

The platform provides the services that every product needs:

- **Identity** (`users`, `profiles`, `oauth_connections`)
- **Enablement** (`products`, `user_products`)
- **Billing** (`plans`, `subscriptions`, `user_entitlements`)
- **Redirect** (`links`, `placements`, `link_contexts`, `go.inlinkr.com` Worker)
- **Analytics** (`events` / `click_events`)
- **Referrals** (`referrals`, `referral_rewards`, `impact_events`)
- **Traffic Proof** (`traffic_proofs` / `proof_shares`)
- **Admin & Audit** (`activity_events`, `feature_flags`)

Product-specific concepts (e.g., YouTube video attachments, creator hubs, QR code campaigns) are stored in product extension tables or in generic `context_*` fields, never in duplicated platform tables.

### 1.2 Technology stack

- **Frontend:** React + TypeScript + Vite (Cloudflare Pages)
- **API:** Cloudflare Pages Functions (`/functions/api`)
- **Database:** Cloudflare D1 (SQLite)
- **Redirect:** Cloudflare Worker on `go.inlinkr.com`
- **Auth:** Clerk (JWT / RS256)
- **Billing:** Stripe (single customer per user, one webhook endpoint per environment)
- **Email:** Resend
- **Edge cache:** Cloudflare CDN + `youtube_metadata_cache` for product metadata

### 1.3 Domain model

A user signs in once at `app.inlinkr.com`. The platform creates one `users` row and a default `profiles` row. The user can enable one or more products (`user_products`). Each product has its own dashboard, routes, features, and permissions, but shares the same account, billing, redirect, and analytics infrastructure.

```
┌─────────────────────────────────────────────────────────────┐
│                         InLinkr Platform                    │
│  Auth │ Billing │ Redirect │ Analytics │ Referrals │ Admin   │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼────┐          ┌────▼────┐          ┌──────▼──────┐
   │TubeLinkr│          │QRLinkr  │          │FutureProduct│
   │ product │          │ product │          │  product    │
   └─────────┘          └─────────┘          └─────────────┘
```

---

## 2. Database Schema

This section describes the **target platform schema**. Where an existing TubeLinkr table already exists, the current name is noted in parentheses with the understanding that renames are deferred until after the architecture is validated.

### 2.1 `users`

**Purpose:** Canonical platform identity. One row per person. Contains only authentication, contact, and routing fields. Billing state and product access live in `subscriptions` and `user_entitlements`.

**Important fields:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | INTEGER PK | Internal platform user id. |
| `clerk_user_id` | TEXT | Auth provider id. Unique index. |
| `email` | TEXT | Contact email, unique. |
| `username` | TEXT | Global namespace (used in URLs, subdomains). |
| `first_name` | TEXT | Personalization. |
| `display_name` | TEXT | Public display name. |
| `subdomain` | TEXT | `username.inlinkr.com`. Unique. |
| `signup_ip_hash` | TEXT | Anti-abuse / referral fraud. |
| `referred_by` | TEXT | Referrer `users.id` at signup. |
| `referral_code` | TEXT | User's public referral code. |
| `is_active` | INTEGER | Soft delete flag. |
| `created_at` / `updated_at` | TEXT | ISO timestamps. |

**Relationships:**

- Has one `profiles` (default public profile).
- Has many `user_products`.
- Has many `subscriptions`.
- Has many `user_entitlements` (computed/cache of effective access).
- Has many `links`.
- Has many `referrals` as referrer or referred.

**Current state:** `users` already exists (`cloudflare-schema.sql`, `cloudflare-clerk-migration.sql`, etc.). It currently carries billing and entitlement fields (`plan`, `subscription_status`, `referral_reward_*`, etc.) that should move to `subscriptions`/`user_entitlements` over time.

---

### 2.2 `profiles`

**Purpose:** Public-facing creator profile. A single user may have one base profile, but product-specific presentation can be extended in product tables (e.g., `creator_hub_settings` for TubeLinkr).

**Important fields:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | INTEGER PK | |
| `user_id` | INTEGER FK | One base profile per user. |
| `slug` | TEXT | Public path, defaults to `username`. Unique. |
| `display_name` | TEXT | Public name. |
| `bio` | TEXT | |
| `tagline` | TEXT | |
| `avatar_url` | TEXT | |
| `is_public` | INTEGER | |
| `created_at` / `updated_at` | TEXT | |

**Relationships:** Belongs to `users`. Product-specific profiles may extend this.

**Current state:** Does not exist; profile data is split between `users` and `creator_hub_settings`. The base `profiles` table should be created.

---

### 2.3 `products`

**Purpose:** Catalog of products available on the platform.

**Important fields:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | INTEGER PK | |
| `key` | TEXT | `tubelinkr`, `qrlinkr`, etc. Unique. |
| `name` | TEXT | Display name. |
| `description` | TEXT | |
| `default_product` | INTEGER | One product may be the default on signup. |
| `is_active` | INTEGER | |
| `created_at` / `updated_at` | TEXT | |

**Relationships:** Has many `plans`, `user_products`, `links`, `placements`, `events`, `traffic_proofs`.

---

### 2.4 `user_products`

**Purpose:** Toggles which products a user has enabled and their lifecycle state.

**Important fields:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | INTEGER PK | |
| `user_id` | INTEGER FK | |
| `product_id` | INTEGER FK | |
| `status` | TEXT | `active`, `pending`, `paused`, `disabled`. |
| `first_enabled_at` | TEXT | |
| `created_at` / `updated_at` | TEXT | |

**Relationships:** Composite unique `(user_id, product_id)`.

**Current state:** Does not exist. Existing users implicitly have `tubelinkr` enabled.

---

### 2.5 `plans`

**Purpose:** Pricing plans for each product and for the platform bundle. Decouples hard-coded plan names from code.

**Important fields:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | INTEGER PK | |
| `product_id` | INTEGER FK | Nullable for platform-wide bundles. |
| `key` | TEXT | `free`, `pro`, `pro_plus`, `founder`, etc. |
| `name` | TEXT | |
| `stripe_price_id` | TEXT | Live Stripe price id. |
| `interval` | TEXT | `monthly`, `yearly`, `one_time`. |
| `features_json` | TEXT | JSON feature/permission list. |
| `is_active` | INTEGER | |

**Relationships:** Belongs to `products` (nullable). Referenced by `subscriptions`.

**Current state:** Does not exist. Plans are currently hard-coded in `src/lib/plan.ts` and `functions/api/entitlement-helper.js`.

---

### 2.6 `subscriptions`

**Purpose:** Source of truth for billing subscriptions. Supports one Stripe customer with multiple product subscriptions or a single platform bundle.

**Important fields:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | INTEGER PK | |
| `user_id` | INTEGER FK | |
| `product_id` | INTEGER FK | Nullable: null = platform bundle. |
| `plan_id` | INTEGER FK | FK to `plans`. |
| `stripe_customer_id` | TEXT | Shared across all user subs. |
| `stripe_subscription_id` | TEXT | |
| `stripe_price_id` | TEXT | |
| `status` | TEXT | `active`, `canceled`, `past_due`, `trialing`, `paused`. |
| `current_period_start` | TEXT | |
| `current_period_end` | TEXT | |
| `cancel_at_period_end` | INTEGER | |
| `metadata_json` | TEXT | |
| `created_at` / `updated_at` | TEXT | |

**Relationships:** Belongs to `users` and `products` (optional). Composite unique on `(user_id, product_id)` where product_id is not null; platform bundle can be one row with `product_id IS NULL`.

**Current state:** `users` currently stores `stripe_customer_id`, `stripe_subscription_id`, `plan`, `subscription_status`, `subscription_current_period_end`. `stripe_webhook_events` is used for idempotency. A dedicated `subscriptions` table should be added.

---

### 2.7 `user_entitlements`

**Purpose:** Fast, product-scoped access decisions. This is a computed/cache table; it is not the billing source of truth. It merges Stripe subscriptions, referral rewards, founder access, and future promos.

**Important fields:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | INTEGER PK | |
| `user_id` | INTEGER FK | |
| `product_id` | INTEGER FK | Nullable for platform-wide entitlement. |
| `source` | TEXT | `stripe`, `referral`, `founder`, `promo`. |
| `plan` | TEXT | Effective plan key. |
| `status` | TEXT | `active`, `expired`, `scheduled`. |
| `starts_at` | TEXT | |
| `expires_at` | TEXT | |
| `is_founder` | INTEGER | Permanent override. |
| `created_at` / `updated_at` | TEXT | |

**Relationships:** Belongs to `users` and `products` (optional).

**Current state:** `users` fields (`plan`, `subscription_status`, `referral_reward_*`, `referral_3_unlocked`, `referral_10_unlocked`, `founder_access` table) serve this role today. They should be migrated here.

---

### 2.8 `links`

**Purpose:** The generic link asset. Independent of product. The same link can be used by TubeLinkr and QRLinkr without duplication.

**Important fields:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | INTEGER PK | |
| `user_id` | INTEGER FK | Owner. |
| `product_id` | INTEGER FK | Product that created it (default `tubelinkr`). |
| `slug` | TEXT | User-defined or generated. Unique per user. |
| `public_code` | TEXT | Global short code for `go.inlinkr.com/{code}`. Unique. |
| `original_url` | TEXT | Destination URL. |
| `title` | TEXT | |
| `subtitle` | TEXT | |
| `is_active` | INTEGER | |
| `is_system` | INTEGER | Does not count toward user limits. |
| `placement_count` | INTEGER | Cached count of placements. |
| `created_at` / `updated_at` | TEXT | |

**Relationships:** Has many `link_contexts`, `placements`, `events`, `traffic_proofs`.

**Current state:** `links` exists. It has product-specific columns (`video_id`, `video_title`, `video_thumbnail`, `placement_count`) that should move to `link_contexts` or a product extension table.

---

### 2.9 `link_contexts` (target rename of `link_usages`)

**Purpose:** Reusable usage of a link in a specific product context. A context is anything that can host a link: a YouTube video, a QR campaign, a podcast episode, an event page.

**Important fields:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | INTEGER PK | |
| `link_id` | INTEGER FK | |
| `user_id` | INTEGER FK | Denormalized for fast filtering. |
| `product_id` | INTEGER FK | |
| `context_type` | TEXT | `youtube_video`, `qr_campaign`, `podcast_episode`, etc. |
| `context_id` | TEXT | External id (e.g., video id). |
| `name` | TEXT | Human-readable context name. |
| `source_code` | TEXT | Tracking code for this context. |
| `public_code` | TEXT | Short public code if different from source. |
| `destination_url_snapshot` | TEXT | Frozen destination at creation. |
| `title_snapshot` | TEXT | Frozen title. |
| `is_active` | INTEGER | |
| `created_at` / `updated_at` | TEXT | |

**Relationships:** Belongs to `links`, `users`, `products`. Has many `placements` and `events`.

**Current state:** `link_usages` exists with `youtube_video_id`, `placement_type`, `placement_name`, etc. It should be generalized by adding `product_id`, `context_type`, `context_id`, and renaming later. The `youtube_video_id` column can be treated as `context_type = 'youtube_video'` / `context_id = youtube_video_id`.

---

### 2.10 `placements`

**Purpose:** A tracking label for a link in a context. Examples: `description`, `pinned`, `bio`, `short`, `qr_code`. Placements produce the `source` string stored in analytics events.

**Important fields:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | INTEGER PK | |
| `link_id` | INTEGER FK | |
| `link_context_id` | INTEGER FK | Target rename of `link_usage_id`. |
| `product_id` | INTEGER FK | |
| `name` | TEXT | e.g. "Pinned Comment". |
| `type` | TEXT | `description`, `pinned`, `bio`, `short`, `video`, `qr_code`, `other`. |
| `source_code` | TEXT | Unique within `link_id` (or `link_context_id`). |
| `public_code` | TEXT | Used in `go.inlinkr.com/{public_code}/{placement}`. |
| `context_type` | TEXT | Optional: `youtube_video`, `qr_static`, etc. |
| `context_id` | TEXT | Optional external id. |
| `created_at` / `updated_at` | TEXT | |

**Relationships:** Belongs to `links`, `link_contexts`, `products`. Has many `events`.

**Current state:** `placements` exists with `youtube_video_id`, `link_usage_id`, `source_code`, `public_code`. It should add `product_id`, `context_type`, `context_id`. `source_code` uniqueness should remain per `link_id`.

---

### 2.11 `events` (target evolution of `click_events`)

**Purpose:** Unified, product-agnostic event ledger. `click` is one event type. Future event types include `scan`, `view`, `conversion`, `share`, `hub_visit`, `proof_view`.

**Important fields:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | INTEGER PK | |
| `event_type` | TEXT | `click`, `scan`, `view`, `conversion`, `share`, etc. |
| `product_id` | INTEGER FK | |
| `user_id` | INTEGER FK | Link owner. |
| `link_id` | INTEGER FK | Nullable. |
| `link_context_id` | INTEGER FK | Nullable. |
| `placement_id` | INTEGER FK | Nullable. |
| `traffic_proof_id` | INTEGER FK | Nullable. |
| `timestamp` | TEXT | ISO. |
| `referrer` | TEXT | |
| `user_agent` | TEXT | |
| `ip_hash` | TEXT | SHA-256 of IP. |
| `source` | TEXT | Placement `source_code` or `direct`. |
| `properties_json` | TEXT | Flexible metadata per product. |
| `session_id` | TEXT | Future grouping key. |

**Relationships:** Belongs to `users`, `products`, `links`, `link_contexts`, `placements`, `traffic_proofs`.

**Current state:** `click_events` exists. It should be extended with `event_type`, `product_id`, `link_context_id`, `placement_id`, `traffic_proof_id`, and `properties_json`. A future migration will rename `click_events` to `events` and backfill `event_type = 'click'`.

---

### 2.12 `referrals`

**Purpose:** Platform-wide referral relationship between two users.

**Important fields:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | TEXT PK | UUID. |
| `referrer_user_id` | TEXT FK | |
| `referred_user_id` | TEXT FK | Unique. |
| `referral_code_used` | TEXT | |
| `capture_source` | TEXT | `signup`, `post_signup`. |
| `is_qualified` | INTEGER | |
| `qualified_at` | TEXT | |
| `first_qualified_at` | TEXT | |
| `first_paid_at` | TEXT | |
| `first_paid_plan` | TEXT | |
| `latest_paid_at` | TEXT | |
| `latest_paid_plan` | TEXT | |
| `paid_conversion_count` | INTEGER | |
| `is_paid_conversion` | INTEGER | |
| `is_pro_conversion` | INTEGER | |
| `is_founder_conversion` | INTEGER | |
| `attribution_status` | TEXT | `pending`, `qualified`, `paid`, `lapsed`. |
| `metadata_json` | TEXT | |

**Relationships:** Belongs to `users` (both sides).

**Current state:** `referrals` exists and is already product-agnostic. Keep as-is.

---

### 2.13 `referral_rewards`

**Purpose:** Ledger of rewards granted to referrers.

**Important fields:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | TEXT PK | |
| `user_id` | TEXT FK | |
| `milestone_count` | INTEGER | e.g., 3 or 10. |
| `reward_plan` | TEXT | |
| `reward_days` | INTEGER | |
| `granted_at` | TEXT | |
| `expires_at` | TEXT | |

**Relationships:** Belongs to `users`.

**Current state:** `referral_rewards` exists. Keep as-is.

---

### 2.14 `traffic_proofs` (target rename of `proof_shares`)

**Purpose:** Public, shareable proof of traffic or impact. Can be used by any product (TubeLinkr video proof, QRLinkr scan proof, etc.).

**Important fields:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | INTEGER PK | |
| `user_id` | INTEGER FK | |
| `product_id` | INTEGER FK | |
| `link_id` | INTEGER FK | Nullable. |
| `link_context_id` | INTEGER FK | Nullable. |
| `public_token` | TEXT | Unique. |
| `title` | TEXT | |
| `is_enabled` | INTEGER | |
| `context_type` | TEXT | `youtube_video`, `qr_code`, etc. |
| `context_id` | TEXT | External id. |
| `snapshot_*` | various | Frozen metrics: clicks, ctr, views, link_count, etc. |
| `snapshot_data_json` | TEXT | Flexible snapshot payload. |
| `human_insight` | TEXT | |
| `proof_group_key` | TEXT | For grouping/clean disabling. |
| `created_at` / `last_viewed_at` | TEXT | |

**Relationships:** Belongs to `users`, `products`, `links`, `link_contexts`.

**Current state:** `proof_shares` exists. It should add `product_id`, `context_type`, `context_id`, and `link_context_id`. Future rename to `traffic_proofs`.

---

### 2.15 `traffic_proof_events` (target rename of `proof_share_events`)

**Purpose:** Engagement events on public proof pages (views, shares, etc.).

**Important fields:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | INTEGER PK | |
| `traffic_proof_id` | INTEGER FK | |
| `event_type` | TEXT | `view`, `share`, `copy`, etc. |
| `created_at` | TEXT | |
| `referrer` | TEXT | |
| `user_agent` | TEXT | |
| `ip_hash` | TEXT | |

**Current state:** `proof_share_events` exists. Should be generalized with `event_type` and renamed later.

---

### 2.16 `feature_flags`

**Purpose:** Runtime feature toggles.

**Important fields:**

| Field | Type | Notes |
|-------|------|-------|
| `key` | TEXT PK | e.g., `referrals_enabled`, `qrlinkr_enabled`. |
| `enabled` | INTEGER | |
| `value` | TEXT | Optional JSON string. |
| `updated_at` | TEXT | |

**Current state:** `feature_flags` exists. Keep as-is and add product-specific flags.

---

### 2.17 `activity_events`

**Purpose:** Platform audit log for admin and user activity.

**Important fields:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | TEXT PK | |
| `event_type` | TEXT | |
| `actor_user_id` | INTEGER FK | |
| `target_user_id` | INTEGER FK | |
| `event_title` | TEXT | |
| `event_description` | TEXT | |
| `metadata_json` | TEXT | |
| `severity` | TEXT | `info`, `warning`, `critical`. |
| `visibility_scope` | TEXT | `owner`, `admin`, `billing`. |
| `created_at` | TEXT | |

**Current state:** `activity_events` exists. Keep as-is.

---

### 2.18 `oauth_connections` (target rename of `youtube_connections`)

**Purpose:** Store OAuth tokens for any provider, not just YouTube.

**Important fields:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | INTEGER PK | |
| `user_id` | INTEGER FK | |
| `provider` | TEXT | `youtube`, `google`, `spotify`, `apple`, etc. |
| `provider_account_id` | TEXT | |
| `access_token` | TEXT | Encrypted at rest in future. |
| `refresh_token` | TEXT | |
| `token_expires_at` | TEXT | |
| `connected_at` | TEXT | |
| `is_active` | INTEGER | |

**Current state:** `youtube_connections` exists. Should add `provider` column and rename later.

---

### 2.19 `oauth_states` (target rename of `youtube_oauth_states`)

**Purpose:** Short-lived OAuth state tokens.

**Important fields:**

| Field | Type | Notes |
|-------|------|-------|
| `state` | TEXT PK | |
| `user_id` | INTEGER FK | |
| `provider` | TEXT | |
| `created_at` | TEXT | |
| `expires_at` | TEXT | |

**Current state:** `youtube_oauth_states` exists. Should add `provider` and rename later.

---

### 2.20 `metadata_cache` (target evolution of `youtube_metadata_cache`)

**Purpose:** Cache external metadata payloads (video, podcast, event, etc.).

**Important fields:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | TEXT PK | |
| `cache_key` | TEXT | |
| `cache_type` | TEXT | `youtube_video`, `podcast_feed`, etc. |
| `payload_json` | TEXT | |
| `expires_at` | TEXT | |

**Current state:** `youtube_metadata_cache` exists. Should be generalized or wrapped with a `cache_type` column.

---

### 2.21 `impact_events` / `impact_stats` (target rename of `creator_impact_*`)

**Purpose:** Append-only impact ledger and rollup for referrals, conversions, and future ambassador/badges.

**Important fields:**

- `impact_events`: `id`, `user_id`, `referred_user_id`, `referral_id`, `event_type`, `plan`, `event_data_json`, `event_source`, `is_backfill`, `created_at`.
- `impact_stats`: `user_id`, `total_referrals`, `qualified_referrals`, `paid_referrals`, `pro_referrals`, `founder_referrals`, `rewards_granted`, `ambassador_status`, `badges_json`, `updated_at`.

**Current state:** `creator_impact_events` and `creator_impact_stats` exist. Keep; rename later to remove the `creator_` prefix.

---

## 3. Existing Tables

### 3.1 Keep as-is

| Table | Reason |
|-------|--------|
| `users` | Core identity. Keep, but gradually move billing/entitlement columns out. |
| `referrals` | Already product-agnostic. Drives all referral logic. |
| `referral_rewards` | Reward ledger; platform-wide. |
| `activity_events` | Platform audit log. |
| `feature_flags` | Runtime toggles. |
| `stripe_webhook_events` | Idempotency for Stripe webhooks. |
| `creator_impact_events` / `creator_impact_stats` | Impact ledger; keep, rename later. |

### 3.2 Modify

| Table | Changes | Reason |
|-------|---------|--------|
| `links` | Add `product_id` (FK, default `tubelinkr`), `destination_url` alias, `metadata_json`. Move `video_id`, `video_title`, `video_thumbnail` to `link_contexts` or product extension. | Product-agnostic link asset. |
| `click_events` | Add `event_type`, `product_id`, `link_context_id`, `placement_id`, `traffic_proof_id`, `properties_json`. Future rename to `events`. | Unified analytics pipeline. |
| `placements` | Add `product_id`, `context_type`, `context_id`, `link_context_id`. Keep `youtube_video_id` and `link_usage_id` as aliases during migration. | Generic tracking placements across products. |
| `link_usages` | Add `product_id`, `context_type`, `context_id`. Future rename to `link_contexts`. Treat `youtube_video_id` as `context_type='youtube_video'`. | Reusable link contexts for any product. |
| `proof_shares` | Add `product_id`, `context_type`, `context_id`, `link_context_id`. Future rename to `traffic_proofs`. | Generic public proof. |
| `proof_share_events` | Add `event_type`. Future rename to `traffic_proof_events`. | Generic proof engagement. |
| `youtube_connections` | Add `provider` column. Future rename to `oauth_connections`. | Support multiple OAuth providers. |
| `youtube_oauth_states` | Add `provider` column. Future rename to `oauth_states`. | Generic OAuth flow. |
| `youtube_metadata_cache` | Add `cache_type` or generalize. | Cache external metadata for any product. |
| `analytics_video_exclusions` | Add `product_id` (default `tubelinkr`) and `context_type`/`context_id` if needed. | Product-agnostic analytics exclusions. |

### 3.3 Merge

| From | Into | Reason |
|------|------|--------|
| `users.plan`, `users.subscription_status`, `users.subscription_current_period_end`, `users.referral_reward_*`, `founder_access` | `subscriptions` + `user_entitlements` | Centralize billing and access decisions. `users` becomes a read cache only. |
| `referral_codes` + `user_referrals` | `users.referral_code` + `referrals` | `referrals` and `referral-helper.js` already use `users.referral_code`. The old `referral_codes` and `user_referrals` tables are unused. |

### 3.4 Deprecate

| Table | Reason |
|-------|--------|
| `magic_link_tokens` | Clerk is the authentication provider. Magic link logic is legacy. |
| `referral_codes` | Replaced by `users.referral_code` and `referrals`. |
| `user_referrals` | Replaced by `referrals`. No code references found. |
| `redirect-worker.js` / `wrangler-redirect.toml` | Obsolete; `worker.js` on `go.tubelinkr.com` is the redirect engine. |
| `functions/api/redirect.js` | Dead catch-all; legacy redirect logic retired. |

### 3.5 Create new

| Table | Purpose |
|-------|---------|
| `products` | Product catalog. |
| `user_products` | Which user has which product enabled. |
| `plans` | Product and bundle pricing. |
| `subscriptions` | Stripe subscription line items. |
| `user_entitlements` | Computed product access. |
| `profiles` | Base public profile. |

---

## 4. Product Module Architecture

### 4.1 Module contract

Each product is a module registered in the platform. It declares:

- **Key:** `tubelinkr`, `qrlinkr`, etc.
- **Name & icon:** For the product switcher.
- **Default route:** `/dashboard/tubelinkr`, `/dashboard/qrlinkr`.
- **Plans:** Which `plans` rows it owns.
- **Features:** Permission keys it checks (e.g., `youtube_single`, `custom_subdomain`, `qr_static`, `qr_dynamic`).
- **Permissions:** `free`, `pro`, `pro_plus`, `founder` gates.
- **API namespace:** `/api/products/tubelinkr/...`, `/api/products/qrlinkr/...`.
- **Dashboard component:** Product-specific React route.
- **Redirect handlers:** Any special redirect logic for that product.

### 4.2 TubeLinkr

- **Routes:**
  - `/dashboard/tubelinkr` — main dashboard
  - `/dashboard/tubelinkr/links` — link management
  - `/dashboard/tubelinkr/links/new` — create Smart Link
  - `/dashboard/tubelinkr/video/:videoId` — video performance
  - `/dashboard/tubelinkr/proofs` — traffic proof management
  - `/dashboard/tubelinkr/settings/hub` — creator hub
- **Dashboard:** YouTube-centric analytics, link creation with video attachment, placement management, traffic proof, creator hub.
- **Features:**
  - Smart Links with `go.inlinkr.com/{public_code}`
  - YouTube OAuth and video metadata
  - Placements: `description`, `pinned`, `bio`, `short`, `video`, `other`
  - Creator Hub (public subdomain hub)
  - Traffic Proof (public proof pages)
  - QR placement integration (a QR code is a `qr_code` placement)
- **Permissions:**
  - Free: limited links, auto-generated slugs, basic analytics, no custom subdomain.
  - Pro: custom slugs, branded subdomain hub, unlimited proofs, advanced analytics.
  - Founder: permanent, unlimited everything.

### 4.3 QRLinkr

- **Routes:**
  - `/dashboard/qrlinkr` — QR dashboard
  - `/dashboard/qrlinkr/codes` — list QR codes
  - `/dashboard/qrlinkr/codes/new` — create QR code
  - `/dashboard/qrlinkr/analytics` — scan analytics
- **Dashboard:** QR creation, download, scan analytics, link to Smart Links.
- **Features:**
  - Static QR codes (destination URL)
  - Smart QR codes (link to an existing InLinkr link)
  - QR download (PNG/SVG)
  - QR scan tracking (stored as `events` with `event_type='scan'` and `source='qr_code'`)
  - Upgrade path into Smart Links / TubeLinkr
- **Permissions:**
  - Free: limited number of QR codes, static only.
  - Pro: dynamic/smart QR codes, branded QR codes, scan analytics.
  - Platform bundle: TubeLinkr + QRLinkr combined.

### 4.4 Future products

Future products implement the same contract:

- Register in `products`.
- Add product-specific routes under `/dashboard/{product_key}`.
- Add product-specific API namespace `/api/products/{product_key}/`.
- Add product-specific `link_context` types and `placement` types.
- Reuse `links`, `placements`, `events`, `subscriptions`, `referrals`.
- Product-specific public pages can be served under `username.inlinkr.com/{product_key}` or a product subdomain.

### 4.5 Product registry pattern

A platform-level product registry (initially a static config file, later a `products` table) maps product keys to:

- Dashboard routes
- Navigation items
- Feature flags
- Plan associations
- Redirect handlers
- Analytics queries

This keeps the platform shell generic and product-specific logic isolated.

---

## 5. Authentication

### 5.1 One account, every product

A single Clerk account powers every product. The sign-in/sign-up flow lives at `app.inlinkr.com/login` and `app.inlinkr.com/signup`. Product marketing sites (`tubelinkr.com`, `qrlinkr.com`) send users to the platform auth flow with a `product` parameter and `ref` referral code.

### 5.2 User sync flow

1. Frontend obtains Clerk JWT.
2. Frontend calls `POST /api/users/sync` with `clerk_user_id` and optional `referralCode`.
3. Backend verifies JWT via `CLERK_JWKS_URL` (`functions/api/auth-helper.js`).
4. Backend fetches email and `first_name` from Clerk API.
5. Backend creates/updates `users` row and `profiles` row.
6. Backend ensures `user_products` contains the default product (`tubelinkr` for existing users, configured default for new users).
7. Backend captures referral if `referralCode` is provided and `referrals` is enabled.

### 5.3 Product-specific onboarding

After auth, the platform redirects to `/dashboard` (or `?product=qrlinkr`). The platform shell reads `user_products` and renders the product switcher. If the user does not have the requested product enabled, the platform creates a `user_products` row with `status='pending'` and shows the onboarding flow.

### 5.4 OAuth connections

OAuth providers (YouTube, Google, Spotify, etc.) are stored in `oauth_connections` (target rename of `youtube_connections`). Each connection has `provider` and `provider_account_id`. Product modules request access to their required providers through a platform OAuth service (`/api/oauth/start`, `/api/oauth/callback`).

### 5.5 Dev auth

The existing `src/lib/auth/dev.ts` dev-auth bypass remains for local development but must never be enabled in production.

---

## 6. Billing

### 6.1 One Stripe customer

Every `users` row maps to exactly one Stripe Customer. `stripe_customer_id` remains on `users` because the customer is a user-level identity, not a product-level one.

### 6.2 Plans and subscriptions

- `plans` contains product-specific prices and platform bundle prices.
- A `subscriptions` row is created for every product the user subscribes to.
- A `subscriptions` row with `product_id IS NULL` represents a platform bundle.
- `user_entitlements` is the read-optimized view of effective access.

### 6.3 Product-specific subscriptions

When a user subscribes to TubeLinkr Pro, the checkout session creates a `subscriptions` row with `product_id = tubelinkr` and `plan_id` pointing to the TubeLinkr Pro plan. The same user can separately subscribe to QRLinkr Pro.

### 6.4 Platform bundle

A platform bundle is a Stripe subscription with a single `subscriptions` row where `product_id IS NULL` and `plan_id` points to a bundle plan. The `user_entitlements` table expands this into product-level entitlements for all products included in the bundle.

### 6.5 Checkout and portal

- `POST /api/billing/checkout` creates a Stripe Checkout session. It accepts `product_id` and `plan_key` (or `plan_id`).
- `POST /api/billing/portal` creates a Stripe Billing Portal session.
- Webhook `functions/api/stripe/webhook.js` processes events and updates `subscriptions` and `user_entitlements`.
- The existing `functions/api/stripe/create-checkout-session.js` and `create-billing-portal-session.js` logic should be generalized to accept `product_id`.

### 6.6 Downgrades and referral rewards

- If a Stripe subscription cancels at period end, `subscriptions.status` becomes `canceled` and `cancel_at_period_end` is set.
- `user_entitlements` recomputes the effective plan after every webhook.
- Referral rewards (`referral_rewards`) continue to grant temporary Pro access and are evaluated before `users` sees `free`.
- Founder access (`founder_access`) is a permanent entitlement stored in `user_entitlements` with `is_founder = 1`.

### 6.7 Invoices and idempotency

- `stripe_webhook_events` stays for idempotency.
- A future `invoices` table can be added to cache Stripe invoice history per subscription.

---

## 7. Redirect Engine

### 7.1 `go.inlinkr.com` Worker

The redirect engine runs on `go.inlinkr.com` (`worker.js`). It is product-agnostic by default: it resolves a short URL and records an event.

### 7.2 Resolution order

1. `go.inlinkr.com/{public_code}` — global smart short link. Resolve `links.public_code`.
2. `go.inlinkr.com/{public_code}/{placement}` — link with a placement code.
3. `go.inlinkr.com/{username}/{slug}` — legacy user/slug path.
4. `go.inlinkr.com/{username}/{slug}/{placement}` — legacy with placement.
5. Subdomain `username.inlinkr.com/{slug}` — branded creator hub (requires Pro/Founder).
6. Subdomain `username.inlinkr.com/{slug}/{placement}` — branded placement link.

### 7.3 Event recording

On every redirect:

- Resolve the link and optional placement/link_context.
- Insert a row into `events` with `event_type='click'` and `product_id` from `links.product_id`.
- If a placement is found, `source` is the placement's `source_code`.
- IP is hashed with SHA-256 (`hashIpAddress` in `worker.js`).
- Product-specific redirect handlers can be registered in the Worker to apply custom rules (e.g., QR scan behavior, custom domains). The default behavior is generic.

### 7.4 Product-specific rules

The Worker should load a product registry. For each product:

- `resolve(context)` — optionally override URL resolution.
- `postRedirect(context, event)` — optionally run product logic after recording (e.g., TubeLinkr first-meaningful-click email, QRLinkr scan counter).

This keeps the core redirect engine generic while allowing product hooks.

### 7.5 Subdomain routing

Subdomain routing (`username.inlinkr.com`) first looks up `users.subdomain`, then enforces `user_entitlements` (Pro/Founder). It serves the React app shell for the creator hub and routes `/slug` and `/slug/placement` through the redirect handler.

### 7.6 Legacy redirect cleanup

- `redirect-worker.js` and `wrangler-redirect.toml` are obsolete and should be removed after the new `go.inlinkr.com` Worker is confirmed stable.
- `functions/api/redirect.js` is dead and should be removed.

---

## 8. Analytics

### 8.1 One event pipeline

All products write to the same `events` table. The platform provides a `recordEvent` helper that validates the event and writes it.

### 8.2 Event types

| Event type | Product | Description |
|------------|---------|-------------|
| `click` | All | Link redirect. |
| `scan` | QRLinkr | QR code scan. |
| `view` | All | Page/view event. |
| `proof_view` | All | Public proof page view. |
| `share` | All | Share/copy action. |
| `conversion` | All | Billing conversion. |

### 8.3 Query model

- Product dashboards query `events` filtered by `product_id` and `user_id`.
- Time-series aggregation uses `timestamp` and `source`.
- Video-level analytics use `link_context_id` to scope clicks to a specific `youtube_video` context.
- QR analytics use `placements` with `type='qr_code'` and `events` with `source='qr_code'`.
- `analytics_video_exclusions` should be renamed or generalized to `analytics_exclusions` and support `context_type`/`context_id`.

### 8.4 Privacy and IP hashing

- IP addresses are never stored in plain text. Use SHA-256 (`hashIpAddress`).
- Keep `ip_hash` only for anti-abuse and referral fraud detection.
- User agent and referrer can be stored for analytics; PII must be stripped.

### 8.5 Migration from `click_events`

- Keep `click_events` as the legacy table.
- Add `event_type` and `product_id` columns and write new events to both `click_events` and `events` during the transition.
- Once dashboards are migrated, backfill `events` and stop writing to `click_events`.

---

## 9. Migration Strategy

### 9.1 Principles

1. **No big bang.** All changes are additive or behind feature flags.
2. **Preserve existing behavior.** TubeLinkr continues to work exactly as it does today.
3. **No renames in phase 1.** Existing table names stay the same until the platform is validated.
4. **One environment at a time.** Local → preview → production, with `feature_flags` to gate.
5. **Backfill safely.** Every migration that adds new columns must include idempotent backfills.

### 9.2 Phase 1 — Platform metadata (no risk)

1. Create `products`, `user_products`, `plans`, `profiles`, `subscriptions` tables.
2. Seed `products` (`tubelinkr`, `qrlinkr`) and `plans` for existing `free`, `pro`, `founder`.
3. Backfill `user_products` for every existing user: `tubelinkr` active.
4. Backfill `subscriptions` from existing `users` Stripe fields and `founder_access`.
5. Backfill `profiles` from existing `users` and `creator_hub_settings`.
6. Add `product_id` to `links`, `placements`, `click_events`, `proof_shares` with default `tubelinkr`.
7. Add `context_type` / `context_id` to `link_usages` and `placements` and treat `youtube_video_id` as the initial context.

### 9.3 Phase 2 — Entitlement and billing abstraction

1. Create `user_entitlements` table.
2. Build an entitlement sync job that populates `user_entitlements` from `subscriptions`, `referral_rewards`, and `founder_access`.
3. Update `functions/api/entitlement-helper.js` to read `user_entitlements` first, with fallback to `users` columns.
4. Update `functions/api/stripe/webhook.js` to write `subscriptions` and trigger entitlement sync.
5. Keep `users` columns as a cache until the new flow is stable.

### 9.4 Phase 3 — QRLinkr as product #2

1. Add `qrlinkr` product, plans, and features.
2. Add QRLinkr module: routes, dashboard, API namespace (`/api/products/qrlinkr/`).
3. Add QR code placement type and context type to `placements` and `link_contexts`.
4. Add `event_type='scan'` to the event pipeline.
5. Build QR creation and analytics dashboards that query `events` with `product_id='qrlinkr'`.
6. Enable QRLinkr for beta users via `feature_flags` and `user_products`.

### 9.5 Phase 4 — Domain and brand cutover

1. Deploy `app.inlinkr.com` and `go.inlinkr.com`.
2. Point `tubelinkr.com` login/signup to `app.inlinkr.com`.
3. Keep `go.tubelinkr.com` as a fallback alias to `go.inlinkr.com` for existing links.
4. Add `username.inlinkr.com` creator profiles.
5. Update `functions/api/stripe/create-checkout-session.js` allowed origins to include `app.inlinkr.com`.

### 9.6 Phase 5 — Cleanup and rename

1. Once `events` is fully populated and dashboards use it, stop writing to `click_events` and rename `click_events` to `events` (or keep `events` and drop `click_events`).
2. Rename `link_usages` → `link_contexts` and `proof_shares` → `traffic_proofs`.
3. Rename `youtube_connections` → `oauth_connections` and add providers as needed.
4. Remove `redirect-worker.js`, `wrangler-redirect.toml`, and `functions/api/redirect.js`.
5. Drop deprecated tables `user_referrals`, `referral_codes`, `magic_link_tokens` after confirming no data is needed.

### 9.7 Rollback and safety

- Every additive migration must be reversible (or at least safe to leave in place).
- Feature flags (`feature_flags`) gate all new product behavior.
- Stripe webhook endpoint is idempotent via `stripe_webhook_events`.
- Existing TubeLinkr Pages project and D1 database remain untouched until `app.inlinkr.com` is fully validated.

---

## 10. Current Environment

This section describes the active environments and the current migration sandbox. The source of truth for the latest environment details is [docs/00_CURRENT_STATE.md](00_CURRENT_STATE.md).

### TubeLinkr Production

| Resource | Value | Notes |
|----------|-------|-------|
| Repository | `RobertBolgar/tubelinkr` | Original production repository. Must remain untouched. |
| Marketing/app domain | `tubelinkr.com` | Live production traffic. |
| Pages project | `tubelinkrgit` | Original Cloudflare Pages project. |
| Redirect Worker | `tubelinkr-go` | `go.tubelinkr.com` public redirect worker. |
| Redirect domain | `go.tubelinkr.com` | Existing short links and placements. |
| Database | `tubelinkr-prod-db` | Production D1 database. |
| Status | `live production` | Bug fixes only unless explicitly approved. |

### InLinkr Development

| Resource | Value | Notes |
|----------|-------|-------|
| Repository | `RobertBolgar/inlinkr-platform` | Platform workspace and future product code. |
| Marketing domain | `inlinkr.com` | Marketing site. |
| Marketing Pages project | `inlinkr-home` | Static marketing site. |
| App domain | `app.inlinkr.com` | Logged-in InLinkr app. |
| App Pages project | `inlinkr-platform` | Cloudflare labels this as Production, but it is intentionally a development and migration environment. |
| Redirect Worker | `inlinkr-go-dev` | Public redirect worker for development. |
| Redirect domain | `go-dev.inlinkr.com` | Development short links and redirects. |
| Database | `tubelinkr-db` | Development D1 database; shared migration sandbox. |
| Status | `development and migration environment` | Not the final production environment. |

### Environment rules

- Do not rename either D1 database during migration.
- Do not connect InLinkr development to `tubelinkr-prod-db`.
- Do not change `tubelinkr-go` or `go.tubelinkr.com`.
- The development app and development Worker must point to the same D1 database.
- Migration files, not development data, become the production rollout source of truth.
- TubeLinkr production remains untouched until the InLinkr platform is fully validated.

### Sandbox note

`tubelinkr-db` is the current shared migration sandbox. It is the only database the InLinkr development app and Worker should use. `go-dev.inlinkr.com` is the development redirect domain. `app.inlinkr.com` is the development app, even though Cloudflare Pages labels the `inlinkr-platform` project as Production.

## 11. Audit Risks

Before the production cutover, the following audit findings and risks must be resolved or explicitly accepted. The platform is not ready for production until these are reviewed.

| # | Risk | Source | Action |
|---|------|--------|--------|
| 1 | `placements.source_code` uniqueness conflict | Original platform spec audit findings | Verify and resolve uniqueness rules before scale. |
| 2 | Obsolete `redirect-worker.js` | Original platform spec audit findings | Remove after new `go.inlinkr.com` Worker is confirmed stable. |
| 3 | Obsolete `wrangler-redirect.toml` | Original platform spec audit findings | Remove after Worker cutover is stable. |
| 4 | Dead or misconfigured `functions/api/redirect.js` | Original platform spec audit findings | Remove or refactor if still present. |
| 5 | Migration history split between `migrations/` and root `cloudflare-*.sql` files | Original platform spec audit findings | Consolidate migration history. |
| 6 | Referral logic duplicated between Worker and Pages Functions | Original platform spec audit findings | Decide authoritative path and remove duplication. |
| 7 | Verify referral reward columns exist in production D1 | Original platform spec audit findings | Confirm schema before cutover. |
| 8 | Confirm IP hashing consistency | Original platform spec audit findings | Verify `hashIpAddress` and privacy rules. |
| 9 | Current vs target schema divergence | Platform architecture review | Complete additive migrations and feature flags before cutover. |
| 10 | Redirect base URL environment awareness | Development lane review | Centralize redirect base URL and use `go-dev.inlinkr.com` for development. |

## 12. Current vs Target Architecture

| Aspect | Current Architecture | Target Architecture |
|--------|----------------------|----------------------|
| Auth | Clerk JWT with `users` columns caching plan/status | Clerk JWT with `subscriptions` and `user_entitlements` as source of truth |
| Billing | Stripe fields on `users` | `plans`, `subscriptions`, `user_entitlements` tables |
| Products | Only TubeLinkr exists; product is implicit | `products`, `user_products`, product workspaces |
| Links | `links` with product-specific `video_id` columns | `links` product-agnostic, `link_contexts` for product context |
| Events | `click_events` | `events` with `event_type` and `product_id` |
| Redirect | `go.tubelinkr.com` and `go-dev.inlinkr.com` | `go.inlinkr.com` with `go.tubelinkr.com` compatibility |
| Profiles | Data in `users` and `creator_hub_settings` | Dedicated `profiles` table |
| OAuth | `youtube_connections` only | `oauth_connections` with multiple providers |
| Worker | `worker.js` on `go.tubelinkr.com` | `worker.js` on `go.inlinkr.com` with `go.tubelinkr.com` fallback |

The migration path is additive: add platform tables, backfill data, gate new behavior behind `feature_flags`, and run cleanup/rename only after the new platform behavior is fully validated.

## 13. Summary

The InLinkr platform is built around a shared identity, billing, redirect, and analytics core. Existing TubeLinkr tables already contain most of the data needed; the work is to generalize them with `product_id`, `context_type`, and `context_id` fields, and to add a small number of platform tables (`products`, `user_products`, `plans`, `subscriptions`, `user_entitlements`, `profiles`). Product modules (TubeLinkr, QRLinkr, and future products) plug into this core by registering their keys, routes, plans, and feature permissions. The safest path is additive migrations, feature flags, and a final cleanup/rename phase only after the new platform behavior is fully validated.
