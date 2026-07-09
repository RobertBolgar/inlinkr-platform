# Reusable Smart Links UX Audit

**Audit Date:** 2026-05-27  
**Branch:** pro-dev  
**Scope:** Product UX coherence against reusable link attribution model  
**Status:** AUDIT ONLY - No code changes

---

## Executive Summary

TubeLinkr's backend has successfully implemented reusable smart link architecture (link_usage model, placement attribution, analytics consolidation). However, the frontend UX still primarily reflects the legacy mental model of "one Smart Link = one video." This creates a significant product coherence gap that will confuse creators as they begin reusing links across multiple videos.

**Key Finding:** The UX is in a transitional state - some components correctly reflect reusable links (LinkCard, PlacementsPage, ProofsPage), while others still assume 1:1 link-video relationships (EditLinkPage, empty states, helper text).

---

## Files Audited

### Core Pages
- `src/pages/LinksPage.tsx` - Main links list
- `src/pages/NewLinkPage.tsx` - Link creation with attach mode
- `src/pages/EditLinkPage.tsx` - Link editing
- `src/pages/PlacementsPage.tsx` - Placement management per link
- `src/pages/AnalyticsPage.tsx` - Cross-link analytics
- `src/pages/ProofsPage.tsx` - Proof library management
- `src/pages/PublicProofPage.tsx` - Sponsor-facing proof display
- `src/pages/PublicLinkHubPage.tsx` - Public creator hub

### Components
- `src/components/LinkCard.tsx` - Link display card
- `src/components/AddPlacementModal.tsx` - Placement creation flow
- `src/components/ReuseDestinationModal.tsx` - Destination reuse flow

### API Layer
- `src/lib/cloudflare.ts` - API client methods

---

## Current UX Strengths (Already Aligned)

### 1. LinkCard - Multi-Video Display
**File:** `src/components/LinkCard.tsx`

**Strengths:**
- Line 228: "Videos driving traffic to this destination" - correctly shows multiple videos
- Lines 87-122: `getAllVideos()` function correctly aggregates base video + usage videos
- Lines 226-269: Expanded state shows all videos using this link with thumbnails
- Lines 104-119: Deduplicates videos by video_id to prevent duplicates

**Verdict:** **EXCELLENT** - This component fully embraces reusable links.

### 2. PlacementsPage - Video Context Grouping
**File:** `src/pages/PlacementsPage.tsx`

**Strengths:**
- Lines 319-354: `getGroupedPlacements()` groups placements by video context
- Lines 488-603: Video-grouped placements show which videos have which placements
- Lines 606-682: Legacy/no-context placements handled gracefully
- Lines 148-195: Fetches link_usages to build video contexts

**Verdict:** **EXCELLENT** - Correctly reflects multi-video usage.

### 3. AddPlacementModal - Video Selection
**File:** `src/components/AddPlacementModal.tsx`

**Strengths:**
- Lines 39-52: Auto-selects video when only one context exists
- Lines 119-167: Shows video selection UI when multiple videos exist
- Line 123: "This helps you keep placements organized across videos" - acknowledges multi-video context

**Verdict:** **GOOD** - Handles multi-video scenarios well.

### 4. NewLinkPage - Attach Mode
**File:** `src/pages/NewLinkPage.tsx`

**Strengths:**
- Line 15: Has `mode` state for 'create' vs 'attach'
- Lines 467-549: Attach mode reuses existing destinations for new videos
- Line 825: "Create a reusable Smart Link for your destination" - acknowledges reusability
- Lines 676-714: Shows placement links when placements selected

**Verdict:** **GOOD** - Attach mode exists but could be more prominent.

### 5. ReuseDestinationModal - Explicit Reuse
**File:** `src/components/ReuseDestinationModal.tsx`

**Strengths:**
- Line 60: "Reuse Destination Link" - clear terminology
- Line 71: "Attach this destination link to another YouTube video or context" - explains reuse
- Lines 30-37: Creates link_usage record without duplicating link

