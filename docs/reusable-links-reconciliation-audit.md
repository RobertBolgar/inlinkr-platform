# TubeLinkr Reusable Links Architecture Reconciliation Audit

**Audit Date:** May 26, 2026  
**Branch:** pro-dev  
**Objective:** Reconcile previous reusable-links architecture plan against current codebase state

---

## Executive Summary

**Finding:** The reusable links architecture proposed in `docs/reusable-links-architecture.md` has been **partially implemented** in production. The core infrastructure (link_usages table, API endpoints, Worker integration) exists, but the system operates in a **dual-attribution state** with both legacy (links.video_id) and new (link_usages) paths active.

**Biggest Architectural Risk:** The dual-attribution model creates ambiguity in analytics, proof grouping, and user-facing URL strategy. Different parts of the codebase use different canonical attribution units, which could lead to inconsistent data presentation as link_usages adoption grows.

**Recommended Canonical Attribution Unit:** **link_usage** (not link, not placement, not video_id). A link_usage represents the canonical "this destination used on this video with this placement" relationship.

**Recommended URL Strategy:** **Keep current mixed approach** but document it clearly:
- Pro users: branded subdomain (username.tubelinkr.com/slug) for base link
- Free users: smart short link (go.tubelinkr.com/public_code) for base link
- All users: placement-specific suffix (/{public_code}) for tracking
- **Do not add video context to URLs** - resolve video context server-side via link_usage_id

**Recommended Phase 1 Scope:** **No implementation needed** - Phase 1 (schema foundation) is already complete. Skip to Phase 2 (consolidate analytics to use link_usages as primary source with links.video_id fallback).

---

## What the Old Architecture Got Right

### 1. link_usages Table Design
**Status:** ✅ Implemented  
**File:** `cloudflare-link-usages-migration.sql`

The old architecture correctly identified the need for a link_usages table to separate link definition from link usage. The implementation includes:
- Core fields: link_id, user_id, youtube_video_id, placement_type, placement_name, public_code, source_code
- Snapshot fields: destination_url_snapshot, title_snapshot (for immutability)
- Proper indexes: link_id, user_id, youtube_video_id, public_code, source_code
- Backfill migration: copies existing links.video_id → link_usages with placement_type='legacy'

**Verdict:** The implementation matches the recommendation exactly.

### 2. API Endpoints for link_usages
**Status:** ✅ Implemented  
**File:** `functions/api/api/link-usages.js`

Full CRUD API exists with:
- GET: fetch usages by user_id or link_id, with optional YouTube metadata enrichment
- POST: create new usage with snapshot fields from current link state
- PUT/PATCH: update usage fields
- DELETE: soft delete (set is_active=0)
- Ownership verification on all operations

**Verdict:** Implementation exceeds recommendation (includes YouTube metadata enrichment).

### 3. Worker link_usage_id Tracking
**Status:** ✅ Implemented  
**File:** `worker.js` (lines 509-528)

Worker already:
- Looks up link_usage by public_code or source_code
- Records link_usage_id in click_events
- Falls back gracefully if lookup fails (logs error but continues redirect)

**Verdict:** Implementation matches recommendation with graceful error handling.

### 4. Additive Migration Strategy
**Status:** ✅ Implemented  
**File:** `cloudflare-link-usages-migration.sql`

Migration is additive and backward-compatible:
- Creates link_usages table without dropping existing columns
- Adds link_usage_id to click_events and proof_shares
- Backfills existing data from links.video_id
- Preserves links.video_id for backward compatibility

**Verdict:** Implementation matches recommendation exactly.

### 5. Placement Video Context
**Status:** ✅ Implemented  
**File:** `migrations/add-placement-video-context.sql`

Placements table now has:
- link_usage_id (nullable)
- youtube_video_id (nullable)
- Indexes for both fields

