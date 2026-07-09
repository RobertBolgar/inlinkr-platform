# Legacy Attribution Consolidation Plan

**Audit Date:** May 26, 2026  
**Branch:** pro-dev  
**Objective:** Safely migrate from dual-attribution model (links.video_id + link_usages.youtube_video_id) to single-source-of-truth (link_usages)

---

## Executive Summary

**Finding:** The codebase operates in a **dual-attribution state** where both `links.video_id` (legacy) and `link_usages.youtube_video_id` (modern) are treated as authoritative in different parts of the system. This creates ambiguity and potential data inconsistency as link_usages adoption grows.

**Biggest Ambiguity:** Analytics video stats aggregation in `functions/api/links.js` (lines 132-141) uses `links.video_id` as the PRIMARY source for video statistics, while `link_usages.youtube_video_id` is used only for YouTube metadata enrichment. This means if a link has both `links.video_id = "video_A"` and `link_usages = [{youtube_video_id: "video_B"}]`, the analytics will show stats for "video_A" even though clicks are being attributed to "video_B" via link_usage_id.

**Recommended First Implementation Step:** **Consolidate analytics aggregation in `functions/api/links.js`** to use `link_usages.youtube_video_id` as the primary source for video statistics, with `links.video_id` as a fallback for legacy data. This is the safest first step because:
1. It's a single, isolated change
2. It doesn't affect Worker routing (production-sensitive)
3. It doesn't require schema changes
4. It can be easily rolled back
5. It directly addresses the biggest ambiguity

**Most Dangerous UI Assumption:** `src/pages/LinksPage.tsx` (lines 92-107) fetches video metadata only from `links.video_id`, completely ignoring `link_usages`. This means users won't see video thumbnails/titles for links that only have link_usages (no links.video_id). This could confuse users as they migrate to the new model.

**Most Dangerous Analytics Assumption:** `functions/api/links.js` (lines 132-141) aggregates video stats using `links.video_id` as the primary source. This is the core source of dual-attribution ambiguity and will cause incorrect analytics as link_usages adoption grows.

**Worker Support:** **YES** - Worker already supports the migration cleanly. Worker tracks `link_usage_id` in click_events (line 540) and doesn't use `links.video_id` for any routing logic. The Worker is already link_usage-aware.

---

## Exact Code Locations: links.video_id Usage

### Authoritative Source (treated as primary):

**API Endpoints:**
1. `functions/api/links.js` line 65: SELECT includes video_id
   - **Classification:** SAFE legacy compatibility
   - **Risk:** Low - just selecting the column

2. `functions/api/links.js` lines 132-141: Video stats aggregation uses links.video_id
   - **Classification:** DANGEROUS AMBIGUITY
   - **Risk:** HIGH - This is the primary source of dual-attribution conflict
   - **Code:**
   ```javascript
   // Aggregate video stats (preserves existing behavior using links.video_id)
   const videoStatsMap = new Map();
   for (const link of linksWithUsages) {
     if (link.video_id) {
       const existing = videoStatsMap.get(link.video_id) || { video_id: link.video_id, total_clicks: 0, link_count: 0 };
       existing.total_clicks += link.clicks;
       existing.link_count += 1;
       videoStatsMap.set(link.video_id, existing);
     }
   }
   ```

3. `functions/api/links.js` line 329: POST accepts video_id
   - **Classification:** TRANSITIONAL DUPLICATION
   - **Risk:** MEDIUM - Creates new links with legacy attachment

4. `functions/api/links.js` line 397: INSERT includes video_id
   - **Classification:** TRANSITIONAL DUPLICATION
   - **Risk:** MEDIUM - Stores legacy attachment

5. `functions/api/links.js` line 452: PUT accepts video_id
   - **Classification:** TRANSITIONAL DUPLICATION
   - **Risk:** MEDIUM - Updates legacy attachment

6. `functions/api/links.js` lines 492-494: UPDATE video_id
   - **Classification:** TRANSITIONAL DUPLICATION
   - **Risk:** MEDIUM - Updates legacy attachment

7. `functions/api/links/[id].js` line 47: Enrich with metadata if link.video_id exists
   - **Classification:** SAFE legacy compatibility
   - **Risk:** Low - only enriches if video_id exists

8. `functions/api/links/[id].js` lines 226-228: UPDATE video_id
   - **Classification:** TRANSITIONAL DUPLICATION
   - **Risk:** MEDIUM - Updates legacy attachment

9. `functions/api/public-links-by-subdomain.js` line 53: SELECT includes video_id
   - **Classification:** SAFE legacy compatibility
   - **Risk:** Low - just selecting the column

10. `functions/api/public-links-by-subdomain.js` lines 138-144: Fetch video metadata for links with video_id
    - **Classification:** SAFE legacy compatibility
    - **Risk:** Low - only fetches if video_id exists

11. `functions/api/public-links-by-subdomain.js` line 196: Enrich with video metadata using link.video_id
    - **Classification:** SAFE legacy compatibility
    - **Risk:** Low - only enriches if video_id exists

**Frontend Pages:**
12. `src/pages/LinksPage.tsx` lines 92-107: Fetch metadata for links with video_id
    - **Classification:** DANGEROUS AMBIGUITY
    - **Risk:** HIGH - Ignores link_usages completely
    - **Code:**
    ```typescript
    // Fetch metadata for links with video_id
    const linksWithMetadata = await Promise.all(
      links.map(async (link: any) => {
        if (link.video_id) {
          // Fetches YouTube metadata only from links.video_id
          // Ignores link_usages.youtube_video_id
        }
      })
    );
    ```

