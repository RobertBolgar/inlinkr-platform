# InLinkr

InLinkr is a platform for creator-focused internet tools. It powers focused product workspaces — starting with TubeLinkr and QRLinkr — under one account, one billing system, one authentication system, and one analytics engine.

## Repository Status

This repository (`RobertBolgar/inlinkr-platform`) is the InLinkr development workspace. It is currently in the development and migration phase. TubeLinkr production remains untouched and live at `tubelinkr.com`.

## Safety Warning

**Do not connect InLinkr development to `tubelinkr-prod-db`.** Do not change `tubelinkr-go`, `go.tubelinkr.com`, or the `tubelinkr.com` production deployment. All platform work is validated in the InLinkr development environment first.

## Current Environment Summary

- `app.inlinkr.com` — InLinkr development app (Cloudflare Pages project `inlinkr-platform`; currently labeled as Production but intentionally a development environment).
- `go-dev.inlinkr.com` — development redirect domain for the `inlinkr-go-dev` Worker.
- `tubelinkr-db` — development D1 database and shared migration sandbox.
- `tubelinkr.com` / `go.tubelinkr.com` / `tubelinkr-prod-db` — live TubeLinkr production, unchanged.

## Technology Stack

- React + TypeScript + Vite (Cloudflare Pages)
- Cloudflare Pages Functions (`/functions/api`)
- Cloudflare D1 (SQLite)
- Cloudflare Workers (redirect engine)
- Clerk (auth)
- Stripe (billing)
- Resend (email)

## Documentation Reading Order

1. [docs/00_CURRENT_STATE.md](docs/00_CURRENT_STATE.md) — active environments and rules
2. [docs/01_PRODUCT_VISION.md](docs/01_PRODUCT_VISION.md) — what InLinkr is and why
3. [docs/02_PLATFORM_SCHEMA.md](docs/02_PLATFORM_SCHEMA.md) — architecture and schema
4. [docs/03_ROADMAP.md](docs/03_ROADMAP.md) — current roadmap and phases
5. [docs/04_DECISIONS.md](docs/04_DECISIONS.md) — architectural decisions
6. [docs/inlinkr/DEVIN_FLOW.md](docs/inlinkr/DEVIN_FLOW.md) — development-only workflow

## License

MIT