**Verdict:** **EXCELLENT** - Clear reusable link mental model.

### 6. ProofsPage - Multi-Video Grouping
**File:** `src/pages/ProofsPage.tsx`

**Strengths:**
- Lines 200-274: `groupProofs()` groups by youtube_video_id + destination_domain
- Line 201: TODO comment acknowledges need to move to link_id/link_usage_id grouping
- Lines 376-378: "Showing latest 25 proofs, grouped by video and destination"

**Verdict:** **GOOD** - Handles multi-video attribution but uses legacy grouping.

### 7. AnalyticsPage - Usage Aggregation
**File:** `src/pages/AnalyticsPage.tsx`

**Strengths:**
- Line 191: Comment acknowledges API aggregates from link_usages as primary source
- Lines 125-126: Fetches videoStats from API (which uses link_usages)
- Lines 498-630: Video performance section shows videos with links

**Verdict:** **GOOD** - Correctly reflects aggregated attribution.

### 8. PublicProofPage - Multi-Link Display
**File:** `src/pages/PublicProofPage.tsx`

**Strengths:**
- Line 327: Shows "Smart Link{link_count > 1 ? 's' : ''}" - acknowledges multiple links
- Line 279: "This video sent X clicks to destination" - video-centric language (appropriate for sponsors)

**Verdict:** **GOOD** - Sponsor-facing view is appropriate.

---

## Current UX Contradictions (Still Assumes 1:1)

### 1. LinksPage - Empty State Language
**File:** `src/pages/LinksPage.tsx`

**Contradictions:**
- Line 234: "Create your first Smart Link to start measuring which videos and placements drive clicks"
  - **Problem:** Implies link measures videos, not that link is reusable across videos
  - **Should be:** "Create your first Smart Link to track clicks from your videos and placements"

- Line 244-251: "Track clicks from: YouTube descriptions • Pinned comments • Channel bios"
  - **Problem:** No mention that one link can be used across all these

**Verdict:** **MEDIUM RISK** - Confusing for new users.

### 2. LinksPage - Header Language
**File:** `src/pages/LinksPage.tsx`

**Contradictions:**
- Line 189: "Your Smart Links" - No indication these are reusable
- Line 208: "Create Smart Link" - No hint of reusability

**Verdict:** **LOW RISK** - Could be more explicit but not actively misleading.

### 3. EditLinkPage - Single Video Attachment
**File:** `src/pages/EditLinkPage.tsx`

**Contradictions:**
- Line 376: "Attach YouTube Video" section
  - **Problem:** Singular "video" implies one-to-one relationship
  - **Should be:** "Attach YouTube Video (Primary Context)" or similar

- Line 379: "Connect YouTube in Settings to attach videos to links"
  - **Problem:** "attach videos to links" implies one video per link

**Verdict:** **HIGH RISK** - Directly contradicts reusable link model.

### 4. NewLinkPage - Helper Text
**File:** `src/pages/NewLinkPage.tsx`

**Contradictions:**
- Line 825: "Create a reusable Smart Link for your destination" - GOOD
- Line 759: "Paste into your YouTube description, pinned comment, or bio to start tracking clicks"
  - **Problem:** Doesn't mention same link can be reused across multiple videos

**Verdict:** **MEDIUM RISK** - Missed opportunity to educate.

### 5. PlacementsPage - Empty State
**File:** `src/pages/PlacementsPage.tsx`

**Contradictions:**
- Line 462: "Add placements to your videos and bios to compare which content performs best"
  - **Problem:** Doesn't clarify that one link can have placements across multiple videos

**Verdict:** **LOW RISK** - Not actively misleading but could be clearer.

### 6. PublicLinkHubPage - Video Count Language
**File:** `src/pages/PublicLinkHubPage.tsx`