13. `src/pages/NewLinkPage.tsx` line 612: Create link with video_id
    - **Classification:** TRANSITIONAL DUPLICATION
    - **Risk:** MEDIUM - Creates new links with legacy attachment

14. `src/pages/EditLinkPage.tsx` line 146: Set selectedVideoId from link.video_id
    - **Classification:** SAFE legacy compatibility
    - **Risk:** Low - just reading the value

15. `src/pages/EditLinkPage.tsx` line 273: Update link with video_id
    - **Classification:** TRANSITIONAL DUPLICATION
    - **Risk:** MEDIUM - Updates legacy attachment

16. `src/pages/PublicLinkHubPage.tsx` line 184: Check if link has video data using video_id
    - **Classification:** SAFE legacy compatibility
    - **Risk:** Low - just checking existence

17. `src/pages/PublicLinkHubPage.tsx` line 438: Navigate to YouTube using link.video_id
    - **Classification:** SAFE legacy compatibility
    - **Risk:** Low - just reading the value

**Components:**
18. `src/components/LinkCard.tsx` lines 92-100: Build video contexts from links.video_id
    - **Classification:** TRANSITIONAL DUPLICATION
    - **Risk:** MEDIUM - Builds contexts from legacy source
    - **Note:** Also handles link_usages (lines 104-116), so dual-attribution is intentional here

---

## Exact Code Locations: link_usages.youtube_video_id Usage

### Modern Source (intended to be primary):

**API Endpoints:**
1. `functions/api/link-usages.js` line 31: SELECT includes youtube_video_id
   - **Classification:** SAFE modern implementation
   - **Risk:** None

2. `functions/api/link-usages.js` line 62: SELECT includes youtube_video_id
   - **Classification:** SAFE modern implementation
   - **Risk:** None

3. `functions/api/link-usages.js` lines 80-84: Collect unique youtube_video_ids for metadata fetch
   - **Classification:** SAFE modern implementation
   - **Risk:** None

4. `functions/api/link-usages.js` lines 168-172: Enrich usages with YouTube metadata
   - **Classification:** SAFE modern implementation
   - **Risk:** None

5. `functions/api/link-usages.js` line 213: POST accepts youtube_video_id
   - **Classification:** SAFE modern implementation
   - **Risk:** None

6. `functions/api/link-usages.js` line 250: INSERT includes youtube_video_id
   - **Classification:** SAFE modern implementation
   - **Risk:** None

7. `functions/api/link-usages.js` line 257: Response includes youtube_video_id
   - **Classification:** SAFE modern implementation
   - **Risk:** None

8. `functions/api/link-usages.js` line 273: Response includes youtube_video_id
   - **Classification:** SAFE modern implementation
   - **Risk:** None

9. `functions/api/link-usages.js` lines 312-360: PUT accepts youtube_video_id
   - **Classification:** SAFE modern implementation
   - **Risk:** None

10. `functions/api/links.js` line 95: SELECT link_usages includes youtube_video_id
    - **Classification:** SAFE modern implementation
    - **Risk:** None

11. `functions/api/links.js` lines 145-155: Collect youtube_video_ids from link_usages
    - **Classification:** SAFE modern implementation
    - **Risk:** None

12. `functions/api/links.js` lines 157-161: Merge link_usages video_ids with legacy video_ids
    - **Classification:** TRANSITIONAL DUPLICATION
    - **Risk:** MEDIUM - Merges both sources, potential for duplicates

13. `functions/api/links.js` lines 264-269: Enrich link_usages with YouTube metadata
    - **Classification:** SAFE modern implementation
    - **Risk:** None

14. `functions/api/placements.js` line 84: POST accepts youtube_video_id
    - **Classification:** SAFE modern implementation
    - **Risk:** None

15. `functions/api/placements.js` line 196: INSERT includes youtube_video_id
    - **Classification:** SAFE modern implementation
    - **Risk:** None

16. `functions/api/placements.js` line 213: Response includes youtube_video_id
    - **Classification:** SAFE modern implementation
    - **Risk:** None

17. `functions/api/proof-shares/[token].js` line 44: SELECT includes youtube_video_id
    - **Classification:** SAFE modern implementation
    - **Risk:** None

18. `functions/api/proof-shares/[token].js` line 206: Query links by youtube_video_id
    - **Classification:** SAFE modern implementation
    - **Risk:** None

19. `functions/api/proof-shares/[token].js` lines 280-293: Fetch YouTube metadata using youtube_video_id
    - **Classification:** SAFE modern implementation
    - **Risk:** None

20. `functions/api/proof-shares/[token].js` line 336: Response includes youtube_video_id
    - **Classification:** SAFE modern implementation
    - **Risk:** None

21. `functions/api/proof-shares/list.js` line 57: SELECT includes youtube_video_id
    - **Classification:** SAFE modern implementation
    - **Risk:** None

22. `functions/api/proof-shares/list.js` line 115: Response includes youtube_video_id
    - **Classification:** SAFE modern implementation
    - **Risk:** None

