# Environment Architecture

This document describes the current InLinkr environment and how it maps to the platform architecture. The source of truth for environment details is [docs/00_CURRENT_STATE.md](../00_CURRENT_STATE.md). The canonical architecture is in [docs/02_PLATFORM_SCHEMA.md](../02_PLATFORM_SCHEMA.md).

## Overview

InLinkr is currently in the development and migration phase. The development app (`app.inlinkr.com`), development redirect worker (`go-dev.inlinkr.com`), and development D1 database (`tubelinkr-db`) form the migration sandbox. TubeLinkr production remains untouched.

## Environments

### TubeLinkr Production

| Resource | Value |
|----------|-------|
| Repository | `RobertBolgar/tubelinkr` |
| Marketing/app domain | `tubelinkr.com` |
| Pages project | `tubelinkrgit` |
| Redirect Worker | `tubelinkr-go` |
| Redirect domain | `go.tubelinkr.com` |
| Database | `tubelinkr-prod-db` |
| Status | `live production` |

### InLinkr Development

| Resource | Value |
|----------|-------|
| Repository | `RobertBolgar/inlinkr-platform` |
| Marketing domain | `inlinkr.com` |
| Marketing Pages project | `inlinkr-home` |
| App domain | `app.inlinkr.com` |
| App Pages project | `inlinkr-platform` |
| Redirect Worker | `inlinkr-go-dev` |
| Redirect domain | `go-dev.inlinkr.com` |
| Database | `tubelinkr-db` |
| Status | `development and migration environment` |

## Domains

- `inlinkr.com` — marketing site.
- `app.inlinkr.com` — development app (Cloudflare Pages project `inlinkr-platform`; labeled as Production but intentionally dev).
- `go-dev.inlinkr.com` — development redirect domain.
- `tubelinkr.com` — TubeLinkr production app.
- `go.tubelinkr.com` — TubeLinkr production redirect domain.
- `username.inlinkr.com` — target creator profile subdomain (future).

## Databases

- `tubelinkr-prod-db` — production TubeLinkr; never used by InLinkr development.
- `tubelinkr-db` — development and migration sandbox for InLinkr.

## Workers

- `tubelinkr-go` — production redirect worker on `go.tubelinkr.com`.
- `inlinkr-go-dev` — development redirect worker on `go-dev.inlinkr.com`.

## Pages Projects

- `tubelinkrgit` — production TubeLinkr Pages.
- `inlinkr-platform` — InLinkr app Pages (development).
- `inlinkr-home` — InLinkr marketing site Pages.

## Notes

- The app and redirect worker in a given environment must share the same D1 database.
- No production resources are renamed or deleted during migration.
- `app.inlinkr.com` is the development app even though Cloudflare Pages labels the `inlinkr-platform` project as Production.
- See [docs/02_PLATFORM_SCHEMA.md](../02_PLATFORM_SCHEMA.md) for the schema architecture.

## Environment Variables

### Frontend (Vite)

Frontend environment variables are prefixed with `VITE_` and are exposed to the browser. They are configured in:

- **Local development:** `.env` file (not committed)
- **Cloudflare Pages:** `wrangler.toml` under `[vars]` or `[env.production]`/`[env.preview]`

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | - | Clerk public key for authentication |
| `VITE_REDIRECT_BASE_URL` | Yes | `https://go-dev.inlinkr.com` | Base URL for Smart Link redirects |
| `VITE_APP_BASE_URL` | Yes | `https://app.inlinkr.com` | Base URL for the app |
| `VITE_MARKETING_BASE_URL` | Yes | `https://inlinkr.com` | Base URL for marketing site |
| `VITE_STRIPE_ENABLED` | Yes | `false` | Enable Stripe billing |
| `VITE_EMAIL_ENABLED` | Yes | `false` | Enable email sending |
| `VITE_ENABLE_CUSTOM_SUBDOMAINS` | Yes | `false` | Enable custom subdomain URLs |
| `VITE_CLERK_SIGN_IN_URL` | Yes | `/login` | Clerk sign-in URL |
| `VITE_CLERK_SIGN_UP_URL` | Yes | `/signup` | Clerk sign-up URL |
| `VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | Yes | `/dashboard` | Clerk sign-in fallback redirect |
| `VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | Yes | `/dashboard` | Clerk sign-up fallback redirect |
| `VITE_DEV_AUTH` | No | `false` | Enable dev auth bypass (local only) |
| `VITE_DEV_AUTH_TOKEN` | No | - | Dev auth bypass token (local only) |

### Backend (Functions)

Backend environment variables are used by Cloudflare Functions. They are configured in:

- **Local development:** `.env` file (not committed)
- **Cloudflare Pages:** `wrangler.toml` under `[vars]` or `[env.production]`/`[env.preview]`
- **Secrets:** Cloudflare Dashboard or `wrangler secret` command (recommended for sensitive values)