**Contradictions:**
- Line 235: "videos tracked" - Implies tracking videos, not links used on videos
- Line 239: "creator resources" - Good terminology for links
- Line 178: "Creator sharing X videos and Y resources" - Separates videos from resources

**Verdict:** **LOW RISK** - Public-facing, acceptable ambiguity.

---

## Outdated Mental Model Assumptions

### 1. "Attach Video" = Primary Association
**Assumption:** Each link has one primary video attachment (links.video_id)

**Reality:** Links can be used across many videos via link_usage table

**Impact:** EditLinkPage's "Attach YouTube Video" section implies a singular relationship

**Files Affected:**
- `src/pages/EditLinkPage.tsx` (lines 375-447)

### 2. Link Creation = Video-Specific
**Assumption:** Creating a link is for a specific video

**Reality:** Links are destination-first, video-agnostic

**Impact:** NewLinkPage helper text doesn't emphasize reusability

**Files Affected:**
- `src/pages/NewLinkPage.tsx` (lines 759, 825)

### 3. Placement = Link-Scoped
**Assumption:** Placements belong to a link, not a link-on-a-video

**Reality:** Placements are link_usage-scoped (one link can have same placement on multiple videos)

**Impact:** PlacementsPage correctly handles this, but mental model may still be link-scoped

**Files Affected:**
- `src/pages/PlacementsPage.tsx` (actually handles this correctly)

---

## Terminology Inconsistencies

### "Link" vs "Usage" vs "Placement"

**Current Usage:**
- **Link:** The destination record (links table)
- **Placement:** A tracking source (placements table)
- **Usage:** A link used on a specific video (link_usages table)

**Inconsistencies:**
1. EditLinkPage says "attach videos to links" - should be "use link on videos"
2. NewLinkPage "attach mode" - good terminology
3. PlacementsPage "placements" - correct but could be clearer about video context
4. AnalyticsPage "videos with links" - good terminology

**Recommendation:** Standardize on:
- "Link" = destination
- "Use link on video" = link_usage
- "Placement" = tracking source within a usage

### "Video" vs "Video Context"

**Current Usage:**
- LinksPage: "videos driving traffic to this destination" - GOOD
- EditLinkPage: "Attach YouTube Video" - singular, problematic
- PlacementsPage: "video context" - GOOD

**Recommendation:** Use "video context" when referring to link_usage, reserve "video" for the YouTube video itself.

---

## Reusable Link UX Gaps

### 1. No Reusability Indicators on LinksPage
**Gap:** LinksPage doesn't show which links are used on multiple videos

**Current State:** LinkCard shows videos when expanded, but collapsed state doesn't indicate multi-video usage

**Recommendation:** Add badge or indicator like "Used on 3 videos" in collapsed state

**Priority:** MEDIUM

### 2. No "Used On X Videos" Metric
**Gap:** No quick way to see how many videos use each link

**Current State:** Must expand each LinkCard to see video count

**Recommendation:** Add video count to LinkCard collapsed state

**Priority:** MEDIUM

### 3. Attach Mode Not Prominent
**Gap:** NewLinkPage has attach mode but it's not the default or highlighted

**Current State:** Default is "create" mode, attach mode is secondary

**Recommendation:** Consider making attach mode more prominent or adding "Reuse existing link" button on LinksPage

**Priority:** LOW

### 4. No "Reusability" Education
**Gap:** No onboarding or helper text explaining that links are reusable

**Current State:** Only NewLinkPage line 825 mentions "reusable"

**Recommendation:** Add tooltip or helper text explaining reusability

**Priority:** LOW

---

## Creator Confusion Risks

### 1. EditLinkPage Video Attachment
**Risk:** Creators will think they can only attach one video per link

**Current Behavior:** Single video dropdown

**Confusion Point:** "Attach YouTube Video" section implies exclusivity

**Severity:** HIGH

