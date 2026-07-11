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