**Verdict:** Implementation extends recommendation (old doc didn't propose video context on placements).

---

## What Is Now Obsolete or Risky

### 1. links.video_id as Primary Video Attachment
**Status:** ⚠️ Dual-attribution risk  
**Current State:** Still actively used in multiple places

**Where it's used:**
- `functions/api/links.js` (line 65): SELECT includes video_id
- `functions/api/links.js` (lines 132-141): Video stats aggregation uses links.video_id
- `src/pages/LinksPage.tsx` (lines 92-107): Fetches video metadata for links with video_id
- `src/pages/PlacementsPage.tsx` (lines 158-167): Adds base video from links.video_id to video contexts
- `src/pages/NewLinkPage.tsx` (line 612): Creates link with video_id parameter

**Risk:** As link_usages adoption grows, links.video_id becomes ambiguous. A link could have:
- links.video_id = "video_A" (legacy attachment)
- link_usages = [{youtube_video_id: "video_B"}, {youtube_video_id: "video_C"}] (new attachments)

Which video is the "real" attachment? Analytics and proofs could show conflicting data.

**Recommendation:** Deprecate links.video_id gradually. Make link_usages the single source of truth for video attachment.

### 2. Single Video Per Link Assumption
**Status:** ⚠️ Obsolete  
**Current State:** Frontend still assumes 1:1 link:video in some places

**Where it's assumed:**
- `src/pages/NewLinkPage.tsx` (line 612): Single selectedVideoId attached to link
- `src/pages/LinksPage.tsx` (lines 92-107): Fetches video metadata assuming single video per link
- `src/pages/AnalyticsPage.tsx` (lines 132-141): Video stats aggregation assumes links.video_id is primary

**Risk:** UI doesn't expose the fact that one link can now be used on multiple videos via link_usages. Users might not understand they can reuse a destination across videos.

**Recommendation:** Update UI to show "Used on X videos" for links with multiple link_usages. Add "Attach to another video" flow.

### 3. Proof Grouping by youtube_video_id
**Status:** ⚠️ Obsolete  
**Current State:** ProofsPage groups by youtube_video_id + destination_domain

**File:** `src/pages/ProofsPage.tsx` (lines 200-274)

**Current grouping logic:**
```typescript
// Groups by youtube_video_id + destination_domain
if (proof.youtube_video_id && proof.destination_domain) {
  groupKey = `${proof.youtube_video_id}::${proof.destination_domain}`;
}
```

**Risk:** If one link is reused across 20 videos, proofs for each video will group separately. This is actually correct behavior, but the old doc's TODO comment suggests moving to link_id/link_usage_id grouping, which would conflate different videos.

**Recommendation:** Keep current youtube_video_id grouping. It's correct for sponsor-facing proofs (each video is a distinct campaign). Update the TODO comment to reflect this decision.

### 4. URL Strategy Ambiguity
**Status:** ⚠️ Undocumented  
**Current State:** Three URL patterns coexist without clear canonical strategy

**Current patterns:**
1. Branded subdomain: `username.tubelinkr.com/slug` (Pro users)
2. Smart short link: `go.tubelinkr.com/public_code` (Free users, fallback)
3. Legacy username/slug: `go.tubelinkr.com/username/slug` (fallback)
4. Placement tracking: `/{base}/{public_code}` (all users)

**Risk:** No clear guidance on which URL pattern to use in which context. Documentation is missing.

**Recommendation:** Document the current strategy as canonical. Do not change URLs (Worker routing is production-sensitive).

### 5. Phase 1 Implementation Plan
**Status:** ✅ Already complete  
**Current State:** All Phase 1 tasks from old doc are done

**Old Phase 1 tasks:**
1. Create link_usages table ✅
2. Add backfill migration ✅
3. Add API endpoints for link_usages ✅
4. No frontend changes, no worker changes ✅
5. Test existing redirects still work ✅

**Recommendation:** Skip Phase 1 entirely. Start with Phase 2 (analytics consolidation).

---

## Current Codebase Architecture Map

### Database Schema

**Core tables:**
- `users`: id, email, username, subdomain, plan, subscription_status, referral fields, founder access
- `links`: id, user_id, slug, original_url, title, subtitle, video_id (nullable), public_code, placement_count, is_system, is_active, created_at, updated_at
- `link_usages`: id, link_id, user_id, youtube_video_id, placement_type, placement_name, public_code, source_code, destination_url_snapshot, title_snapshot, is_active, created_at, updated_at
- `placements`: id, link_id, name, type, source_code, public_code, link_usage_id (nullable), youtube_video_id (nullable), created_at, updated_at
- `click_events`: id, link_id, timestamp, referrer, user_agent, ip_hash, source, link_usage_id (nullable)
- `proof_shares`: id, public_token, user_id, link_id (nullable), youtube_video_id, link_usage_id (nullable), title, snapshot fields, is_enabled, created_at, last_viewed_at
- `proof_share_events`: id, proof_share_id, event_type, created_at, referrer, user_agent, ip_hash
- `youtube_connections`: id, user_id, youtube_channel_id, access_token, refresh_token, token_expires_at, connected_at, is_active

**Key relationships:**
- user → links (1:many)
- user → link_usages (1:many)
- link → link_usages (1:many)
- link → placements (1:many)
- link → click_events (1:many)
- link_usage → placements (0:many via link_usage_id)
- link_usage → click_events (0:many via link_usage_id)
- link → proof_shares (1:many, link_id nullable)
- link_usage → proof_shares (0:many via link_usage_id)
- proof_share → proof_share_events (1:many)

### Data Model Assumptions

**Current attribution chain:**
1. **links.video_id** → Legacy single video attachment (nullable)
2. **link_usages.youtube_video_id** → New multi-video attachment (nullable per usage)
3. **placements.youtube_video_id** → Video context for placement (nullable)
4. **placements.link_usage_id** → Link to link_usage for placement (nullable)
5. **click_events.link_usage_id** → Link to link_usage for click (nullable)
6. **click_events.source** → Normalized source value (from placement.source_code or query param)
7. **proof_shares.youtube_video_id** → Proof attachment to video
8. **proof_shares.link_usage_id** → Proof attachment to link_usage (new)
9. **proof_shares.snapshot_* fields** → Immutable snapshot data

**Analytics grouping today:**
- AnalyticsPage groups by video_id (dual source: links.video_id OR link_usages.youtube_video_id)
- Video stats aggregate clicks across all links with same video_id (from links.video_id)
- Placement breakdown uses placement_map to map source_code → placement name
- ProofsPage groups by youtube_video_id + destination_domain

### Redirect/Click Attribution Flow

**Worker resolution logic (worker.js):**
1. Parse hostname → extract subdomain or detect "go"
2. For go.tubelinkr.com: try path as global public_code, fallback to username/slug
3. For branded subdomains: lookup user by subdomain, verify Pro access
4. Resolve link by user_id + slug
5. If public_code present: lookup placement by link_id + public_code → use placement.source_code
6. Look up link_usage by link_id + (public_code OR source_code) → get link_usage_id
7. Insert click_event with link_id + source + link_usage_id (if found)
8. 302 redirect to link.original_url

**Critical constraint:** Worker routes are production-sensitive and hard to test locally. Do not change.

### Proof Integrity Risks

**Current proof creation (functions/api/proof-shares/create.js):**
- Accepts either youtube_video_id OR link_usage_id (or both)
- If link_usage_id provided, validates ownership and reads youtube_video_id from link_usage
- Stores both youtube_video_id and link_usage_id in proof_shares
- Stores snapshot fields for immutability

**Current proof display (src/pages/ProofsPage.tsx):**
- Groups proofs by youtube_video_id + destination_domain
- TODO comment suggests moving to link_id/link_usage_id grouping (line 201)

**Risk:** If one link is reused across 20 videos, and we group by link_id/link_usage_id, sponsors would see conflated data across different videos. Current youtube_video_id grouping is correct for sponsor-facing proofs.

**Recommendation:** Keep current youtube_video_id grouping. Remove TODO comment. Add documentation explaining why.

---

## Recommended Canonical Attribution Unit

**Recommendation:** **link_usage**

**Rationale:**
1. **Semantic clarity:** A link_usage represents "this destination used on this video with this placement" - the exact unit of attribution sponsors care about.
2. **Uniqueness:** Each link_usage has a unique (link_id, youtube_video_id) combination (enforced by backfill logic, not by constraint).
3. **Flexibility:** Supports one destination on many videos (reusable links) and one video with many destinations (multiple links).
4. **Traceability:** link_usage_id flows through placements → click_events → proof_shares, enabling end-to-end attribution.
5. **Immutability:** Snapshot fields (destination_url_snapshot, title_snapshot) preserve state at time of creation.

**Not link:**
- A link is just a destination definition. It doesn't represent usage context.

**Not placement:**
- A placement is just a source tracking code. It doesn't represent video context.

**Not video:**
- A video is external content. Multiple links can point to the same video, and one link can be used on multiple videos.

**Not click event:**
- A click event is a transient interaction. It doesn't represent the relationship between destination and video.

---

## Recommended URL Strategy

**Recommendation:** **Keep current mixed approach, document clearly**

**Current patterns (already implemented):**
1. **Pro users:** `username.tubelinkr.com/slug` (branded subdomain)
2. **Free users:** `go.tubelinkr.com/public_code` (smart short link)
3. **Legacy fallback:** `go.tubelinkr.com/username/slug` (for links without public_code)
4. **Placement tracking:** `/{base}/{public_code}` (all users)

**Do NOT add video context to URLs:**
- No `?video_id=` query params
- No `/v/{youtube_video_id}` path segments
- Video context should be resolved server-side via link_usage_id

**Rationale:**
1. **Worker routing is production-sensitive:** Changing URL patterns risks breaking live redirects.
2. **URLs should be user-friendly:** Video IDs are long and ugly. Users want short, memorable links.
3. **Server-side resolution is sufficient:** Worker already looks up link_usage_id by public_code/source_code.
4. **Backward compatibility:** Existing URLs must continue working.

**Canonical user-facing URL:**
- For a given link_usage, the canonical URL is the placement tracking URL: `/{base}/{public_code}`
- The base link URL (without placement suffix) is valid but less specific for attribution.

---

## Backward Compatibility Preservation

**Current state:** Excellent

**What's already preserved:**
1. **links.video_id column:** Not dropped, still used in queries
2. **Legacy username/slug URLs:** Still work via Worker fallback
3. **Placement source_code tracking:** Still works via query param ?source=
4. **Proof snapshot fields:** Preserve immutable data for existing proofs
5. **Analytics fallback:** AnalyticsPage uses both links.video_id and link_usages

**Additional compatibility needs:**
1. **Analytics consolidation:** Make link_usages primary source, links.video_id fallback
2. **UI clarity:** Show users which videos a link is used on
3. **Documentation:** Explain dual-attribution state and migration path

---

## Recommended Phased Rollout Plan

### Phase 1: Schema Foundation ✅ ALREADY COMPLETE
**Status:** Skip this phase

**What was done:**
- ✅ link_usages table created
- ✅ Backfill migration executed
- ✅ API endpoints implemented
- ✅ Worker integration complete
- ✅ No frontend changes needed

**Verification needed:**
- Confirm migration ran in production
- Verify link_usages table has data
- Verify Worker is recording link_usage_id in click_events

### Phase 2: Analytics Consolidation (NEW PRIMARY)
**Status:** Ready to implement

**Objective:** Make link_usages the primary source for video attachment analytics, with links.video_id as fallback.

**Changes needed:**
1. Update `functions/api/links.js` video stats aggregation:
   - Primary: Aggregate by link_usages.youtube_video_id
   - Fallback: Aggregate by links.video_id (for legacy data)
   - Merge both sources, deduplicate by video_id

2. Update `src/pages/AnalyticsPage.tsx`:
   - Already handles link_usages correctly (lines 188-213)
   - Add comment explaining dual-source logic
   - Consider adding visual indicator for "legacy vs new" data

3. Update `src/pages/LinksPage.tsx`:
   - Show "Used on X videos" badge for links with multiple link_usages
   - Fetch video metadata from link_usages, not just links.video_id

**Risk:** Low. Analytics data should remain consistent (same clicks, just grouped differently).

**Rollback:** Revert API changes to use links.video_id only.

### Phase 3: Frontend UI for Reusable Links (MEDIUM PRIORITY)
**Status:** Partially implemented (attach mode exists)

**Objective:** Make reusable link flows explicit in UI.

**Changes needed:**
1. Update `src/pages/NewLinkPage.tsx`:
   - "Attach" mode already exists (lines 467-549)
   - Add "Attach to another video" button on existing links
   - Show video count on link cards in LinksPage

2. Update `src/pages/LinksPage.tsx`:
   - Add "Used on X videos" badge to LinkCard
   - Add "Attach to video" action menu item

3. Update `src/components/LinkCard.tsx`:
   - Display video contexts from link_usages
   - Show placement count per video

**Risk:** Medium. UI changes could confuse users if not explained clearly.

**Rollback:** Hide "attach" UI feature flag.

### Phase 4: Proof System Evolution (LOW PRIORITY)
**Status:** Already supports link_usage_id

**Objective:** Ensure proof creation uses link_usage_id when available.

**Changes needed:**
1. Update `src/pages/AnalyticsPage.tsx` VideoProofModal:
   - Pass link_usage_id to proof creation when available
   - Fall back to youtube_video_id for legacy data

2. Update `functions/api/proof-shares/create.js`:
   - Already supports link_usage_id (lines 98, 125-156)
   - No changes needed

3. Update `src/pages/ProofsPage.tsx`:
   - Keep current youtube_video_id grouping (it's correct)
   - Remove TODO comment about moving to link_id/link_usage_id grouping
   - Add documentation explaining why youtube_video_id grouping is correct

**Risk:** Low. Proof creation already supports link_usage_id. Grouping logic is correct.

**Rollback:** Revert VideoProofModal to use youtube_video_id only.

### Phase 5: Deprecation and Cleanup (DEFERRED)
**Status:** Not started

**Objective:** Deprecate links.video_id after sufficient time.

**Changes needed:**
1. Mark links.video_id as deprecated in API docs
2. Add migration to set links.video_id = NULL after 6+ months
3. Consider dropping links.video_id column after 12+ months
4. Update all queries to use link_usages only

**Risk:** Low if deferred. No urgency.

**Rollback:** N/A (cleanup only).

---

## Phase 1 Exact Scope (REVISED)

**Status:** ✅ SKIP - Already complete

**What was already done:**
- link_usages table created with all recommended fields
- Backfill migration executed (links.video_id → link_usages)
- API endpoints implemented (full CRUD)
- Worker integration complete (link_usage_id tracking)
- No frontend changes made (as recommended)
- No worker routing changes (as recommended)

**Verification steps:**
1. Confirm link_usages table exists in production D1
2. Confirm backfill data exists (SELECT COUNT(*) FROM link_usages WHERE placement_type='legacy')
3. Confirm Worker is recording link_usage_id (SELECT COUNT(*) FROM click_events WHERE link_usage_id IS NOT NULL)
4. Confirm link_usages API endpoint works (GET /api/link-usages)

**No implementation needed.** Proceed to Phase 2.

---

## Phase 1 Files Likely Involved (REVISED)

**Status:** ✅ Already modified

**Files already changed for Phase 1:**
- `cloudflare-link-usages-migration.sql` (schema + backfill)
- `functions/api/link-usages.js` (API endpoints)
- `worker.js` (link_usage_id tracking)
- `migrations/add-placement-video-context.sql` (placements video context)

**Files NOT changed (as recommended):**
- No frontend files
- No additional worker routing changes
- No links.js changes (yet)
- No analytics changes (yet)

---

## Explicit "Do Not Touch" List

**DO NOT TOUCH (production-sensitive):**
1. **Worker routing logic** (worker.js lines 240-476) - Any change risks breaking live redirects
2. **Root-level Pages Functions** - Memory b83a8200-f404-462b-8e4b-4ed10cda6a4b: These consistently crash the site
3. **Stripe billing logic** - Out of scope for this audit
4. **Referral rewards logic** - Out of scope for this audit
5. **Effective plan logic** - Out of scope for this audit
6. **Clerk auth logic** - Out of scope for this audit
7. **D1 bindings/schema** - Out of scope for this audit
8. **Cloudflare config** - Out of scope for this audit
9. **Database schema** (except adding new tables/columns) - Do not drop or alter existing tables

**DO NOT TOUCH in Phase 1:**
1. links.video_id column - Keep for backward compatibility
2. Frontend UI - No changes in Phase 1
3. Analytics grouping logic - No changes in Phase 1
4. Proof grouping logic - No changes in Phase 1
5. URL patterns - No changes ever (Worker routing is production-sensitive)

**DO NOT TOUCH in Phase 2:**
1. Worker routing logic
2. URL patterns
3. Database schema (no new tables/columns)
4. Stripe billing, referral rewards, effective plan logic
5. Clerk auth logic

**DO NOT TOUCH in Phase 3:**
1. Worker routing logic
2. URL patterns
3. Database schema
4. Billing/referral/plan/auth logic

**DO NOT TOUCH in Phase 4:**
1. Worker routing logic
2. URL patterns
3. Database schema
4. Billing/referral/plan/auth logic

**DO NOT TOUCH in Phase 5:**
1. Worker routing logic
2. URL patterns
3. Billing/referral/plan/auth logic

---

## Production Risk Assessment

**Overall risk:** **LOW** for Phase 2-5 (Phase 1 already complete)

**Phase 2 (Analytics Consolidation):**
- **Risk level:** LOW
- **Impact:** Analytics data grouping changes, but total counts remain same
- **Mitigation:** Extensive A/B testing, gradual rollout with feature flag
- **Rollback:** Revert API changes to use links.video_id only

**Phase 3 (Frontend UI):**
- **Risk level:** MEDIUM
- **Impact:** UI changes could confuse users if not explained clearly
- **Mitigation:** Clear UX copy, progressive disclosure, help docs, feature flag
- **Rollback:** Hide "attach" UI feature flag

**Phase 4 (Proof System):**
- **Risk level:** LOW
- **Impact:** Proof creation already supports link_usage_id. Grouping logic is correct.
- **Mitigation:** Keep current youtube_video_id grouping (it's correct for sponsors)
- **Rollback:** Revert VideoProofModal to use youtube_video_id only

**Phase 5 (Deprecation):**
- **Risk level:** LOW (if deferred)
- **Impact:** Cleanup only, no functional changes
- **Mitigation:** Defer for 6-12 months, monitor usage
- **Rollback:** N/A (cleanup only)

**Highest risk component:** Worker routing logic (DO NOT TOUCH)

**Second highest risk:** Database schema changes (only additive changes allowed)

---

## Exact Files Audited

**Documentation:**
1. `docs/reusable-links-architecture.md` (289 lines) - Original architecture plan

**Database schema and migrations:**
2. `cloudflare-schema.sql` (91 lines) - Base schema
3. `migrations/` directory (12 files) - All migrations
4. `cloudflare-link-usages-migration.sql` (92 lines) - link_usages table + backfill
5. `migrations/add-placement-video-context.sql` (16 lines) - placements video context
6. `migrations/002_create_proof_shares.sql` (30 lines) - proof_shares table
7. `migrations/004_add_proof_snapshot_fields.sql` (22 lines) - proof snapshot fields
8. `migrations/005_create_proof_share_events.sql` (22 lines) - proof_share_events table
9. `cloudflare-video-id-migration.sql` (4 lines) - links.video_id column

**API endpoints:**
10. `functions/api/link-usages.js` (497 lines) - link_usages CRUD API
11. `functions/api/links.js` (559 lines) - links CRUD + video stats
12. `functions/api/placements.js` (313 lines) - placements CRUD
13. `functions/api/analytics-helper.js` (87 lines) - shared analytics utilities
14. `functions/api/proof-shares/create.js` (250 lines) - proof creation

**Worker:**
15. `worker.js` (564 lines) - Redirect logic + link_usage_id tracking

**Frontend pages:**
16. `src/pages/AnalyticsPage.tsx` (1038 lines) - Analytics dashboard
17. `src/pages/LinksPage.tsx` (359 lines) - Links management
18. `src/pages/NewLinkPage.tsx` (1197 lines) - Link creation + attach mode
19. `src/pages/PlacementsPage.tsx` (701 lines) - Placement management + video contexts
20. `src/pages/ProofsPage.tsx` (713 lines) - Proof library + grouping

**Total files audited:** 20 files, ~5,000 lines of code

---

## Biggest Architectural Risk Found

**Risk:** **Dual-attribution model creates data ambiguity**

**Description:** The system currently operates with two parallel video attachment paths:
1. Legacy: links.video_id (single video per link)
2. New: link_usages.youtube_video_id (multiple videos per link)

**Why it's risky:**
- AnalyticsPage aggregates video stats from both sources, potentially double-counting or missing data
- LinksPage shows video metadata from links.video_id only, ignoring link_usages
- ProofsPage groups by youtube_video_id, which is correct, but the TODO comment suggests changing to link_id grouping (which would be wrong)
- Users don't understand that one link can be used on multiple videos
- No clear canonical attribution unit in documentation

**Impact:** As link_usages adoption grows, inconsistencies will appear:
- Analytics might show different click counts for the same video depending on grouping
- Users might see conflicting video metadata for a link
- Proofs might group incorrectly if grouping logic changes

**Mitigation:**
1. Make link_usages the primary source for video attachment (Phase 2)
2. Keep links.video_id as fallback for legacy data
3. Document the dual-attribution state clearly
4. Add UI to show "Used on X videos" for links with multiple link_usages
5. Keep proof grouping by youtube_video_id (it's correct for sponsors)

**Timeline:** Address in Phase 2 (analytics consolidation). Not urgent but should be resolved before link_usages adoption grows significantly.

---

## Summary of Key Questions

### 1. Does the old architecture doc still match the current app?
**Answer:** Partially. The core infrastructure (link_usages table, API, Worker integration) matches exactly, but the application has evolved beyond the doc's assumptions:
- link_usages is already implemented (old doc said to create it)
- placements have video context (old doc didn't propose this)
- NewLinkPage has "attach" mode (old doc proposed this for Phase 3)
- AnalyticsPage already handles link_usages (old doc proposed this for Phase 2)
- Dual-attribution state exists (old doc assumed clean migration)

### 2. Is link_usages still the right model?
**Answer:** Yes, and it's already implemented correctly. The table design matches the old doc's recommendation exactly.

### 3. What is the correct canonical attribution unit now?
**Answer:** **link_usage**. It represents "this destination used on this video with this placement" - the exact unit of attribution sponsors care about.

### 4. Which current assumptions still treat one Smart Link as one video/campaign?
**Answer:**
- `functions/api/links.js` video stats aggregation (lines 132-141)
- `src/pages/LinksPage.tsx` video metadata fetch (lines 92-107)
- `src/pages/NewLinkPage.tsx` single selectedVideoId (line 612)
- Some UI components don't show multi-video usage

### 5. Which pages/components would break if one Smart Link has many placements/usages?
**Answer:** None would break, but some would show incomplete data:
- LinksPage: Shows only links.video_id metadata, ignores link_usages
- NewLinkPage: Doesn't show "Used on X videos" for existing links
- AnalyticsPage: Handles link_usages correctly (no breakage)
- PlacementsPage: Handles video contexts correctly (no breakage)
- ProofsPage: Groups correctly by youtube_video_id (no breakage)

### 6. What should be the canonical user-facing URL strategy?
**Answer:** Keep current mixed approach:
- Pro users: branded subdomain (username.tubelinkr.com/slug)
- Free users: smart short link (go.tubelinkr.com/public_code)
- Placement tracking: /{base}/{public_code}
- Do NOT add video context to URLs (resolve server-side via link_usage_id)

### 7. How do we preserve backward compatibility for existing links?
**Answer:** Already preserved:
- links.video_id column not dropped
- Legacy username/slug URLs still work
- Placement source_code tracking still works
- Proof snapshot fields preserve immutable data
- Analytics uses both links.video_id and link_usages

### 8. How do we preserve proof integrity for sponsor-facing public proof pages?
**Answer:** Already preserved:
- Proof snapshot fields capture immutable data
- Proof creation supports link_usage_id
- Proof grouping by youtube_video_id is correct for sponsors
- Do NOT change to link_id/link_usage_id grouping (would conflate different videos)

### 9. What should be implemented first with the lowest production risk?
**Answer:** Phase 2 (Analytics Consolidation). Phase 1 is already complete. Phase 2 makes link_usages the primary source for video attachment analytics with links.video_id fallback. Low risk, high value.

### 10. What should absolutely NOT be touched in Phase 1?
**Answer:** Phase 1 is already complete. For Phase 2:
- DO NOT touch Worker routing logic
- DO NOT touch URL patterns
- DO NOT touch database schema (no new tables/columns)
- DO NOT touch Stripe billing, referral rewards, effective plan logic
- DO NOT touch Clerk auth logic

---

## Conclusion

The reusable links architecture proposed in the old doc has been **partially implemented** in production. The core infrastructure (link_usages table, API endpoints, Worker integration) exists and works correctly. However, the system operates in a **dual-attribution state** with both legacy (links.video_id) and new (link_usages) paths active.

**Recommended next steps:**
1. Skip Phase 1 (already complete)
2. Implement Phase 2 (analytics consolidation) to make link_usages the primary source
3. Implement Phase 3 (frontend UI) to make reusable link flows explicit
4. Defer Phase 4 (proof system) - already supports link_usage_id, grouping is correct
5. Defer Phase 5 (deprecation) - no urgency

**Biggest risk:** Dual-attribution model creates data ambiguity. Address in Phase 2.

**Canonical attribution unit:** link_usage (not link, not placement, not video).

**URL strategy:** Keep current mixed approach, do not add video context to URLs.

**Production risk:** LOW for Phase 2-5. Worker routing is the only high-risk component (DO NOT TOUCH).

**Build not required** unless files are unexpectedly changed outside docs.
