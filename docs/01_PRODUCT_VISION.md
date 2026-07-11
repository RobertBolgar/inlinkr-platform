# InLinkr Product Vision

Version: 1.0

---

## Purpose

InLinkr exists to become a platform for creator-focused internet tools.

Rather than building one large application that attempts to solve every problem, InLinkr provides a shared platform that powers multiple focused products.

Each product solves one problem extremely well while sharing authentication, billing, analytics, infrastructure, and creator identity through the InLinkr platform.

The goal is to build products that feel independent while benefiting from a common foundation.

---

## Mission

Help creators better understand, share, and grow their online presence through simple, focused tools.

We believe creators should spend more time creating and less time managing complicated software.

---

## Vision

Become the platform powering an ecosystem of creator tools.

Examples include:

- TubeLinkr
- QRLinkr
- Future products
- Creator profiles
- Attribution tools
- Marketing utilities
- Analytics products

Every product should feel like its own company while quietly benefiting from the shared InLinkr platform.

---

## The Golden Rule

**Share infrastructure. Specialize experiences.**

This is the single most important rule for the platform. The platform consolidates the services that every product needs, while each product remains free to build its own identity, navigation, and workflows.

**Never duplicate:**

- Authentication
- Billing
- Analytics
- Redirect engine
- Referrals
- Database
- Events
- Traffic Proof

**Always allow products to have:**

- Independent branding
- Independent navigation
- Independent onboarding
- Independent workflows
- Independent dashboards

Sharing infrastructure does not mean sharing the user interface. The user experience of each product is sacred. The platform makes shared services invisible, so products can focus on what makes them unique.

---

## Product Independence Rule

Every product should be capable of standing on its own.

A user should be able to:

- **Discover the product independently.** TubeLinkr and QRLinkr can each have their own marketing sites, landing pages, and acquisition funnels. A user should discover them as distinct solutions.
- **Purchase the product independently.** Each product can be bought, upgraded, and managed without forcing the user to understand the broader InLinkr platform.
- **Use the product independently.** Once inside a product, the user should never need to learn the platform in order to get value. The product must feel complete and self-contained.

InLinkr provides shared infrastructure. It does not replace product identity. The user should not need to understand InLinkr in order to use TubeLinkr or QRLinkr.

---

## Platform Evolution Rule

The platform should evolve gradually. We extract a service into the platform only when it benefits more than one product. We avoid building infrastructure for hypothetical future products. We build for today's needs while making tomorrow's expansion straightforward.

This means:

- Start with the shared services that TubeLinkr and QRLinkr already need.
- Generalize a service only after it has proven value in one product and is likely to be reused by another.
- Keep product-specific features in product modules until they are truly cross-product.
- Add new platform tables, APIs, and helpers when the alternative is duplication, not when the alternative is speculation.

---

## Product Philosophy

### Build focused products

Every product should solve one primary problem.

Avoid turning products into bloated "all-in-one" software.

If a feature naturally belongs in another product, build another product.

### Products first

Users should think:

"I use TubeLinkr."

not

"I use InLinkr."

InLinkr should operate behind the scenes.

### Shared foundation

Products share:

- Authentication
- Billing
- User accounts
- Analytics
- Redirect engine
- Profiles
- Permissions
- Infrastructure

Products do NOT share their user experience.

### Simplicity

The platform should remain understandable.

If a new abstraction makes the platform harder to understand than the problem it solves, don't build it.

### AI-first discoverability

Every product should be built assuming AI search is becoming as important as traditional search.

Documentation, product pages, structured content, and public information should be written so both humans and AI systems understand exactly what each product does.

---

## InLinkr Home

`app.inlinkr.com` is the front door.

When a user signs in, they arrive at `app.inlinkr.com`. The first screen is not a dashboard. It is a launcher.

The InLinkr Home is intentionally simple:

- **Products:** Launch the product workspaces the user has access to.
- **Billing:** Manage payments, plans, and subscriptions across products.
- **Settings:** Account, security, profile, and platform preferences.
- **Support:** Help, documentation, and contact.

That is all. The InLinkr Home does not try to be a dashboard. It is a doorway into products.

### Design principles for the InLinkr Home

