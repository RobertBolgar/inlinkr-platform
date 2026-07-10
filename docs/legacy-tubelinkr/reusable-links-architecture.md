> Legacy TubeLinkr reference only.
> This document exists to preserve historical implementation details.
> New platform work should follow the InLinkr documentation.

# TubeLinkr Reusable Link System Audit

## 1. Current Architecture Map

**Database Schema:**

- **users**: id, email, username, subdomain, clerk_user_id, first_name, plan, subscription_status, referral fields, founder access
- **links**: id, user_id, slug, original_url, title, subtitle, video_id (nullable), placement_count, is_system, is_active, created_at, updated_at
- **placements**: id, link_id, name, type (description/pinned/bio/short/video/other), source_code, public_code, created_at, updated_at
- **click_events**: id, link_id, timestamp, referrer, user_agent, ip_hash, source
- **proof_shares**: id, public_token, user_id, link_id (nullable), youtube_video_id, title, snapshot fields, is_enabled, created_at, last_viewed_at
- **proof_share_events**: id, proof_share_id, event_type, created_at, referrer, user_agent, ip_hash
- **youtube_connections**: id, user_id, youtube_channel_id, access_token, refresh_token, token_expires_at, connected_at, is_active

**Key Relationships:**
- user → links (1:many)
- link → placements (1:many)
- link → click_events (1:many)
- link → proof_shares (1:many, link_id nullable)
- proof_share → proof_share_events (1:many)

## 2. Redirect Flow Map

**URL Patterns (worker.js):**
- `go.tubelinkr.com/{username}/{slug}` → base link redirect
- `go.tubelinkr.com/{username}/{slug}/{public_code}` → placement-specific redirect
- `{subdomain}.tubelinkr.com/{slug}` → branded subdomain base link
- `{subdomain}.tubelinkr.com/{slug}/{public_code}` → branded subdomain placement link

**Worker Resolution Logic:**
1. Parse hostname → extract subdomain or detect "go"
2. For go.tubelinkr.com: lookup user by username
3. For branded subdomains: lookup user by subdomain, verify Pro access
4. Resolve link by user_id + slug
5. If public_code present: lookup placement by link_id + public_code → use placement.source_code
6. Fallback to query param ?source= for backward compatibility
7. Insert click_event with link_id + normalized source
8. 302 redirect to link.original_url

**Critical Constraint:** Worker routes are production-sensitive and hard to test locally.

## 3. Attribution/Data Model Map

**Current Attribution Chain:**
- `links.video_id` → YouTube video attachment (nullable, single video per link)
- `links.original_url` → destination URL (single destination per link)
- `placements.source_code` → internal tracking code (d, p, b, s, v, c1, c2...)
- `placements.public_code` → URL-friendly code for placement URLs
- `click_events.source` → normalized source value (from placement.source_code or query param)
- `proof_shares.youtube_video_id` → proof attachment to video
- `proof_shares.link_id` → proof attachment to link (nullable)
- `proof_shares.snapshot_* fields` → immutable snapshot data

**Analytics Grouping Today:**
- AnalyticsPage groups by video_id (links.video_id)
- Video stats aggregate clicks across all links with same video_id
- Placement breakdown uses placement_map to map source_code → placement name
- ProofsPage groups by youtube_video_id + destination_domain (with fallbacks)

## 4. What Already Supports Reusable Links

**Existing Infrastructure:**
- **Placements table**: Already supports 1:many placements per link (description, pinned, bio, short, video, custom)
- **Placement URLs**: `/username/slug/{public_code}` already works for placement-specific tracking
- **Click events**: Already track source independently of link destination
- **Proof shares**: link_id is nullable, can group by youtube_video_id without specific link
- **Video stats aggregation**: Already aggregates across multiple links per video_id in links.js API

**Foundation Strengths:**
- Clean separation between link (destination) and placement (source)
- Public_code already enables placement-specific URLs
- Source tracking decoupled from link destination
- Proof system already designed for video-level aggregation

## 5. What Blocks Reusable Links

**Current Blockers:**

1. **Single video_id per link**: `links.video_id` is nullable but only stores one video. Reusing a link across 20 videos would require either:
   - Creating 20 duplicate links with same destination but different video_ids (current workaround)
   - Storing multiple video_ids in one link (not supported by current schema)

2. **Frontend assumes 1:1 link:video**: NewLinkPage attaches a single selectedVideoId to the link. No UI for "attach to multiple videos" or "reuse existing link."

3. **Analytics assumes link.video_id exists**: VideoProofModal and AnalyticsPage derive video context from link.video_id. If one link is reused across videos, current analytics would show wrong video attribution.

