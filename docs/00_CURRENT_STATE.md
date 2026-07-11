# Current State

This document is the source of truth for active environments. It is updated whenever environment resources or rules change.

## TubeLinkr Production

- **Repository:** `RobertBolgar/tubelinkr`
- **Marketing/App domain:** `tubelinkr.com`
- **Pages project:** `tubelinkrgit`
- **Redirect Worker:** `tubelinkr-go`
- **Redirect domain:** `go.tubelinkr.com`
- **Database:** `tubelinkr-prod-db`
- **Status:** `live production`
- **Rule:** Bug fixes only unless explicitly approved

## InLinkr Development

- **Repository:** `RobertBolgar/inlinkr-platform`
- **Marketing domain:** `inlinkr.com`
- **Marketing Pages project:** `inlinkr-home`
- **App domain:** `app.inlinkr.com`
- **App Pages project:** `inlinkr-platform`
- **Redirect Worker:** `inlinkr-go-dev`
- **Redirect domain:** `go-dev.inlinkr.com`
- **Database:** `tubelinkr-db`
- **Status:** `development and migration environment`
- **Note:** Cloudflare labels the `app.inlinkr.com` Pages project as `Production`, but it is not the final InLinkr production environment. This is the development and migration sandbox.

## Environment Rules

- Do not rename either D1 database during migration.
- Do not connect InLinkr development to `tubelinkr-prod-db`.
- Do not change `tubelinkr-go`.
- Do not change `go.tubelinkr.com`.
- The development app and development Worker must point to the same D1 database.
- Migration files, not development data, become the production rollout source of truth.
