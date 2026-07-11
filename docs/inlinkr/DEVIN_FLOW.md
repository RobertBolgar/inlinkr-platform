# DEVIN_FLOW

This file documents development-only workflow decisions for the InLinkr / TubeLinkr platform. It is an operational development handbook, not a product or architecture document.

---

## Environment Context

This repository is the InLinkr development workspace (`RobertBolgar/inlinkr-platform`). The current environments are:

- `app.inlinkr.com` — InLinkr development app. Cloudflare Pages labels the `inlinkr-platform` project as `Production`, but this is intentionally the development and migration environment.
- `go-dev.inlinkr.com` — development redirect domain for the `inlinkr-go-dev` Worker.
- `tubelinkr-db` — development D1 database; the shared migration sandbox.
- `tubelinkr.com` / `go.tubelinkr.com` / `tubelinkr-prod-db` — live TubeLinkr production. These must remain untouched.

The development app and development Worker must point to the same D1 database. TubeLinkr production must not be used for InLinkr development.

---

## Temporary InLinkr Development Authentication Mode

### Why it exists

During the InLinkr platform build phase, the team needed to remove Clerk as a blocker while still running the full frontend. This temporary development mode allows the application to load without requiring Clerk, simulates a signed-in Pro/Admin user, and keeps all existing authentication code intact so Clerk can be restored before production launch.

**This mode is temporary and forbidden for the final production launch.** It must never be enabled in a real production or public deployment.

### What files were changed

- `src/lib/auth/dev.ts`
  - `isDevAuthEnabled` flag
  - `DEV_USER` mock user object (`dev-user`, `admin@inlinkr.com`, Pro, admin)
  - `DEV_CLERK_USER` mock Clerk-shaped user
  - `initializeDevAuth()` to set `window.Clerk` for API calls that read the Clerk global

- `src/lib/auth/clerk.tsx`
  - Centralized wrapper around `@clerk/clerk-react`
  - Returns stubs for `useAuth`, `useUser`, `ClerkProvider`, `SignIn`, `SignUp`, `SignedIn`, `SignedOut` when dev auth is enabled
  - Delegates to the real Clerk package when disabled

- `src/components/DevModeIndicator.tsx`
  - Subtle "Development Mode" badge shown in the UI when dev auth is active

- `src/contexts/AuthContext.tsx`
  - Uses the auth wrapper
  - Skips Clerk sync and returns the mock user in dev mode
  - `signOut` and `refreshUser` are no-ops in dev mode

- `src/main.tsx`
  - Initializes `initializeDevAuth()` before render
  - Uses the wrapped `ClerkProvider`
  - Skips the `VITE_CLERK_PUBLISHABLE_KEY` check in dev mode

- `src/App.tsx`
  - Uses wrapped `SignedIn`, `SignedOut`, and `useAuth`
  - Renders the `<DevModeIndicator />`

- The following files were updated to import Clerk through the wrapper instead of directly from `@clerk/clerk-react`:
  - `src/components/Layout.tsx`
  - `src/components/PublicNav.tsx`
  - `src/pages/LoginPage.tsx`
  - `src/pages/SignupPage.tsx`
  - `src/pages/SettingsPage.tsx`
  - `src/pages/PricingPage.tsx`
  - `src/pages/UpgradePage.tsx`
  - `src/pages/CheckoutPage.tsx`
  - `src/pages/HomePageB.tsx`

- `src/lib/cloudflare.ts`
  - Added optional `isAdmin` and `role` fields to the `User` TypeScript interface for the mock user

### How to enable it

Set this environment variable before running the dev server:

```bash
VITE_DEV_AUTH=true
```

Optional: set a custom dev token:

```bash
VITE_DEV_AUTH_TOKEN=dev-token
```

Then run:

```bash
npm run dev
```

The app will load as the mock user, skip the Clerk login flow, and display a small "Development Mode" badge.

### How to disable it

Remove or unset `VITE_DEV_AUTH` from your environment. When the flag is absent or not set to `'true'`, the auth wrapper delegates back to the real Clerk provider and hooks, and the standard `VITE_CLERK_PUBLISHABLE_KEY` requirement is enforced.

### What must not be changed

This mode is a frontend-only bypass. The following were intentionally not modified:

- Database schema
- D1
- SQL migrations
- Cloudflare configuration
- Workers
- API routes
- Stripe integration
- Clerk configuration
- OAuth flows
- Environment variables beyond `VITE_DEV_AUTH` and `VITE_DEV_AUTH_TOKEN`
- Analytics
- Referrals
- Traffic Proof
- Redirect engine
- Build configuration
- Routing architecture

### Important reminders

- **Development-only:** `VITE_DEV_AUTH=true` must never be enabled in production or in a public deployment.
- **Clerk must be restored before launch:** Remove `VITE_DEV_AUTH` and verify that `VITE_CLERK_PUBLISHABLE_KEY` is configured before launching production.
- **No real authentication:** The mock user is not authenticated against the backend. Any API routes that validate Clerk tokens will still require valid Clerk credentials.
- **Backend Clerk-protected APIs may still reject mock auth:** Dev auth bypasses the frontend only. Backend endpoints that require a valid Clerk JWT continue to require one.
- **Do not enable for final launch:** Dev auth is temporary and must not be present in production.
- **Dev environment:** `app.inlinkr.com` is currently a development environment, `go-dev.inlinkr.com` is the development redirect lane, and `tubelinkr-db` is the development database.