4. **Proof attachment ambiguity**: proof_shares can have link_id (nullable) or youtube_video_id. If one link is reused across videos, which video does a proof represent? Current proof creation passes youtube_video_id explicitly, but proof display logic assumes single video context.

5. **No link_usage table**: No table to track "this link is used on video X with placement Y." Current model assumes link is the primary entity, not the usage instance.

6. **URL structure assumes link = video**: `/username/slug` implicitly represents "the link for this video." If one slug is reused across 20 videos, the URL alone doesn't indicate which video context applies.

## 6. Recommended Schema Path

**Option A: Add link_usages table (recommended)**

Create new table to separate "link definition" from "link usage":

```sql
CREATE TABLE link_usages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER NOT NULL,
  youtube_video_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE,
  UNIQUE(link_id, youtube_video_id)
);

CREATE INDEX idx_link_usages_link_id ON link_usages(link_id);
CREATE INDEX idx_link_usages_video_id ON link_usages(youtube_video_id);
```

**Migration strategy:**
- Add table as additive change (non-breaking)
- Backfill existing data: for each link with video_id, insert link_usage (link_id, video_id)
- Make links.video_id nullable (already is)
- Gradually migrate frontend to use link_usages for video attachment

**Option B: Evolve placements table (not recommended)**

Could add youtube_video_id to placements, but this conflates "where the link is placed" with "which video the link is attached to." These are different concepts.

**Option C: JSON array in links.video_id (not recommended)**

Would require schema migration to TEXT, parsing complexity, and breaks existing video_id queries.

**Verdict: Option A (new link_usages table) is cleanest separation of concerns.**

## 7. Recommended URL/public_code Strategy

**Keep existing URLs unchanged:**
- `/{username}/{slug}` → base link (destination redirect)
- `/{username}/{slug}/{public_code}` → placement-specific redirect
- `{subdomain}.tubelinkr.com/{slug}` → branded base link
- `{subdomain}.tubelinkr.com/{slug}/{public_code}` → branded placement link

**Add new optional parameter for video context:**
- `/{username}/{slug}?video_id={youtube_video_id}` → indicates which video this usage is for
- OR use new URL pattern: `/{username}/{slug}/v/{youtube_video_id}` → video-specific usage page

**Critical: Do NOT change worker routing behavior.** The worker should continue to resolve by username + slug and redirect to original_url regardless of video context. Video context is for analytics/proof attribution only, not redirect logic.

**Public_code strategy:**
- Keep public_code pointing to placements (source tracking)
- Do NOT overload public_code for video context
- Video context should be separate from placement context

## 8. Backward Compatibility Plan

**Preserve existing live redirects:**
- No changes to worker.js routing logic
- No changes to URL resolution order
- Existing links continue to work exactly as today
- Existing placement URLs continue to work exactly as today

**Preserve existing proof snapshots:**
- proof_shares table already has snapshot_* fields that capture immutable data
- Existing proofs continue to display snapshot data
- New proofs can use snapshot fields for backward-compatible immutable data

**Preserve existing analytics:**
- Keep links.video_id column for backward compatibility
- Analytics queries should check link_usages first, fall back to links.video_id
- Click events with only link_id + source remain valid (source is sufficient for placement analytics)

**Backfill strategy for legacy data:**
- Migration script: For each link where video_id IS NOT NULL, insert into link_usages (link_id, video_id)
- After backfill, links.video_id can be deprecated but not dropped immediately
- Legacy click events without video context remain valid for placement-level analytics

## 9. Safe Phased Implementation Plan

**Phase 1: Schema foundation (additive, zero risk)**
1. Create link_usages table
2. Add backfill migration: copy existing link.video_id → link_usages
3. Add API endpoints for link_usages (CRUD)
4. No frontend changes, no worker changes
5. Test: Verify existing redirects still work, existing analytics unchanged

**Phase 2: API and analytics evolution (low risk)**
1. Update links.js API to return link_usages alongside links
2. Update AnalyticsPage to aggregate clicks by link_usages instead of links.video_id
3. Fallback: if link_usages empty, use links.video_id
4. No worker changes
5. Test: Verify analytics show same data before/after for existing links

**Phase 3: Frontend UI for reusable links (medium risk)**
1. Update NewLinkPage to support "reuse existing link" mode
2. Add UI to select existing link + attach to new video (creates link_usage)
3. Update LinksPage to show which videos each link is used on
4. Update PlacementsPage to show video context per placement
5. No worker changes
6. Test: Verify new flows work, existing flows unchanged