- **Minimal.** One row per product. No widget overload.
- **Neutral.** The InLinkr Home uses platform branding, not product branding.
- **Fast.** The user can launch a product in one click.
- **Clear.** Active, pending, and coming-soon products are visually distinct.
- **Scalable.** New products are added as new launch cards without redesigning the page.

---

## Product Workspaces

### Each product is a dedicated application

When a user opens TubeLinkr, the entire experience should feel like TubeLinkr. When they open QRLinkr, it should feel like QRLinkr. The transition between products should be as distinct as switching from Photoshop to Illustrator or from Jira to Confluence.

A product workspace owns:

- Its own navigation.
- Its own homepage.
- Its own terminology.
- Its own workflows.
- Its own onboarding.
- Its own settings.
- Its own brand presence inside the platform.

### Example TubeLinkr workspace

```
TubeLinkr

Dashboard
Links
Placements
Analytics
Traffic Proof
Creator Hub
Settings
```

This is a YouTube-focused product. The language is about videos, links, placements, and creator impact. The dashboard surfaces YouTube analytics, link performance, and proof pages.

### Example QRLinkr workspace

```
QRLinkr

Dashboard
QR Codes
Templates
Downloads
Campaigns
Scan Analytics
Settings
```

This is a QR-code-focused product. The language is about codes, scans, campaigns, and downloads. The dashboard surfaces QR creation, scan analytics, and campaign performance.

### Product workspace rules

- A product workspace must have a clear identity the moment it loads.
- The product name and logo are visible inside the workspace.
- The navigation is product-specific.
- The user should not see features from another product mixed into the primary navigation.
- Each product has its own settings page, even if some settings are shared at the platform level.

---

## Product vs. Platform Responsibilities

### InLinkr owns the platform layer

InLinkr provides the services and infrastructure that all products share:

- **Authentication** — sign-in, sign-up, session management, OAuth, password resets.
- **Users** — identity, email, username, profile, roles.
- **Profiles** — public creator profile, subdomain, display name, avatar.
- **Billing** — Stripe integration, subscriptions, invoices, trials, refunds.
- **Referrals** — referral codes, qualification, rewards, creator impact.
- **Redirect engine** — short links, public codes, subdomains, click tracking.
- **Analytics** — unified events, click counting, scan counting, attribution.
- **Events** — the shared event pipeline and event store.
- **Traffic Proof** — public proof pages, proof tokens, proof engagement.
- **Database** — shared D1 schema with platform tables and product contexts.
- **API** — shared platform endpoints, auth, rate limits, helpers.
- **Feature flags** — runtime toggles for product and platform features.
- **Admin** — platform-wide admin, activity logs, support tools.
- **Notifications** — platform-level email, in-app, and lifecycle notifications.

Products use these services. Products do not rebuild them.

### Each product owns the experience layer

Each product owns everything that the user sees and interacts with:

- **Navigation** — the product's primary and secondary menus.
- **Dashboard** — the product's default landing page.
- **User experience** — how the product guides the user from zero to value.
- **Product terminology** — the words and labels specific to the product's domain.
- **Product branding** — logo, color accents, personality, and tone within the workspace.
- **Product-specific routes** — URL paths inside the product workspace.
- **Product-specific API endpoints** — routes under the product namespace for product logic.
- **Product-specific settings** — preferences, defaults, integrations, and customization.
- **Product-specific onboarding** — first-run flow, tooltips, and setup steps.

Products consume the platform. The platform does not dictate product UX.

---

## Navigation and Product Switching

### Always available product switcher

Inside any product workspace, the user can always switch to another product. The switcher is part of the platform shell, not the product navigation.

Example:

```
InLinkr

Products
  TubeLinkr
  QRLinkr
  PodcastLinkr

[Current product workspace]
```

The product switcher should be:

- Visible but unobtrusive.
- Consistent across all products.
- Fast — switching products should feel like switching apps, not loading a new page inside the same layout.
- Context-aware — it shows only products the user has access to.

### Returning to the InLinkr Home

The InLinkr Home is always reachable from the product switcher. It is the neutral ground between products.

From the InLinkr Home, a user can:

- Launch a product.
- Go to Billing.
- Go to Settings.
- View the product catalog or add a new product.