**Mitigation:** Rename to "Primary Video Context" or add helper text explaining link can be used on multiple videos

### 2. Link Creation Mental Model
**Risk:** Creators will create duplicate links for each video instead of reusing

**Current Behavior:** NewLinkPage doesn't emphasize reusability

**Confusion Point:** Empty state helper text doesn't mention reusability

**Severity:** MEDIUM

**Mitigation:** Add "reuse existing link" option or highlight attach mode

### 3. Placement Scope Confusion
**Risk:** Creators won't understand that same placement can exist on multiple videos

**Current Behavior:** PlacementsPage handles this correctly but mental model may be unclear

**Confusion Point:** "Add placement" button doesn't specify video context

**Severity:** LOW

**Mitigation:** AddPlacementModal already handles this well

---

## Sponsor-Facing Risks

### 1. Proof Attribution Clarity
**Risk:** Sponsors may not understand that clicks are aggregated across multiple videos

**Current Behavior:** PublicProofPage shows "Smart Links" count (line 327)

**Assessment:** LOW RISK - Sponsor-facing language is appropriate

**Mitigation:** None needed - current implementation is good

### 2. Multi-Link Proofs
**Risk:** Sponsors may be confused by proofs showing multiple links per video

**Current Behavior:** ProofsPage groups by video + destination

**Assessment:** LOW RISK - Grouping logic handles this correctly

**Mitigation:** None needed - current implementation is good

### 3. Proof "Video" Language
**Risk:** Sponsors may think proof is for one specific video when it's aggregated

**Current Behavior:** PublicProofPage shows "This video sent X clicks" (line 279)

**Assessment:** LOW RISK - Appropriate for sponsor-facing view

**Mitigation:** None needed - video-centric language is correct for sponsors

---

## Recommended UX Evolution Phases

### Phase 1: Terminology & Education (Safest)
**Goal:** Align language with reusable link model without changing behavior

**Changes:**
1. Update EditLinkPage "Attach YouTube Video" → "Primary Video Context"
2. Add helper text: "This link can be used on multiple videos"
3. Update LinksPage empty state to mention reusability
4. Add tooltip to LinkCard explaining multi-video usage

**Risk:** LOW - Text changes only

**Effort:** 2-3 hours

### Phase 2: Visual Indicators (Low Risk)
**Goal:** Make reusability visible in UI

**Changes:**
1. Add "Used on X videos" badge to LinkCard collapsed state
2. Add video count indicator to LinksPage list
3. Highlight links with multi-video usage
4. Add "reusable" icon or badge

**Risk:** LOW - Visual additions only

**Effort:** 4-6 hours

### Phase 3: Flow Improvements (Medium Risk)
**Goal:** Make reusable link flows more prominent

**Changes:**
1. Add "Reuse existing link" button to LinksPage
2. Make attach mode more prominent in NewLinkPage
3. Add "view all videos using this link" link
4. Improve video selection in AddPlacementModal

**Risk:** MEDIUM - Flow changes

**Effort:** 8-12 hours

### Phase 4: Advanced Reusability Features (Higher Risk)
**Goal:** Full reusable link management

**Changes:**
1. Bulk attach link to multiple videos
2. Link usage management page
3. Reusability analytics (which links are most reused)
4. Campaign grouping for reusable links

**Risk:** HIGH - New features

**Effort:** 20-30 hours

---

## Safest Next Implementation Phase

**Recommendation:** Phase 1 - Terminology & Education

**Rationale:**
- Lowest risk (text changes only)
- Highest impact (aligns mental model)
- No behavior changes
- Can be done quickly
- Addresses highest-risk confusion point (EditLinkPage)

**Specific Changes:**
1. EditLinkPage line 376: "Attach YouTube Video" → "Primary Video Context"
2. EditLinkPage line 379: Add helper text "This link can be used on multiple videos"
3. LinksPage line 234: Update empty state to mention reusability
4. LinkCard line 228: Keep "Videos driving traffic to this destination" (already good)