**Phase 4: Proof system evolution (medium risk)**
1. Update proof creation to reference link_usage_id instead of (or in addition to) link_id
2. Update proof display to show video context from link_usage
3. Keep snapshot fields for immutability
4. No worker changes
5. Test: Verify new proofs work, existing proofs unchanged

**Phase 5: Deprecation and cleanup (low risk, deferred)**
1. Mark links.video_id as deprecated in API docs
2. Add migration to set links.video_id = NULL after sufficient time
3. Consider dropping links.video_id column after 6+ months
4. No worker changes ever required

**Rollback plan for each phase:**
- Phase 1: Drop link_usages table (safe, no data loss)
- Phase 2: Revert API changes (analytics falls back to links.video_id)
- Phase 3: Hide "reuse existing link" UI feature flag
- Phase 4: Revert proof changes (existing proofs use snapshot data)
- Phase 5: N/A (cleanup only)

## 10. Production Testing Checklist

**Pre-deployment:**
- [ ] Run schema migration on staging database
- [ ] Verify backfill migration produces correct data
- [ ] Test existing redirect URLs still work (go.tubelinkr.com/*)
- [ ] Test existing placement URLs still work
- [ ] Test existing proof pages still load and display correctly
- [ ] Test analytics page shows same data before/after for existing links
- [ ] Test branded subdomain redirects still work
- [ ] Test Pro access enforcement still works

**Post-deployment monitoring:**
- [ ] Monitor worker error logs for redirect failures
- [ ] Monitor click_event insertion success rate
- [ ] Monitor analytics API response times
- [ ] Monitor proof share creation success rate
- [ ] Compare click counts before/after for sample links
- [ ] Verify new link_usages table is being populated correctly

**Feature flag rollout:**
- [ ] Phase 1: No feature flag needed (additive schema only)
- [ ] Phase 2: Feature flag for new analytics logic
- [ ] Phase 3: Feature flag for "reuse existing link" UI
- [ ] Phase 4: Feature flag for new proof attachment logic
- [ ] Gradual rollout: 10% → 50% → 100% with monitoring at each step

## 11. Risks/Blockers

**Critical risks:**
1. **Worker routing changes**: Any change to worker.js routing logic is high-risk due to production-sensitive redirect behavior. **Mitigation: Never change worker.js routing in this project.**
2. **Analytics divergence**: If new analytics logic produces different results than old logic, users will see confusing data changes. **Mitigation: Extensive A/B testing, fallback logic, gradual rollout.**
3. **Proof data inconsistency**: If proof attachment logic changes, existing proofs might show wrong video context. **Mitigation: Use snapshot fields for immutability, never change existing proof data.**
4. **Backfill data errors**: If backfill migration incorrectly copies video_id to link_usages, analytics could be wrong. **Mitigation: Validate backfill script on staging, compare row counts before/after.**

**Medium risks:**
5. **Frontend confusion**: Users might not understand "reusable link" concept if UI is unclear. **Mitigation: Clear UX copy, progressive disclosure, help docs.
6. **Performance impact**: Additional join to link_usages table could slow analytics queries. **Mitigation: Add indexes, benchmark queries, optimize as needed.
7. **API compatibility**: Third-party integrations (if any) might expect links.video_id to exist. **Mitigation: Keep links.video_id column during deprecation period.

**Low risks:**
8. **Schema migration time**: Large tables could cause migration downtime. **Mitigation: Use additive DDL (CREATE TABLE), avoid ALTER TABLE on large tables.**
9. **Feature flag bugs**: Feature flag logic could have edge cases. **Mitigation: Test flag logic thoroughly, have simple on/off switch.

**Blockers:**
- None identified. All risks are mitigable with careful planning and testing.

## 12. Final Verdict

**Medium refactor**

**Rationale:**
- Requires new table (link_usages) but no breaking changes to existing schema
- Requires API evolution but no worker routing changes (critical constraint)
- Requires frontend UI changes but can be feature-flagged
- Preserves all existing redirects, proofs, and analytics
- Backward-compatible with additive migration strategy
- Can be rolled out incrementally with feature flags

**Not a small change** because:
- New table and migration required
- Frontend UI changes for "reuse existing link" flow
- Analytics logic evolution
- Proof system evolution

**Not a major refactor** because:
- No changes to worker.js routing (highest-risk component)
- No changes to URL structure or public_code strategy
- No breaking changes to existing data
- Existing redirects continue to work unchanged
- Can be rolled back safely at each phase

**Recommended approach:** Implement in 5 phases with feature flags, starting with additive schema changes (Phase 1) and ending with deprecation (Phase 5). Each phase is independently reversible.
