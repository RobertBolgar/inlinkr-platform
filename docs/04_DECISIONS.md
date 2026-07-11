# Architectural Decisions

This document records major platform decisions in Architecture Decision Record (ADR) format. Every significant architectural decision should be documented here.

---

## ADR-001 — InLinkr is the platform

- **Date:** 2026-07
- **Status:** Accepted
- **Context:** The current codebase is a TubeLinkr-first application. The business goal is to support multiple creator tools without rebuilding shared infrastructure for each product.
- **Decision:** InLinkr is the platform. TubeLinkr, QRLinkr, and future products are product workspaces built on top of it.
- **Reason:** Centralizing auth, billing, redirect, analytics, and identity reduces duplication while allowing each product to specialize.
- **Alternatives considered:** Keep TubeLinkr as a standalone monolith and fork it for each product. Rejected because it duplicates infrastructure and fragments the user experience.
- **Consequences:** A single codebase and database must support multiple products through `product_id`, `context_type`, and `context_id` fields.

## ADR-002 — TubeLinkr and QRLinkr remain independent product experiences

- **Date:** 2026-07
- **Status:** Accepted
- **Context:** Users purchase products because they solve a specific problem. Large unified dashboards reduce product clarity.
- **Decision:** Every product receives its own dashboard, branding, navigation, and experience. The platform remains invisible.
- **Reason:** Products must feel independent and purpose-built. The shared platform is infrastructure, not a user interface.
- **Alternatives considered:** One giant dashboard with all features. Rejected because it violates product clarity and independence.
- **Consequences:** The platform must provide a neutral shell and product switcher, and product modules own their own routes and UI.

## ADR-003 — InLinkr Home is a launcher, not one giant dashboard

- **Date:** 2026-07
- **Status:** Accepted
- **Context:** `app.inlinkr.com` is the front door for signed-in users. It must be neutral and not replace product workspaces.
- **Decision:** The InLinkr Home contains only Products, Billing, Settings, and Support. It is a doorway into products, not a dashboard.
- **Reason:** A launcher preserves product identity and keeps the platform from competing with product UX.
- **Alternatives considered:** A unified dashboard with widgets from all products. Rejected because it would create a confusing, generic experience.
- **Consequences:** Products must provide their own dashboards and onboarding. The platform shell is intentionally minimal.

## ADR-004 — Shared authentication

- **Date:** 2026-07
- **Status:** Accepted
- **Context:** Each product would otherwise require its own sign-in, sign-up, password reset, and OAuth flows.
- **Decision:** One account. One login. Shared across every product.
- **Reason:** Reduces friction for users, simplifies security, and avoids duplicated auth code.
- **Alternatives considered:** Product-specific auth systems. Rejected because it fragments user identity and onboarding.
- **Consequences:** The platform owns Clerk integration, user sync, and session management. Products never implement their own auth.

## ADR-005 — Shared billing

- **Date:** 2026-07
- **Status:** Accepted
- **Context:** Subscriptions and entitlements currently live partly on the `users` table and must be generalized for multiple products.
- **Decision:** Subscriptions belong to the platform. Products consume platform entitlements.
- **Reason:** One Stripe customer per user, one place to manage payments, one place to enforce access.
- **Alternatives considered:** Product-specific billing integrations. Rejected because it duplicates Stripe work and billing UI.
- **Consequences:** `plans`, `subscriptions`, and `user_entitlements` become the source of truth; product code checks entitlements through the platform.

## ADR-006 — One Stripe customer per user

- **Date:** 2026-07
- **Status:** Accepted
- **Context:** Stripe customers are user-level identities, not product-level identities.
- **Decision:** Every `users` row maps to exactly one Stripe Customer. Product subscriptions and platform bundles are line items on that customer.
- **Reason:** Simplifies billing history, invoicing, and customer support. Aligns with Stripe's customer model.
- **Alternatives considered:** Separate Stripe customers per product. Rejected because it fragments billing and complicates support.
- **Consequences:** `stripe_customer_id` remains on `users`. `subscriptions` stores product line items. `user_entitlements` expands bundles into product access.

## ADR-007 — Platform-owned redirect engine