23. `functions/api/proof-shares/create.js` line 97: Request accepts youtube_video_id
    - **Classification:** SAFE modern implementation
    - **Risk:** None

24. `functions/api/proof-shares/create.js` line 118: Validate youtube_video_id OR link_usage_id
    - **Classification:** SAFE modern implementation
    - **Risk:** None

25. `functions/api/proof-shares/create.js` lines 125-155: If link_usage_id, read youtube_video_id from link_usages
    - **Classification:** SAFE modern implementation
    - **Risk:** None

26. `functions/api/proof-shares/create.js` line 197: INSERT includes youtube_video_id
    - **Classification:** SAFE modern implementation
    - **Risk:** None

27. `functions/api/analytics-helper.js` line 18: SELECT placements includes youtube_video_id
    - **Classification:** SAFE modern implementation
    - **Risk:** None

**Frontend Pages:**
28. `src/pages/AnalyticsPage.tsx` lines 193-195: Build usage entries from link_usages.youtube_video_id
    - **Classification:** SAFE modern implementation
    - **Risk:** None

29. `src/pages/PlacementsPage.tsx` lines 172-182: Build video contexts from link_usages.youtube_video_id
    - **Classification:** SAFE modern implementation
    - **Risk:** None

30. `src/pages/PlacementsPage.tsx` lines 312-314: Match placement by youtube_video_id
    - **Classification:** SAFE modern implementation
    - **Risk:** None

31. `src/pages/LinksPage.tsx` line 23: Type definition includes youtube_video_id
    - **Classification:** SAFE modern implementation
    - **Risk:** None

32. `src/pages/LinksPage.tsx` line 149: Type definition includes youtube_video_id
    - **Classification:** SAFE modern implementation
    - **Risk:** None

**Components:**
33. `src/components/LinkCard.tsx` lines 106-116: Build video contexts from link_usages.youtube_video_id
    - **Classification:** SAFE modern implementation
    - **Risk:** None

34. `src/components/AddPlacementModal.tsx` line 78: Pass youtube_video_id to placement creation
    - **Classification:** SAFE modern implementation
    - **Risk:** None

35. `src/components/VideoProofModal.tsx` line 166: Pass youtube_video_id to proof creation
    - **Classification:** SAFE modern implementation
    - **Risk:** None

36. `src/components/ReuseDestinationModal.tsx` line 32: Pass youtube_video_id to link_usage creation
    - **Classification:** SAFE modern implementation
    - **Risk:** None

---

## Authoritative Source Map

### Current State: Dual Attribution

| Component | Primary Source | Secondary Source | Risk Level |
|-----------|---------------|------------------|------------|
| Analytics video stats aggregation | links.video_id | link_usages.youtube_video_id (metadata only) | HIGH |
| LinksPage video metadata | links.video_id | None (ignores link_usages) | HIGH |
| NewLinkPage create flow | links.video_id | Creates link_usage in attach mode | MEDIUM |
| EditLinkPage update flow | links.video_id | None | MEDIUM |
| PublicLinkHubPage metadata | links.video_id | None | MEDIUM |
| AnalyticsPage video display | Both (merged) | Both (merged) | LOW |
| PlacementsPage video contexts | Both (merged) | Both (merged) | LOW |
| LinkCard video display | Both (merged) | Both (merged) | LOW |
| Proof creation | Both (OR logic) | Both (OR logic) | LOW |
| Worker redirect attribution | link_usage_id | None | NONE |
| Click events | link_usage_id | links.video_id (implicit via link_id) | LOW |

### Target State: Single Source of Truth

| Component | Primary Source | Fallback Source | Risk Level |
|-----------|---------------|-----------------|------------|
| Analytics video stats aggregation | link_usages.youtube_video_id | links.video_id (legacy only) | LOW |
| LinksPage video metadata | link_usages.youtube_video_id | links.video_id (legacy only) | LOW |
| NewLinkPage create flow | link_usages.youtube_video_id | None | LOW |
| EditLinkPage update flow | link_usages.youtube_video_id | None | LOW |
| PublicLinkHubPage metadata | link_usages.youtube_video_id | links.video_id (legacy only) | LOW |
| AnalyticsPage video display | link_usages.youtube_video_id | links.video_id (legacy only) | LOW |
| PlacementsPage video contexts | link_usages.youtube_video_id | links.video_id (legacy only) | LOW |
| LinkCard video display | link_usages.youtube_video_id | links.video_id (legacy only) | LOW |
| Proof creation | link_usage_id | youtube_video_id (legacy only) | LOW |
| Worker redirect attribution | link_usage_id | None | NONE |
| Click events | link_usage_id | None | NONE |

---

## Conflict Map

### Direct Conflicts (same data, different sources):

1. **Analytics video stats aggregation** (functions/api/links.js:132-141)
   - **Conflict:** Aggregates by links.video_id, but clicks are attributed via link_usage_id
   - **Impact:** If link has links.video_id="A" and link_usages=[{youtube_video_id:"B"}], analytics show stats for "A" but clicks are for "B"
   - **Classification:** DANGEROUS AMBIGUITY
   - **Priority:** CRITICAL

2. **LinksPage video metadata** (src/pages/LinksPage.tsx:92-107)
   - **Conflict:** Fetches metadata from links.video_id only, ignores link_usages
   - **Impact:** Links with only link_usages (no links.video_id) show no video thumbnails/titles
   - **Classification:** DANGEROUS AMBIGUITY
   - **Priority:** HIGH