### No nested dashboards

A product workspace should not embed another product's dashboard. The product switcher is the only navigation bridge between products. This preserves the feeling of separate applications.

---

## Product Identity and Branding

### Preserve product identity

TubeLinkr should always feel like TubeLinkr. QRLinkr should always feel like QRLinkr. Future products should have the same freedom.

This means:

- Each product keeps its own name and logo inside its workspace.
- Each product keeps its own color and visual style.
- Each product keeps its own language and workflows.
- The platform shell does not override the product's personality.

### The platform shell is neutral

The InLinkr Home, product switcher, and account settings are intentionally neutral. They use the InLinkr brand so that products can stand out next to them.

### Future product identity

When a new product is added, it should launch with its own:

- Name and logo.
- Primary color palette.
- Navigation structure.
- Onboarding flow.
- Settings page.

The platform provides the container, but the product defines the experience.

---

## Onboarding

### Platform onboarding

Platform onboarding is minimal:

1. Sign in or sign up.
2. Create the InLinkr account.
3. Land on the InLinkr Home.

The platform does not force the user into a product-specific workflow until they choose a product.

### Product onboarding

Each product handles its own onboarding. When the user opens a product for the first time, that product guides them:

- TubeLinkr might ask for a YouTube channel and create the first Smart Link.
- QRLinkr might create the first QR code and show how to download it.
- PodcastLinkr might ask for a feed URL and generate default links.

The platform makes the user available to the product; the product turns the user into an active user.

### Cross-product discovery

From the InLinkr Home, the platform can show:

- Products the user already has.
- Products available to try.
- Coming-soon products.

This is not advertising. It is navigation. The user should discover new products the same way they discover apps in a suite.

---

## Billing and Entitlements

### One account, one billing

A user has a single Stripe customer record. Subscriptions can be per-product or platform-wide bundles, but they are all managed under one account.

### Product-specific plans

Each product can define its own plans:

- TubeLinkr Free, TubeLinkr Pro, TubeLinkr Founder.
- QRLinkr Free, QRLinkr Pro.

A user can subscribe to products independently.

### Platform bundles

A platform bundle — e.g., "InLinkr Pro" — grants access to multiple products. The bundle still lives on the same user account and the same Stripe customer.

### Referrals apply across the platform

The referral system is a platform service. A referral code works for the platform account, and referral rewards can be applied to product access or platform bundles.

### Unified billing UI

Billing is managed from the InLinkr Home. Each product can surface upgrade prompts inside its own workspace, but the purchase and management flow is shared.

---

## Analytics and Events

### One analytics engine

All products write to the same event pipeline. Clicks, scans, views, conversions, and proof views all become events in the same store.

### Product-scoped analytics

Each product queries the shared event store with its own product filter. This means:

- TubeLinkr can show video and click analytics.
- QRLinkr can show scan and campaign analytics.
- Future products can show their own metrics without duplicating the analytics system.

### Cross-product analytics

Because the events are in one store, the platform can eventually show cross-product analytics for a user:

- Total traffic across all products.
- Top performing links across all products.
- Product adoption and activation.

This is a platform-level feature, not a product feature.

---

## Redirects and Links

### `go.inlinkr.com` is the platform redirect engine

The redirect engine is shared. It resolves short URLs, records events, and routes to destinations.

### Product-agnostic links

A link is a link. The platform resolves it. The product that created it may be associated with it for analytics and ownership, but the redirect engine is neutral.

### Product-specific redirect rules

Products can register redirect behaviors through the platform, but the core engine is shared. Examples:

- TubeLinkr may track a click and show a Smart Link destination.
- QRLinkr may track a scan and route to a campaign URL.
- Future products may route to dynamic content based on context.

The platform handles resolution, tracking, and attribution. The product decides the destination logic.

---

## Traffic Proof

### Shared proof infrastructure

Traffic Proof is a platform service. Any product can create public proof pages that demonstrate performance.

### Product-specific proof types

- TubeLinkr creates video performance proof.
- QRLinkr creates campaign scan proof.
- Future products create their own proof types.

The underlying mechanism — tokens, snapshots, public pages, events — is the same.

---

## Technical Architecture