- **Date:** 2026-07
- **Status:** Accepted
- **Context:** TubeLinkr already has a redirect Worker. QRLinkr and future products will also need short links and tracking.
- **Decision:** The redirect engine becomes shared infrastructure. TubeLinkr, QRLinkr, and future products all use the same `go.inlinkr.com` service.
- **Reason:** Avoids duplicated redirect logic, analytics, and link resolution. Provides a single source of truth for clicks and scans.
- **Alternatives considered:** Each product runs its own redirect Worker. Rejected because it duplicates event recording and analytics.
- **Consequences:** The Worker resolves links and records events with `product_id`. Product-specific hooks can extend behavior without duplicating the core.

## ADR-008 — Shared analytics and event pipeline

- **Date:** 2026-07
- **Status:** Accepted
- **Context:** Clicks, scans, views, and conversions should be queryable across products and for the platform.
- **Decision:** All products write to the same `events` table. The platform provides a `recordEvent` helper.
- **Reason:** Unified storage enables product-scoped analytics today and cross-product analytics in the future.
- **Alternatives considered:** Separate `click_events`, `scan_events`, etc. per product. Rejected because it fragments data and complicates aggregation.
- **Consequences:** `events` must support `event_type`, `product_id`, `link_context_id`, `placement_id`, `traffic_proof_id`, and `properties_json`.

## ADR-009 — Shared D1 database

- **Date:** 2026-07
- **Status:** Accepted
- **Context:** The platform needs a single source of truth for users, links, events, subscriptions, and referrals.
- **Decision:** One D1 database powers all products. Platform tables are generic; product context is stored in `product_id`, `context_type`, and `context_id` fields.
- **Reason:** Avoids data sync, split migrations, and cross-database queries. Keeps the platform simple.
- **Alternatives considered:** Separate databases per product. Rejected because it complicates shared auth, billing, and analytics.
- **Consequences:** Migrations must be additive and safe. Product-specific tables are only created when absolutely required.

## ADR-010 — Additive migration strategy

- **Date:** 2026-07
- **Status:** Accepted
- **Context:** TubeLinkr production is live and must remain stable. The platform must be validated before any cutover.
- **Decision:** All changes are additive or behind feature flags. No renames or deletions in phase 1. Backfills are idempotent. Backwards compatibility is preserved until migration is complete.
- **Reason:** Minimizes risk to production users and allows rollback if new behavior is not stable.
- **Alternatives considered:** Big-bang migration with table renames. Rejected because it is risky and hard to validate.
- **Consequences:** Legacy tables and columns remain in place until the new platform is fully validated. Cleanup/rename happens in a final phase.

## ADR-011 — TubeLinkr production remains untouched during development

- **Date:** 2026-07
- **Status:** Accepted
- **Context:** TubeLinkr has live users, existing links, and production Workers. The InLinkr platform is being built separately.
- **Decision:** No code changes, migrations, route changes, or branding changes are made to the current TubeLinkr production system during the platform validation phase.
- **Reason:** Production must remain stable. InLinkr must prove itself before any cutover.
- **Alternatives considered:** Modify production incrementally. Rejected because it couples platform risk with production stability.
- **Consequences:** All platform work happens in `RobertBolgar/inlinkr-platform`. TubeLinkr is migrated only after validation.

## ADR-012 — tubelinkr-db remains the shared migration sandbox

- **Date:** 2026-07
- **Status:** Accepted
- **Context:** A development D1 database is needed for InLinkr that is separate from `tubelinkr-prod-db`.
- **Decision:** `tubelinkr-db` is the development and migration sandbox for InLinkr. It is not renamed.
- **Reason:** Uses the existing TubeLinkr development database while the platform is built. Avoids the risk of renaming or splitting databases during migration.
- **Alternatives considered:** Create a new `inlinkr-db` database. Rejected because it would fragment the migration and require re-seeding data.
- **Consequences:** `app.inlinkr.com` and `go-dev.inlinkr.com` must both point to `tubelinkr-db` in development.

## ADR-013 — app.inlinkr.com is temporarily development despite Cloudflare Production labeling

- **Date:** 2026-07
- **Status:** Accepted
- **Context:** Cloudflare Pages labels the `inlinkr-platform` Pages project as Production, but there is no final production environment yet.
- **Decision:** `app.inlinkr.com` is the development and migration environment. The `Production` label in Cloudflare does not mean this is the final production environment.
- **Reason:** The team needs a stable, deployed environment to build and test the platform before defining final production.
- **Alternatives considered:** Treat the Cloudflare Production branch as final production immediately. Rejected because the platform is not validated and would risk live users.
- **Consequences:** Feature flags, dev auth, and sandbox data are acceptable on `app.inlinkr.com` until the real production cutover.