3. **NewLinkPage create flow** (src/pages/NewLinkPage.tsx:612)
   - **Conflict:** Creates link with links.video_id, but attach mode creates link_usage
   - **Impact:** Users can create links with dual attachment (both links.video_id and link_usages)
   - **Classification:** TRANSITIONAL DUPLICATION
   - **Priority:** MEDIUM

4. **EditLinkPage update flow** (src/pages/EditLinkPage.tsx:273)
   - **Conflict:** Updates links.video_id, but doesn't sync with link_usages
   - **Impact:** Changing video_id on edit doesn't update existing link_usages
   - **Classification:** TRANSITIONAL DUPLICATION
   - **Priority:** MEDIUM

### Potential Conflicts (different data, same purpose):

5. **AnalyticsPage video display** (src/pages/AnalyticsPage.tsx:188-213)
   - **Conflict:** Merges videoStats (from links.video_id) and usageEntries (from link_usages)
   - **Impact:** Same video could appear twice in the list (once from each source)
   - **Classification:** TRANSITIONAL DUPLICATION
   - **Priority:** MEDIUM
   - **Mitigation:** Deduplication by video_id already in place (line 212 merges both)

6. **LinkCard video display** (src/components/LinkCard.tsx:88-116)
   - **Conflict:** Builds contexts from both links.video_id and link_usages
   - **Impact:** Same video could appear twice in the card
   - **Classification:** TRANSITIONAL DUPLICATION
   - **Priority:** LOW
   - **Mitigation:** Deduplication by video_id in place (line 100 seen.add)

---

## Dangerous Ambiguity Map

### CRITICAL (immediate action required):

1. **functions/api/links.js:132-141** - Analytics video stats aggregation
   - **Ambiguity:** Uses links.video_id as primary source for video statistics
   - **Why dangerous:** Clicks are attributed via link_usage_id, but stats are aggregated by links.video_id
   - **Example scenario:**
     - Link has links.video_id = "video_A"
     - Link has link_usages = [{youtube_video_id: "video_B", clicks: 100}]
     - Analytics shows: "video_A: 100 clicks" (WRONG - should be "video_B: 100 clicks")
   - **Impact:** Incorrect analytics data presented to users
   - **Fix:** Aggregate by link_usages.youtube_video_id first, fallback to links.video_id

### HIGH (address soon):

2. **src/pages/LinksPage.tsx:92-107** - LinksPage video metadata
   - **Ambiguity:** Fetches metadata only from links.video_id, ignores link_usages
   - **Why dangerous:** Users won't see video thumbnails/titles for links with only link_usages
   - **Example scenario:**
     - Link has no links.video_id
     - Link has link_usages = [{youtube_video_id: "video_B"}]
     - LinksPage shows: No video thumbnail (WRONG - should show video_B thumbnail)
   - **Impact:** Confusing UI, users think link has no video attachment
   - **Fix:** Fetch metadata from link_usages.youtube_video_id first, fallback to links.video_id

### MEDIUM (address in Phase 2):

3. **src/pages/NewLinkPage.tsx:612** - NewLinkPage create flow
   - **Ambiguity:** Creates link with links.video_id, but attach mode creates link_usage
   - **Why dangerous:** Creates dual attachment (both links.video_id and link_usages)
   - **Example scenario:**
     - User creates link with video_id = "video_A"
     - User attaches to "video_B" via attach mode
     - Link now has: links.video_id = "video_A", link_usages = [{youtube_video_id: "video_B"}]
   - **Impact:** Ambiguous which video is the "real" attachment
   - **Fix:** Stop setting links.video_id on create, only create link_usages

4. **src/pages/EditLinkPage.tsx:273** - EditLinkPage update flow
   - **Ambiguity:** Updates links.video_id, but doesn't sync with link_usages
   - **Why dangerous:** Changing video_id doesn't update existing link_usages
   - **Example scenario:**
     - Link has links.video_id = "video_A", link_usages = [{youtube_video_id: "video_B"}]
     - User edits link, changes video_id to "video_C"
     - Link now has: links.video_id = "video_C", link_usages = [{youtube_video_id: "video_B"}]
   - **Impact:** Inconsistent state between links.video_id and link_usages
   - **Fix:** Remove video_id from edit form, or sync with link_usages

### LOW (cleanup later):

5. **src/pages/AnalyticsPage.tsx:188-213** - AnalyticsPage video display
   - **Ambiguity:** Merges videoStats (from links.video_id) and usageEntries (from link_usages)
   - **Why dangerous:** Same video could appear twice
   - **Mitigation:** Deduplication already in place
   - **Fix:** Remove links.video_id from aggregation, use link_usages only

6. **src/components/LinkCard.tsx:88-116** - LinkCard video display
   - **Ambiguity:** Builds contexts from both links.video_id and link_usages
   - **Why dangerous:** Same video could appear twice
   - **Mitigation:** Deduplication already in place
   - **Fix:** Remove links.video_id from context building, use link_usages only

---

## Recommended Source-of-Truth Hierarchy

### Hierarchy (in order of priority):

1. **link_usage_id** (click_events, placements, proof_shares)
   - **Why:** Direct attribution unit, flows through entire system
   - **Usage:** Worker click tracking, placement association, proof creation