### Shared underneath

Internally, the platform is one codebase, one database, and one set of services:

- One Clerk authentication provider.
- One Stripe billing integration.
- One D1 database with platform tables.
- One event pipeline.
- One redirect engine.
- One set of API helpers and middleware.

See [02_PLATFORM_SCHEMA.md](02_PLATFORM_SCHEMA.md) for the technical blueprint.

### Independent on top

Externally, the product workspaces are independent experiences:

- Each product has its own route namespace.
- Each product has its own dashboard and navigation.
- Each product has its own settings and onboarding.
- Each product has its own terminology and branding.

The platform provides the foundation. The products build the experience.

### Product registration

A product is registered in the platform by:

- Adding a `products` record.
- Defining its plans in `plans`.
- Declaring its features and permissions.
- Adding its route namespace.
- Building its workspace UI and product-specific API endpoints.
- Wiring into shared events, redirects, and traffic proof.

This registration model makes it possible to add new products without rebuilding the platform.

---

## Preserving TubeLinkr

### Current TubeLinkr remains the reference

The existing TubeLinkr production application must continue working exactly as it does today. No code changes, migrations, route changes, or branding changes are made to the current production system during the platform validation phase.

### Platform work happens in the InLinkr project

All platform architecture, shared services, and new product workspaces are built and validated inside the InLinkr project first. When the platform is stable, products can migrate to it on their own schedules.

### TubeLinkr as product #1

When the platform is ready, TubeLinkr becomes the first product workspace. The user experience must be as good as, or better than, the standalone application. The standalone application remains live until the workspace version is fully validated.

### The Keep Existing Constraint

The current TubeLinkr production application remains the reference implementation. Until the InLinkr platform reaches feature parity and has been fully validated, we must:

- **Do not break TubeLinkr.** The existing application must keep working for every existing user.
- **Do not migrate production users.** No forced migration of production users or data.
- **Do not replace production infrastructure.** The existing TubeLinkr systems remain live and authoritative.

All platform work happens inside the InLinkr project. TubeLinkr is migrated only when the InLinkr workspace version is proven, stable, and better.

---

## Future Products

### Adding a product is a design decision, not a platform rewrite

New products are added by:

1. Defining the product's purpose and audience.
2. Designing the product's workspace, navigation, and workflows.
3. Registering the product in the platform catalog.
4. Reusing platform services for auth, billing, links, redirects, analytics, and traffic proof.
5. Building only the product-specific logic and UI.

### Examples of future products

- **PodcastLinkr** — links, clips, and attribution for podcasters.
- **EventLinkr** — links, ticketing, and attendance tracking for events.
- **AffiliateLinkr** — affiliate tracking and commission attribution.
- **LiveLinkr** — live stream links and real-time audience analytics.

Each of these should feel like its own application while sharing the platform foundation.

---

## Anti-Goals

The following are things we deliberately do not want:

- **One giant dashboard.** The InLinkr Home is a launcher, not a dashboard.
- **Generic navigation across products.** Each product has its own navigation.
- **Shared UI chrome that suppresses product identity.** Products keep their own branding.
- **Product-specific billing systems.** Billing is unified.
- **Product-specific auth systems.** Auth is unified.
- **Duplicating platform services inside products.** Products use the shared engine.
- **Building platform infrastructure for hypothetical future products.** We generalize only when two or more real products need the same service.

---

## Success Criteria

The platform is working when:

- A user signs in once and can launch any product.
- Each product feels like an independent application.
- Switching products is fast and predictable.
- Billing, auth, and analytics are invisible infrastructure.
- New products can be designed, registered, and launched without changing the platform core.
- TubeLinkr continues to work during and after the transition.

---

## Summary

InLinkr is the platform. TubeLinkr, QRLinkr, and future products are independent workspaces that share it.

One account. One billing. One authentication. One analytics engine. Many specialized products.

The user signs in at `app.inlinkr.com`, sees the InLinkr Home, and launches the product they need. Inside that product, the experience is dedicated, branded, and purpose-built. The platform makes the shared services invisible, so every product can focus on what it does best.

TubeLinkr remains the reference implementation and continues unchanged until the platform is fully validated. All platform work happens inside the InLinkr project.