**Estimated Effort:** 2-3 hours

**Testing:** Manual verification of text changes

---

## Highest-Risk UX Assumptions

### 1. EditLinkPage Single Video Attachment
**Assumption:** Each link has one primary video

**Risk:** HIGH - Directly contradicts reusable link model

**Impact:** Creators will not reuse links across videos

**Fix:** Phase 1 terminology changes

### 2. LinksPage Empty State Language
**Assumption:** Links are created for specific videos

**Risk:** MEDIUM - Misleading for new users

**Impact:** Creates wrong mental model from start

**Fix:** Phase 1 terminology changes

### 3. NewLinkPage Helper Text
**Assumption:** Links are video-specific

**Risk:** MEDIUM - Missed education opportunity

**Impact:** Creators won't discover reusability

**Fix:** Phase 1 terminology changes

---

## "Do Not Touch Yet" Areas

Per user instructions, these areas are OUT OF SCOPE for this UX audit:

- Worker routing (redirect-worker.js, functions/[[route]].js)
- Database schema (migrations/, cloudflare-schema.sql)
- D1 bindings (wrangler.toml)
- Cloudflare config (wrangler.toml, wrangler-redirect.toml)
- Clerk auth (src/contexts/AuthContext.tsx, functions/api/auth-helper.js)
- Stripe billing (functions/api/stripe-*, src/lib/plan.ts)
- Referral rewards (migrations/*referral*, src/lib/referral-reward.ts)
- Effective plan logic (src/lib/plan.ts)
- Proof grouping (functions/api/proof-shares/*)

**Reason:** These are backend/infrastructure concerns, not UX coherence issues.

---

## Analytics Alignment Assessment

### Question: Does Analytics now correctly reflect the architecture?

**Answer:** YES

**Evidence:**
- AnalyticsPage line 191: Comment acknowledges API aggregates from link_usages as primary source
- AnalyticsPage lines 125-126: Fetches videoStats from API (which uses link_usages)
- Video performance section shows videos with links (plural)
- Source analytics use placement mapping (lines 134-153)

**Verdict:** Analytics is correctly aligned with reusable link model.

---

## Proof UX Sponsor Alignment Assessment

### Question: Does proof UX still align with sponsor expectations?

**Answer:** YES

**Evidence:**
- PublicProofPage shows "Smart Links" count (acknowledges multiple links)
- PublicProofPage line 279: "This video sent X clicks" - video-centric (appropriate for sponsors)
- ProofsPage groups by video + destination (handles multi-video attribution)
- Proof language is sponsor-facing (clicks, CTR, views)

**Verdict:** Proof UX is sponsor-appropriate and correctly reflects multi-video attribution.

---

## Summary

### Biggest UX Contradiction Found
**EditLinkPage's "Attach YouTube Video" section** - implies one-to-one link-video relationship when links are reusable across multiple videos.

### Most Confusing Current User Flow
**EditLinkPage video attachment** - creators will think they can only attach one video per link, preventing link reuse.

### Safest Next UX Improvement
**Phase 1: Terminology & Education** - rename "Attach YouTube Video" to "Primary Video Context" and add helper text explaining reusability.

### Most Dangerous Terminology Issue
**"Attach YouTube Video"** in EditLinkPage - directly contradicts reusable link model and will prevent creators from reusing links.

### Analytics Alignment
**YES** - Analytics correctly reflects the reusable link architecture via link_usages aggregation.

### Proof UX Sponsor Alignment
**YES** - Proof UX is sponsor-appropriate and correctly handles multi-video attribution.

---

## Next Steps

1. Review this audit with product team
2. Approve Phase 1 terminology changes
3. Implement Phase 1 changes
4. Monitor creator feedback
5. Proceed to Phase 2 if needed

**DO NOT COMMIT YET** - Per user instructions, this is audit-only phase.