2. **link_usages.youtube_video_id** (video attachment)
   - **Why:** Canonical video attachment for a specific link usage
   - **Usage:** Analytics aggregation, video metadata fetch, UI display
   - **Fallback:** links.video_id (for legacy data only)

3. **links.video_id** (legacy video attachment)
   - **Why:** Backward compatibility for existing data
   - **Usage:** Fallback only, not primary source
   - **Deprecation:** Eventually set to NULL for all links

4. **placements.youtube_video_id** (video context for placement)
   - **Why:** Optional video context for placement-level tracking
   - **Usage:** Placement grouping, video context display
   - **Relationship:** Derives from link_usage_id or manual override

5. **proof_shares.youtube_video_id** (proof attachment)
   - **Why:** Immutable proof attachment to video
   - **Usage:** Proof grouping, sponsor-facing display
   - **Relationship:** Derived from link_usage_id or direct youtube_video_id

### Decision Tree for Video Attachment:

```
Need video attachment for a link?
├─ Is this a new link?
│  └─ YES: Create link_usage with youtube_video_id
│     └─ Do NOT set links.video_id
├─ Is this an existing link?
│  ├─ Does link have link_usages?
│  │  └─ YES: Use link_usages.youtube_video_id
│  │  └─ NO: Use links.video_id (legacy fallback)
│  └─ Need to attach to a new video?
│     └─ Create new link_usage with youtube_video_id
│        └─ Do NOT update links.video_id
└─ Need to display video metadata?
   └─ Fetch from link_usages.youtube_video_id
      └─ Fallback to links.video_id (legacy only)
```

---

## Phased Migration Strategy

### Phase 1: Analytics Consolidation (SAFEST FIRST STEP)

**Objective:** Make link_usages the primary source for analytics video stats, with links.video_id as fallback.

**Changes:**
1. Update `functions/api/links.js` lines 132-141:
   - Change video stats aggregation to use link_usages.youtube_video_id first
   - Fallback to links.video_id for legacy data
   - Deduplicate by video_id to prevent double-counting

**Before:**
```javascript
// Aggregate video stats (preserves existing behavior using links.video_id)
const videoStatsMap = new Map();
for (const link of linksWithUsages) {
  if (link.video_id) {
    const existing = videoStatsMap.get(link.video_id) || { video_id: link.video_id, total_clicks: 0, link_count: 0 };
    existing.total_clicks += link.clicks;
    existing.link_count += 1;
    videoStatsMap.set(link.video_id, existing);
  }
}
```

**After:**
```javascript
// Aggregate video stats using link_usages as primary source, links.video_id as fallback
const videoStatsMap = new Map();

// First: aggregate from link_usages (primary source)
for (const link of linksWithUsages) {
  if (link.link_usages && link.link_usages.length > 0) {
    link.link_usages.forEach(usage => {
      if (usage.youtube_video_id && usage.is_active === 1) {
        const existing = videoStatsMap.get(usage.youtube_video_id) || { 
          video_id: usage.youtube_video_id, 
          total_clicks: 0, 
          link_count: 0 
        };
        existing.total_clicks += usage.clicks || 0;
        existing.link_count += 1;
        videoStatsMap.set(usage.youtube_video_id, existing);
      }
    });
  }
}

// Second: aggregate from links.video_id (legacy fallback for links without link_usages)
for (const link of linksWithUsages) {
  if (link.video_id && (!link.link_usages || link.link_usages.length === 0)) {
    const existing = videoStatsMap.get(link.video_id) || { 
      video_id: link.video_id, 
      total_clicks: 0, 
      link_count: 0 
    };
    existing.total_clicks += link.clicks;
    existing.link_count += 1;
    videoStatsMap.set(link.video_id, existing);
  }
}
```

**Risk:** LOW
- Single, isolated change
- Doesn't affect Worker routing
- Doesn't require schema changes
- Can be easily rolled back
- Preserves legacy data via fallback

**Rollback:** Revert to original code (links.video_id only).

**Verification:**
- Test analytics page with links that have only link_usages
- Test analytics page with links that have only links.video_id
- Test analytics page with links that have both (should not double-count)

### Phase 2: Frontend UI Consolidation

**Objective:** Update frontend to use link_usages as primary source for video metadata display.

**Changes:**
1. Update `src/pages/LinksPage.tsx` lines 92-107:
   - Fetch video metadata from link_usages.youtube_video_id first
   - Fallback to links.video_id for legacy data

2. Update `src/pages/PublicLinkHubPage.tsx`:
   - Fetch video metadata from link_usages.youtube_video_id first
   - Fallback to links.video_id for legacy data

3. Update `src/components/LinkCard.tsx`:
   - Remove links.video_id from context building
   - Use link_usages.youtube_video_id only

**Risk:** MEDIUM
- Multiple frontend changes
- Could confuse users if not explained clearly
- Can be rolled back via feature flag

**Rollback:** Revert to original code (links.video_id only).

**Verification:**
- Test LinksPage with links that have only link_usages
- Test PublicLinkHubPage with links that have only link_usages
- Test LinkCard with links that have only link_usages

### Phase 3: Create/Edit Flow Consolidation

**Objective:** Stop setting links.video_id on create/edit, only create link_usages.

**Changes:**
1. Update `src/pages/NewLinkPage.tsx`:
   - Remove video_id from link creation (line 612)
   - Always create link_usage when video is selected
   - Update UI to reflect "attach to video" model