## ADR-014 — go-dev.inlinkr.com is the development redirect domain

- **Date:** 2026-07
- **Status:** Accepted
- **Context:** The redirect Worker needs a development counterpart to `go.tubelinkr.com` and `go.inlinkr.com`.
- **Decision:** `go-dev.inlinkr.com` is the development redirect domain for InLinkr testing.
- **Reason:** Provides a safe environment to test redirects, click recording, and placement attribution without affecting production links.
- **Alternatives considered:** Use `go.inlinkr.com` for development. Rejected because it would conflict with the final production redirect domain.
- **Consequences:** The development Worker `inlinkr-go-dev` must be bound to `tubelinkr-db` and the redirect base URL must be environment-aware.

## ADR-015 — Database resources will not be renamed during migration

- **Date:** 2026-07
- **Status:** Accepted
- **Context:** Database renames can break Workers, Pages Functions, and local scripts.
- **Decision:** `tubelinkr-db` and `tubelinkr-prod-db` keep their names until the migration is complete and stable.
- **Reason:** Renaming adds risk and uncertainty without adding functionality. Naming cleanup can happen after the platform is validated.
- **Alternatives considered:** Rename `tubelinkr-db` to `inlinkr-dev-db` immediately. Rejected because it would require config changes and re-validation.
- **Consequences:** Documentation and configuration must reference the existing database names. Renames are deferred to the final cleanup phase.

## ADR-016 — Existing TubeLinkr production URLs remain compatible after cutover

- **Date:** 2026-07
- **Status:** Accepted
- **Context:** Existing TubeLinkr users have public links on `go.tubelinkr.com` and branded subdomains.
- **Decision:** `go.tubelinkr.com` and existing user/slug links continue to resolve after the platform cutover.
- **Reason:** Existing users must not experience broken links. Backwards compatibility is a hard requirement.
- **Alternatives considered:** Redirect all `go.tubelinkr.com` traffic to `go.inlinkr.com`. Rejected because it could break existing integrations and SEO.
- **Consequences:** The final Worker on `go.inlinkr.com` must be able to resolve legacy TubeLinkr codes and paths.

## ADR-017 — AI-search discoverability is required from V1

- **Date:** 2026-07
- **Status:** Accepted
- **Context:** AI search and agents are becoming as important as traditional search for product discovery.
- **Decision:** Every product, documentation page, and public resource must be written so both humans and AI systems understand exactly what the product does.
- **Reason:** Future discoverability depends on clear, structured, machine-readable content.
- **Alternatives considered:** Optimize for traditional SEO only. Rejected because it would leave the platform unprepared for AI-driven discovery.
- **Consequences:** Documentation, product pages, and public content must be clear, structured, and free of ambiguous jargon.

## ADR-018 — Platform services are generalized only when real products need them

- **Date:** 2026-07
- **Status:** Accepted
- **Context:** There is a risk of over-engineering the platform for hypothetical future products.
- **Decision:** A service is extracted into the platform only after it has proven value in one product and is likely to be reused by another.
- **Reason:** Avoids building infrastructure for speculation. Keeps the platform lean and understandable.
- **Alternatives considered:** Build a generic platform first, then add products. Rejected because it leads to premature abstraction and unused services.
- **Consequences:** Product-specific features live in product modules until they are truly cross-product. Platform tables are added only when needed.

## ADR-019 — Development auth is temporary and forbidden for final launch

- **Date:** 2026-07
- **Status:** Accepted
- **Context:** The `VITE_DEV_AUTH` bypass was created to remove Clerk as a blocker during the build phase.
- **Decision:** Dev auth is temporary. It must never be enabled in a production or public deployment. Clerk must be restored before launch.
- **Reason:** The mock user is not a real authentication session. Backend Clerk-protected APIs may still reject it. Leaving it enabled would create a security vulnerability.
- **Alternatives considered:** Keep dev auth as a permanent feature flag. Rejected because it is a security risk and not a real auth solution.
- **Consequences:** `VITE_DEV_AUTH=true` must be removed from all environment variables and builds before launch. Dev auth is documented only in `DEVIN_FLOW.md`.