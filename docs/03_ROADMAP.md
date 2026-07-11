# InLinkr Roadmap

This roadmap is a living document. Completed items are checked. Active, future, and blocked items are unchecked and labeled.

## Completed ✅

- [x] Domain acquired
- [x] Gmail created
- [x] GitHub repo created
- [x] TubeLinkr cloned safely
- [x] Cloudflare Pages projects created
- [x] inlinkr.com live
- [x] app.inlinkr.com live
- [x] go-dev.inlinkr.com live
- [x] tubelinkr-db assigned to InLinkr development
- [x] Documentation reorganized
- [x] Product vision completed
- [x] Platform schema completed
- [x] Development auth created
- [x] TubeLinkr production left untouched

---

## Phase 1 — Finish development lane (Active)

- [ ] Verify app DB binding
- [ ] Verify Worker DB binding
- [ ] Centralize redirect base URL
- [ ] Use `go-dev.inlinkr.com` for InLinkr-generated links
- [ ] Test link creation
- [ ] Test redirects
- [ ] Test click recording
- [ ] Test placement attribution
- [ ] Test analytics display
- [ ] Version-control the development Worker code

---

## Phase 2 — Platform metadata schema (Future)

- [ ] Backup development D1
- [ ] Create additive migration
- [ ] Create `products`
- [ ] Create `user_products`
- [ ] Create `plans`
- [ ] Create `subscriptions`
- [ ] Create `profiles`
- [ ] Seed TubeLinkr and QRLinkr
- [ ] Backfill existing development users as TubeLinkr users
- [ ] Verify existing TubeLinkr development functionality remains intact

---

## Phase 3 — Platform shell (Future)

- [ ] Build InLinkr Home launcher
- [ ] Add product registry
- [ ] Add product switcher
- [ ] Add shared account settings
- [ ] Preserve TubeLinkr workspace experience
- [ ] Do not create one giant dashboard

---

## Phase 4 — TubeLinkr workspace (Future)

- [ ] Isolate TubeLinkr routes
- [ ] Preserve current UI and behavior
- [ ] Make redirects use environment-specific base URL
- [ ] Verify YouTube OAuth
- [ ] Verify analytics
- [ ] Verify Traffic Proof
- [ ] Verify referrals
- [ ] Verify billing behavior

---

## Phase 5 — QRLinkr workspace (Future)

- [ ] QR dashboard
- [ ] QR creation
- [ ] PNG/SVG download
- [ ] Static QR
- [ ] Smart QR
- [ ] Scan analytics
- [ ] Campaign contexts
- [ ] QRLinkr-specific branding and onboarding

---

## Phase 6 — Shared auth and billing (Future)

- [ ] Create final InLinkr Clerk application/configuration
- [ ] Restore real authentication
- [ ] Verify sign-in and sign-up
- [ ] Generalize Stripe checkout by product
- [ ] Introduce product-scoped entitlements
- [ ] Preserve founder and referral access

---

## Phase 7 — Production validation and cutover (Future)

- [ ] Freeze migrations
- [ ] Backup production
- [ ] Apply tested migrations
- [ ] Deploy production InLinkr redirect Worker
- [ ] Configure `go.inlinkr.com`
- [ ] Preserve `go.tubelinkr.com` compatibility
- [ ] Migrate TubeLinkr login/signup only after validation
- [ ] Rollback plan
- [ ] Final production smoke tests

---

## Status Legend

- **Active** — currently in progress.
- **Future** — planned, dependencies not yet complete.
- **Blocked** — waiting on an external decision or dependency.
- **Completed ✅** — done and verified.

No items are currently blocked.

## Long-Term Goals

- One account.
- Many products.
- Shared infrastructure.
- Independent experiences.
- Platform-powered growth.