2. Update `src/pages/EditLinkPage.tsx`:
   - Remove video_id from link update (line 273)
   - Add "attach to another video" flow
   - Update UI to reflect multi-video attachment model

3. Update `functions/api/links.js`:
   - Deprecate video_id parameter in POST (line 329)
   - Deprecate video_id parameter in PUT (line 452)
   - Keep accepting for backward compatibility, but ignore

**Risk:** MEDIUM
- Changes user-facing flows
- Could confuse users if not explained clearly
- Can be rolled back via feature flag

**Rollback:** Revert to original code (set links.video_id).

**Verification:**
- Test new link creation with video selected
- Test new link creation without video selected
- Test edit link with video change
- Test attach to another video flow

### Phase 4: Deprecation and Cleanup

**Objective:** Deprecate links.video_id column after sufficient time.

**Changes:**
1. Mark links.video_id as deprecated in API docs
2. Add migration to set links.video_id = NULL after 6+ months
3. Consider dropping links.video_id column after 12+ months
4. Update all queries to use link_usages only

**Risk:** LOW (if deferred)
- No urgency
- Can be deferred indefinitely
- No functional impact

**Rollback:** N/A (cleanup only).

**Verification:**
- Monitor links.video_id usage in production
- Confirm no queries depend on links.video_id
- Test with links.video_id = NULL

---

## Safest Phase 1 Implementation

**Recommended First Step:** Phase 1 - Analytics Consolidation

**Why this is the safest first step:**
1. **Single change point:** Only one file to modify (`functions/api/links.js`)
2. **Isolated impact:** Only affects analytics aggregation, not routing or UI
3. **No schema changes:** No database migrations required
4. **Easy rollback:** Can revert to original code in seconds
5. **Low user impact:** Analytics data should remain consistent (same clicks, just grouped differently)
6. **High value:** Directly addresses the biggest ambiguity
7. **Worker unaffected:** No changes to Worker routing logic
8. **Testable:** Can verify with existing data without creating new links

**Exact code change:**
- File: `functions/api/links.js`
- Lines: 132-141
- Change: Replace video stats aggregation to use link_usages first, fallback to links.video_id
- Risk: LOW
- Rollback: Revert to original code

**Verification steps:**
1. Deploy to staging environment
2. Test analytics page with existing links
3. Verify video stats are correct for links with only link_usages
4. Verify video stats are correct for links with only links.video_id
5. Verify no double-counting for links with both
6. Monitor for any analytics discrepancies
7. If issues found, rollback immediately

**Success criteria:**
- Analytics page shows correct video stats for all link types
- No double-counting of clicks
- Legacy links (links.video_id only) still work correctly
- New links (link_usages only) show correct stats
- No user-facing errors or confusion

---

## Explicit "Do Not Touch Yet" List

### DO NOT TOUCH (production-sensitive):

1. **Worker routing logic** (worker.js lines 240-476)
   - Any change risks breaking live redirects
   - Worker already supports link_usage_id correctly
   - No changes needed