| Variable | Required | Default | Secret? | Purpose |
|----------|----------|---------|---------|---------|
| `CLERK_SECRET_KEY` | Yes | - | Yes | Clerk secret key for authentication |
| `CLERK_JWKS_URL` | Yes | - | No | Clerk JWKS URL for JWT validation |
| `REDIRECT_BASE_URL` | Yes | `https://go-dev.inlinkr.com` | No | Base URL for Smart Link redirects |
| `APP_BASE_URL` | Yes | `https://app.inlinkr.com` | No | Base URL for the app |
| `MARKETING_BASE_URL` | Yes | `https://inlinkr.com` | No | Base URL for marketing site |
| `EMAIL_ENABLED` | Yes | `false` | No | Enable email sending |
| `EMAIL_FROM_NAME` | Yes | `InLinkr` | No | Email from name |
| `EMAIL_FROM_ADDRESS` | Yes | `notify@inlinkr.com` | No | Email from address |
| `STRIPE_ENABLED` | Yes | `false` | No | Enable Stripe billing |
| `STRIPE_SECRET_KEY` | No | - | Yes | Stripe secret key |
| `STRIPE_PUBLISHABLE_KEY` | No | - | No | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | No | - | Yes | Stripe webhook secret |
| `PRO_PRICE_ID_MONTHLY` | No | - | No | Stripe Pro monthly price ID |
| `PRO_PRICE_ID_YEARLY` | No | - | No | Stripe Pro yearly price ID |
| `FOUNDER_PRICE_ID` | No | - | No | Stripe Founder price ID |
| `RESEND_API_KEY` | No | - | Yes | Resend API key for email |
| `GOOGLE_OAUTH_CLIENT_ID` | No | - | No | Google OAuth client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | No | - | Yes | Google OAuth client secret |
| `GOOGLE_OAUTH_REDIRECT_URI` | No | - | No | Google OAuth redirect URI |

### D1 Bindings

D1 database bindings are configured in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "tubelinkr-db"
database_id = "7fd2cd09-fafa-496f-8310-a7e86ca5c03c"
```

The same binding is used for both `[env.production]` and `[env.preview]` environments.

## Redirect Architecture

### Development (Current)

- **Redirect domain:** `go-dev.inlinkr.com`
- **Worker:** `inlinkr-go-dev`
- **Database:** `tubelinkr-db`
- **URL format:** `go-dev.inlinkr.com/{public_code}` or `go-dev.inlinkr.com/{username}/{slug}`

### Production (Future)

- **Redirect domain:** `go.inlinkr.com`
- **Worker:** `inlinkr-go`
- **Database:** `inlinkr-prod-db`
- **URL format:** `go.inlinkr.com/{public_code}` or `go.inlinkr.com/{username}/{slug}`
- **Compatibility:** `go.tubelinkr.com` will remain as a fallback alias

### Custom Subdomains

Custom subdomains (e.g., `username.inlinkr.com`) are controlled by the `VITE_ENABLE_CUSTOM_SUBDOMAINS` feature flag:

- **Development:** `false` - All URLs use `go-dev.inlinkr.com`
- **Production:** `true` - Pro/Founder users can use `username.inlinkr.com`

## Clerk Configuration

### Current State

- **Application:** TubeLinkr development app (`.clerk.accounts.dev`)
- **Allowed domains:** `tubelinkr.com`, `www.tubelinkr.com`
- **Auth URLs:** Point to `tubelinkr.com`

### Required for InLinkr Production

- **New application:** Production Clerk app
- **Allowed domains:** `app.inlinkr.com`, `localhost` (for development)
- **Auth URLs:** Point to `app.inlinkr.com/login` and `app.inlinkr.com/signup`

## Deployment Architecture

### Local Development

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and fill in values
3. Run dev server: `npm run dev`
4. Access at `http://localhost:5173`

### Cloudflare Pages Deployment

1. Push to `main` branch
2. Cloudflare automatically builds and deploys
3. Build command: `npm run build`
4. Output directory: `dist`
5. Environment variables from `wrangler.toml`

### Worker Deployment

Workers are deployed separately using Wrangler:

```bash
npx wrangler deploy worker.js --name inlinkr-go-dev
```

## How Development Differs from Future Production

| Aspect | Development | Production |
|--------|-------------|------------|
| App domain | `app.inlinkr.com` | `app.inlinkr.com` |
| Redirect domain | `go-dev.inlinkr.com` | `go.inlinkr.com` |
| Database | `tubelinkr-db` | `inlinkr-prod-db` |
| Custom subdomains | Disabled | Enabled for Pro/Founder |
| Clerk app | Development | Production |
| Stripe | Test mode | Live mode |
| Email | Disabled or test | Enabled |

## Cloudflare Pages Configuration

The `wrangler.toml` file configures:

- **Project name:** `tubelinkr` (legacy name, will be renamed to `inlinkr-platform`)
- **Build output:** `dist`
- **D1 binding:** `DB` → `tubelinkr-db`
- **Environment variables:** Frontend and backend variables
- **Rate limiting:** `RATE_LIMITER` binding (currently unused)

## Troubleshooting

### Build Fails

- Check `wrangler.toml` syntax with `npx wrangler pages dev dist`
- Verify all required environment variables are set
- Check D1 database binding is correct

### Functions Fail

- Verify import paths in Functions (use `../../lib/config.js` not `../lib/config.js`)
- Check that `functions/lib/config.js` exists (not `.ts`)
- Verify environment variables are accessible in Functions

### URLs Generate Wrong Domain

- Check `VITE_REDIRECT_BASE_URL` in `wrangler.toml`
- Verify `VITE_ENABLE_CUSTOM_SUBDOMAINS` is set correctly
- Check `src/lib/smart-link-url.ts` is using centralized builder

### Clerk Auth Fails

- Verify `VITE_CLERK_PUBLISHABLE_KEY` is set
- Check Clerk allowed domains include your domain
- Verify `CLERK_SECRET_KEY` is set for Functions