2. **Root-level Pages Functions**
   - Memory b83a8200-f404-462b-8e4b-4ed10cda6a4b: These consistently crash the site
   - Use API endpoints (functions/api/*) instead

3. **Database schema** (except adding new tables/columns)
   - Do not drop or alter existing tables
   - Do not remove links.video_id column yet
   - Additive changes only

4. **Stripe billing logic**
   - Out of scope for this migration

5. **Referral rewards logic**
   - Out of scope for this migration

6. **Effective plan logic**
   - Out of scope for this migration

7. **Clerk auth logic**
   - Out of scope for this migration

8. **D1 bindings/schema**
   - Out of scope for this migration

9. **Cloudflare config**
   - Out of scope for this migration

### DO NOT TOUCH in Phase 1:

1. **Frontend UI changes**
   - No changes to LinksPage, NewLinkPage, EditLinkPage
   - Focus on backend analytics consolidation first

2. **URL patterns**
   - No changes to URL structure
   - Worker routing is production-sensitive

3. **Create/edit flows**
   - No changes to NewLinkPage or EditLinkPage
   - Keep setting links.video_id for now

4. **Proof system**
   - No changes to proof creation or display
   - Already supports link_usage_id correctly

### DO NOT TOUCH in Phase 2:

1. **Worker routing logic**
2. **URL patterns**
3. **Database schema**
4. **Create/edit flows**
5. **Proof system**

### DO NOT TOUCH in Phase 3:

1. **Worker routing logic**
2. **URL patterns**
3. **Database schema**
4. **Proof system**

### DO NOT TOUCH in Phase 4:

1. **Worker routing logic**
2. **URL patterns**
3. **Billing/referral/plan/auth logic**

---

## Rollback Considerations

### Phase 1 Rollback:

**Trigger:**
- Analytics discrepancies detected
- User reports incorrect video stats
- Performance degradation

**Rollback steps:**
1. Revert `functions/api/links.js` lines 132-141 to original code
2. Deploy to production
3. Monitor analytics for correct behavior

**Rollback time:** < 5 minutes

**Data impact:** None (no data changes, only aggregation logic)

### Phase 2 Rollback:

**Trigger:**
- UI confusion reported by users
- Video metadata not displaying correctly
- Performance issues

**Rollback steps:**
1. Revert frontend changes to original code
2. Deploy to production
3. Monitor for correct behavior

**Rollback time:** < 10 minutes

**Data impact:** None (no data changes, only display logic)

### Phase 3 Rollback:

**Trigger:**
- User confusion about "attach to video" model
- Create/edit flow broken
- High support volume

**Rollback steps:**
1. Revert create/edit flows to original code
2. Re-enable links.video_id setting
3. Deploy to production
4. Monitor for correct behavior

**Rollback time:** < 15 minutes

**Data impact:** None (no data changes, only flow logic)

### Phase 4 Rollback:

**Trigger:**
- Legacy links broken
- Analytics errors
- High support volume

**Rollback steps:**
1. Restore links.video_id from backup
2. Revert any query changes
3. Deploy to production
4. Monitor for correct behavior

**Rollback time:** < 30 minutes

**Data impact:** Potential data loss if links.video_id was dropped (mitigation: defer dropping column)

---

## Production Risk Assessment

### Overall Risk: LOW to MEDIUM

**Phase 1 (Analytics Consolidation):**
- **Risk level:** LOW
- **Impact:** Analytics data grouping changes, but total counts remain same
- **Probability of issue:** LOW (isolated change, well-tested pattern)
- **Mitigation:** Extensive staging testing, gradual rollout, feature flag
- **Rollback:** Revert API changes (5 minutes)
- **User impact:** Minimal (analytics might show different grouping temporarily)

**Phase 2 (Frontend UI Consolidation):**
- **Risk level:** MEDIUM
- **Impact:** UI changes could confuse users if not explained clearly
- **Probability of issue:** MEDIUM (multiple frontend changes)
- **Mitigation:** Clear UX copy, progressive disclosure, help docs, feature flag
- **Rollback:** Revert frontend changes (10 minutes)
- **User impact:** Medium (UI might show incorrect video metadata temporarily)

**Phase 3 (Create/Edit Flow Consolidation):**
- **Risk level:** MEDIUM
- **Impact:** User-facing flow changes, could confuse users
- **Probability of issue:** MEDIUM (changes to core user flows)
- **Mitigation:** Clear UX copy, onboarding, help docs, feature flag
- **Rollback:** Revert flow changes (15 minutes)
- **User impact:** Medium (create/edit flow might be confusing temporarily)

**Phase 4 (Deprecation):**
- **Risk level:** LOW (if deferred)
- **Impact:** Cleanup only, no functional changes
- **Probability of issue:** LOW (deferred, no urgency)
- **Mitigation:** Defer for 6-12 months, monitor usage
- **Rollback:** N/A (cleanup only)
- **User impact:** None

### Highest Risk Components:

1. **Worker routing logic** (DO NOT TOUCH)
   - Risk: CRITICAL
   - Impact: Site-wide redirect failures
   - Mitigation: Do not change

2. **Database schema changes** (only additive)
   - Risk: HIGH
   - Impact: Data loss or corruption
   - Mitigation: Only additive changes, test in staging

3. **Frontend UI changes** (Phase 2)
   - Risk: MEDIUM
   - Impact: User confusion
   - Mitigation: Feature flag, clear UX copy

### Risk Mitigation Strategy:

1. **Staging testing:** Test all changes in staging environment before production
2. **Feature flags:** Use feature flags for frontend changes
3. **Gradual rollout:** Roll out to subset of users first
4. **Monitoring:** Monitor analytics and error rates closely
5. **Rollback plan:** Have rollback plan ready before deployment
6. **Communication:** Communicate changes to users in advance
7. **Documentation:** Update documentation to reflect new model

---

## Exact Files Audited

**API Endpoints:**
1. `functions/api/links.js` (559 lines) - Links CRUD + video stats aggregation
2. `functions/api/links/[id].js` (332 lines) - Link detail + metadata enrichment
3. `functions/api/link-usages.js` (497 lines) - Link usages CRUD
4. `functions/api/placements.js` (313 lines) - Placements CRUD
5. `functions/api/analytics-helper.js` (87 lines) - Analytics utilities
6. `functions/api/proof-shares/create.js` (250 lines) - Proof creation
7. `functions/api/proof-shares/list.js` - Proof listing
8. `functions/api/proof-shares/[token].js` - Proof display
9. `functions/api/public-links-by-subdomain.js` (285 lines) - Public hub API

**Worker:**
10. `worker.js` (564 lines) - Redirect logic + link_usage_id tracking

**Frontend Pages:**
11. `src/pages/AnalyticsPage.tsx` (1038 lines) - Analytics dashboard
12. `src/pages/LinksPage.tsx` (359 lines) - Links management
13. `src/pages/NewLinkPage.tsx` (1197 lines) - Link creation + attach mode
14. `src/pages/EditLinkPage.tsx` - Link editing
15. `src/pages/PlacementsPage.tsx` (701 lines) - Placement management
16. `src/pages/ProofsPage.tsx` (713 lines) - Proof library
17. `src/pages/PublicLinkHubPage.tsx` (569 lines) - Public hub display

**Frontend Components:**
18. `src/components/LinkCard.tsx` - Link card display
19. `src/components/AddPlacementModal.tsx` - Placement creation modal
20. `src/components/VideoProofModal.tsx` - Proof creation modal
21. `src/components/ReuseDestinationModal.tsx` - Reuse destination modal

**Frontend Library:**
22. `src/lib/cloudflare.ts` - API client library

**Total files audited:** 22 files, ~7,500 lines of code

---

## Summary of Key Questions

### 1. What currently treats links.video_id as authoritative?

**Answer:**
- Analytics video stats aggregation (functions/api/links.js:132-141) - PRIMARY source
- LinksPage video metadata (src/pages/LinksPage.tsx:92-107) - ONLY source
- NewLinkPage create flow (src/pages/NewLinkPage.tsx:612) - Sets on create
- EditLinkPage update flow (src/pages/EditLinkPage.tsx:273) - Updates on edit
- PublicLinkHubPage metadata (functions/api/public-links-by-subdomain.js:138-144) - Fetches from

### 2. What currently treats link_usage as authoritative?

**Answer:**
- Worker redirect attribution (worker.js:509-540) - Uses link_usage_id for click tracking
- Placement video context (functions/api/placements.js:84-198) - Accepts link_usage_id
- Proof creation (functions/api/proof-shares/create.js:125-155) - Reads youtube_video_id from link_usage
- AnalyticsPage video display (src/pages/AnalyticsPage.tsx:188-213) - Uses link_usages.youtube_video_id
- PlacementsPage video contexts (src/pages/PlacementsPage.tsx:172-182) - Uses link_usages.youtube_video_id

### 3. Which system should become source-of-truth first?

**Answer:** **Analytics aggregation in functions/api/links.js** should become link_usages-first first. This is the safest first step because:
- Single, isolated change
- Doesn't affect Worker routing
- Doesn't require schema changes
- Can be easily rolled back
- Directly addresses the biggest ambiguity

### 4. What breaks if links.video_id becomes optional/deprecated?

**Answer:**
- LinksPage won't show video metadata for legacy links (need fallback)
- PublicLinkHubPage won't show video metadata for legacy links (need fallback)
- Analytics aggregation won't show stats for legacy links (need fallback)
- NewLinkPage/EditLinkPage create/edit flows need to stop setting video_id

**Mitigation:** Add fallback logic to fetch from link_usages first, then links.video_id.

### 5. What can be migrated safely without schema changes?

**Answer:**
- Analytics aggregation logic (functions/api/links.js:132-141)
- Frontend video metadata fetch (src/pages/LinksPage.tsx:92-107)
- Frontend video display (src/pages/PublicLinkHubPage.tsx:138-144)
- Create/edit flow logic (src/pages/NewLinkPage.tsx:612, src/pages/EditLinkPage.tsx:273)

All of these can be migrated without schema changes by adding fallback logic.

### 6. Which UI surfaces are most dangerous?

**Answer:**
1. **LinksPage** (src/pages/LinksPage.tsx:92-107) - Ignores link_usages completely
2. **NewLinkPage** (src/pages/NewLinkPage.tsx:612) - Creates dual attachment
3. **EditLinkPage** (src/pages/EditLinkPage.tsx:273) - Updates links.video_id without syncing link_usages

### 7. Which analytics calculations risk double attribution?

**Answer:**
- **Analytics video stats aggregation** (functions/api/links.js:132-141) - Uses links.video_id as primary, but clicks are attributed via link_usage_id. If a link has both links.video_id and link_usages, stats could be attributed to the wrong video.

### 8. Which proof calculations risk inconsistency?

**Answer:**
- **Proof creation** (functions/api/proof-shares/create.js) - Already handles this correctly by accepting either youtube_video_id OR link_usage_id. No risk.

### 9. What should the FIRST migration implementation actually be?

**Answer:** **Phase 1: Analytics Consolidation** - Update `functions/api/links.js` lines 132-141 to aggregate video stats using link_usages.youtube_video_id as primary source, with links.video_id as fallback for legacy data.

This is the safest first step because:
- Single, isolated change
- Doesn't affect Worker routing
- Doesn't require schema changes
- Can be easily rolled back
- Directly addresses the biggest ambiguity

---

## Conclusion

The codebase operates in a dual-attribution state with both `links.video_id` (legacy) and `link_usages.youtube_video_id` (modern) being treated as authoritative in different parts of the system. The biggest ambiguity is in analytics video stats aggregation, which uses `links.video_id` as the primary source even though clicks are attributed via `link_usage_id`.

**Recommended next steps:**
1. Implement Phase 1 (Analytics Consolidation) - Update `functions/api/links.js` to use link_usages as primary source
2. Implement Phase 2 (Frontend UI Consolidation) - Update frontend to use link_usages as primary source
3. Implement Phase 3 (Create/Edit Flow Consolidation) - Stop setting links.video_id on create/edit
4. Defer Phase 4 (Deprecation) - No urgency, can be deferred indefinitely

**Biggest ambiguity:** Analytics video stats aggregation in `functions/api/links.js` (lines 132-141).

**Recommended first implementation step:** Phase 1 - Analytics Consolidation in `functions/api/links.js`.

**Most dangerous UI assumption:** LinksPage video metadata fetch (src/pages/LinksPage.tsx:92-107) ignores link_usages completely.

**Most dangerous analytics assumption:** Analytics video stats aggregation (functions/api/links.js:132-141) uses links.video_id as primary source.

**Worker support:** YES - Worker already supports the migration cleanly (tracks link_usage_id, doesn't use links.video_id for routing).

**Build not required** unless files are unexpectedly changed outside docs.
