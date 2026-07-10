> Legacy TubeLinkr reference only.
> This document exists to preserve historical implementation details.
> New platform work should follow the InLinkr documentation.

# YouTube Description Editor Integration Audit

**Purpose:** Audit framework for ensuring a YouTube description editor integrates with TubeLinkr's existing attribution and Smart Link architecture.

**Key Principle:** The editor must be a **view/controller** for existing TubeLinkr data, not a separate data store or tracking system.

---

## 1. Required Integrations

### 1.1 Must Use Existing Link System

**✓ Required:**
- Editor must fetch links from TubeLinkr's `links` table via `/api/links`
- Editor must use existing `links.public_code` or `links.slug` for link references
- Editor must respect `links.is_active` status (don't insert inactive links)
- Editor must respect `links.is_system` flag (don't allow editing system links)

**✗ Forbidden:**
- Creating a separate "description links" table
- Storing link URLs directly in the editor
- Bypassing the `links` table for link management
- Creating link definitions outside of TubeLinkr

---

### 1.2 Must Use Link Usage Attribution

**✓ Required:**
- When attaching a link to a video, editor must create a `link_usage` record
- Editor must set `link_usage.youtube_video_id` to the target video
- Editor must set `link_usage.placement_type = 'description'`
- Editor must generate `link_usage.source_code` for tracking
- Editor must create/update `placements` records for description placements

**✗ Forbidden:**
- Attaching links without creating `link_usage` records
- Using only `links.video_id` (legacy, deprecated)
- Creating description attachments that bypass the usage system
- Tracking clicks independently of `link_usage_id`

---

### 1.3 Must Use Placement System

**✓ Required:**
- Editor must create `placements` records with `type = 'description'`
- Editor must generate sequential `source_code` values (d, d2, d3...)
- Editor must set `placements.public_code` to match `source_code`
- Editor must associate placements with `link_usage_id` for video context
- Editor must update `links.placement_count` when adding/removing placements

**✗ Forbidden:**
- Creating description placements without `placements` records
- Using custom placement codes that conflict with existing system
- Bypassing the `source_code` generation logic
- Not updating `placement_count` cache

---

### 1.4 Must Respect Attribution Rules

**✓ Required:**
- Editor must use `link_usage_id` for video-specific click attribution
- Editor must use `source_code` for placement-level click attribution
- Editor must never treat lifetime link clicks as video-specific
- Editor must support the three attribution modes (usage, placement, legacy)
- Editor must show attribution mode in video performance view

**✗ Forbidden:**
- Showing lifetime link clicks as video-specific clicks
- Creating proofs from ambiguous video context
- Counting legacy links as attributed video clicks
- Using `link_id` alone for video performance when link is reused

---

## 2. YouTube API Integration

### 2.1 Required YouTube API Operations

**✓ Required:**
- Fetch video description via YouTube Data API (`videos.list`)
- Update video description via YouTube Data API (`videos.update`)
- Fetch video metadata (title, thumbnail, views) for context
- Handle YouTube API quota limits and rate limiting
- Refresh YouTube OAuth tokens before API calls

**✗ Forbidden:**
- Bypassing YouTube OAuth for description updates
- Storing YouTube credentials in the editor
- Making unauthorized YouTube API calls
- Ignoring YouTube API quota limits

---

### 2.2 Description Parsing Logic

**✓ Required:**
- Parse existing description to identify TubeLinkr links
- Match links by `public_code` pattern (6-character codes)
- Match links by `go.tubelinkr.com/{public_code}` URLs
- Match links by `{subdomain}.tubelinkr.com/{slug}` URLs
- Preserve non-TubeLinkr content in description

**✗ Forbidden:**
- Parsing links by destination URL (unreliable)
- Assuming all short links are TubeLinkr links
- Destroying existing description content
- Hardcoding URL patterns without regex

---

### 2.3 Description Generation Logic

**✓ Required:**
- Generate description with TubeLinkr links in proper format
- Use `go.tubelinkr.com/{public_code}/{placement_code}` for tracked links
- Use placement codes (d, d2, d3...) for sequential description placements
- Support custom placement names in generated descriptions
- Allow user to customize link position and formatting

**✗ Forbidden:**
- Generating links without placement codes (breaks attribution)
- Using destination URLs directly (bypasses tracking)
- Generating links that don't match TubeLinkr URL patterns
- Hardcoding link positions without user control

---

## 3. Data Flow Architecture

### 3.1 Fetch Video for Editing

```
User selects video
  |
  v
Editor calls YouTube API to fetch description
  |
  v
Editor parses description to identify TubeLinkr links
  |
  v
Editor calls /api/links to fetch user's Smart Links
  |
  v
Editor calls /api/link-usages to fetch existing usages for video
  |
  v
Editor calls /api/placements to fetch existing placements
  |
  v
Editor matches description links to TubeLinkr records
  |
  v
Editor displays UI with matched links and available links
```

**Key Points:**
- Always fetch from TubeLinkr APIs, don't cache locally
- Match by `public_code` or URL pattern, not destination URL
- Show attribution mode for each matched link
- Allow user to add/remove links from description

---

### 3.2 Add Link to Description

```
User selects Smart Link to add
  |
  v
Editor checks if link_usage exists for video
  |
  +-- If yes: Use existing link_usage
  |
  +-- If no: Create new link_usage via /api/link-usages
  |   |
  |   +-- Set link_id, user_id, youtube_video_id
  |   +-- Set placement_type = 'description'
  |   +-- Generate source_code
  |
  v
Editor checks if placement exists for link_usage
  |
  +-- If yes: Use existing placement
  |
  +-- If no: Create new placement via /api/placements
  |   |
  |   +-- Set link_id, name, type = 'description'
  |   +-- Generate source_code (d, d2, d3...)
  |   +-- Set link_usage_id and youtube_video_id
  |
  v
Editor generates link URL: go.tubelinkr.com/{public_code}/{source_code}
  |
  v
Editor inserts link into description at user-selected position
  |
  v
Editor updates description via YouTube API
```

**Key Points:**
- Always create `link_usage` before creating `placement`
- Use sequential `source_code` generation (d, d2, d3...)
- Include `link_usage_id` and `youtube_video_id` in placement
- Update `links.placement_count` after placement creation

---

### 3.3 Remove Link from Description

```
User removes link from description
  |
  v
Editor identifies the placement record (by source_code)
  |
  v
Editor deletes placement via /api/placements (DELETE)
  |
  v
Editor removes link URL from description
  |
  v
Editor updates description via YouTube API
  |
  v
Editor checks if link_usage has remaining placements
  |
  +-- If no: Optionally delete link_usage (or keep for history)
  |
  +-- If yes: Keep link_usage for other placements
```

**Key Points:**
- Delete placement, not link_usage (unless no other placements)
- Don't delete the link itself (may be used in other videos)
- Update `links.placement_count` after placement deletion
- Consider keeping `link_usage` for historical tracking

---

### 3.4 Save Description

```
User clicks save
  |
  v
Editor validates all links in description
  |
  +-- Check that all TubeLinkr links have corresponding records
  +-- Check that placement codes are valid
  +-- Check that link_usages exist for video
  |
  v
Editor calls YouTube API to update description
  |
  v
Editor syncs TubeLinkr records with description
  |
  +-- Create missing link_usages
  +-- Create missing placements
  +-- Delete orphaned placements
  +-- Update placement_count
  |
  v
Editor shows success/error message
```

**Key Points:**
- Validate before YouTube API call (fail fast)
- Sync TubeLinkr records after successful YouTube update
- Handle YouTube API errors gracefully
- Rollback TubeLinkr changes if YouTube update fails

---

## 4. UI/UX Integration Points

### 4.1 Link Selection UI

**✓ Required:**
- Show user's Smart Links from `/api/links`
- Display link title, destination URL, and click count
- Show existing placements for the video
- Indicate which links are already in description
- Show attribution mode (usage/placement/legacy)
- Allow filtering by link attributes

**✗ Forbidden:**
- Creating a separate link management UI
- Showing links that aren't in TubeLinkr
- Hiding attribution mode from user
- Not showing click counts

---

### 4.2 Description Editor UI

**✓ Required:**
- Show full description with TubeLinkr links highlighted
- Allow inline editing of link position
- Show placement code for each link (d, d2, d3...)
- Allow custom placement names
- Show preview of generated link URLs
- Validate link format before save

**✗ Forbidden:**
- Plain text editor without link highlighting
- Not showing placement codes
- Allowing invalid link formats
- Hiding link attribution context

---

### 4.3 Video Performance Integration

**✓ Required:**
- Show video-specific click counts for each link
- Show placement breakdown (d, d2, d3...)
- Link to Video Performance page for detailed analytics
- Show CTR for the video
- Show attribution mode badge
- Refresh metrics after description save

**✗ Forbidden:**
- Showing lifetime link clicks as video-specific
- Not showing placement breakdown
- Hiding attribution mode
- Not linking to Video Performance page

---

### 4.4 Share Proof Integration

**✓ Required:**
- Allow creating Share Proof from description editor
- Use existing proof creation logic from Video Performance
- Show proof availability indicator
- Link to Proofs page for proof management
- Use snapshot mode for proofs (immutable)

**✗ Forbidden:**
- Creating separate proof system
- Creating proofs from legacy context
- Using live mode for description proofs
- Bypassing existing proof API

---

## 5. API Integration Points

### 5.1 Required API Calls

**✓ Required:**
- `GET /api/links` - Fetch user's Smart Links
- `GET /api/link-usages` - Fetch existing usages for video
- `GET /api/placements` - Fetch existing placements
- `POST /api/link-usages` - Create new link usage
- `POST /api/placements` - Create new placement
- `DELETE /api/placements` - Delete placement
- `GET /api/video/{video_id}` - Fetch video performance data
- `POST /api/proof-shares/create` - Create Share Proof

**✗ Forbidden:**
- Creating new API endpoints for description editing
- Bypassing existing APIs for link management
- Creating separate tracking APIs
- Modifying existing APIs without coordination

---

### 5.2 YouTube API Integration

**✓ Required:**
- Use YouTube Data API v3
- Authenticate via YouTube OAuth (existing system)
- Use `videos.list` to fetch description
- Use `videos.update` to update description
- Handle quota limits (10,000 units/day)
- Implement retry logic for transient errors

**✗ Forbidden:**
- Using YouTube API without OAuth
- Storing YouTube credentials
- Ignoring quota limits
- Not handling API errors

---

### 5.3 Error Handling

**✓ Required:**
- Handle YouTube API errors gracefully
- Handle TubeLinkr API errors gracefully
- Show user-friendly error messages
- Implement retry logic for transient errors
- Log errors for debugging
- Rollback changes on failure

**✗ Forbidden:**
- Silently failing on errors
- Showing raw API errors to users
- Not implementing retry logic
- Not rolling back on failure

---

## 6. Forbidden Patterns

### 6.1 Standalone Data Store

**✗ Forbidden:**
- Creating a separate "description_links" table
- Storing link metadata in the editor
- Caching link data locally without sync
- Creating a separate tracking system

**Why:** Breaks attribution, creates data inconsistency, bypasses single source of truth

---

### 6.2 Bypassing Attribution

**✗ Forbidden:**
- Creating links without `link_usage` records
- Creating placements without `source_code`
- Using destination URLs for tracking
- Treating lifetime clicks as video-specific

**Why:** Breaks attribution logic, violates core architecture rules

---

### 6.3 Direct YouTube Manipulation

**✗ Forbidden:**
- Updating YouTube description without TubeLinkr sync
- Parsing description without matching to TubeLinkr records
- Creating links that don't match TubeLinkr URL patterns
- Ignoring existing TubeLinkr links in description

**Why:** Creates orphaned links, breaks tracking, data inconsistency

---

### 6.4 Separate UI Components

**✗ Forbidden:**
- Creating separate link picker component
- Creating separate placement manager
- Creating separate analytics view
- Duplicating existing TubeLinkr UI

**Why:** UX inconsistency, maintenance burden, data inconsistency

---

## 7. Testing Requirements

### 7.1 Integration Tests

**✓ Required:**
- Test link usage creation when adding link to description
- Test placement creation with correct `source_code`
- Test `placement_count` updates
- Test YouTube API description fetch/update
- Test description parsing for TubeLinkr links
- Test error handling and rollback

---

### 7.2 Attribution Tests

**✓ Required:**
- Test that clicks are attributed via `link_usage_id`
- Test that placement clicks use `source_code`
- Test that legacy links return 0 video-specific clicks
- Test that reused links don't double-count
- Test that Share Proof uses correct attribution

---

### 7.3 Edge Cases

**✓ Required:**
- Test with video that has no existing links
- Test with video that has existing legacy links
- Test with video that has multiple links
- Test with description that has non-TubeLinkr links
- Test with YouTube API quota exceeded
- Test with network errors

---

## 8. Migration Considerations

### 8.1 Existing Descriptions

**✓ Required:**
- Parse existing YouTube descriptions to identify TubeLinkr links
- Match existing links to TubeLinkr records
- Create missing `link_usage` records for existing links
- Create missing `placement` records for existing links
- Backfill `placement_count` for affected links

**✗ Forbidden:**
- Ignoring existing descriptions
- Recreating all descriptions from scratch
- Losing existing link data
- Not backfilling attribution records

---

### 8.2 Legacy Links

**✓ Required:**
- Identify legacy links (using `links.video_id`)
- Create `link_usage` records for legacy links
- Create `placement` records for legacy links
- Notify users about legacy link status
- Encourage migration to modern tracking

**✗ Forbidden:**
- Ignoring legacy links
- Deleting legacy links without migration
- Treating legacy links as modern links
- Not notifying users about legacy status

---

## 9. Performance Considerations

### 9.1 API Call Optimization

**✓ Required:**
- Batch API calls where possible
- Cache YouTube description data briefly
- Use pagination for large link lists
- Implement debouncing for auto-save
- Use WebSocket or polling for real-time updates

**✗ Forbidden:**
- Making excessive API calls
- Not implementing caching
- Fetching all data on every render
- Not implementing debouncing

---

### 9.2 YouTube API Quota

**✓ Required:**
- Track YouTube API quota usage
- Implement rate limiting
- Use efficient API calls (batch where possible)
- Cache YouTube data where appropriate
- Handle quota exceeded gracefully

**✗ Forbidden:**
- Ignoring quota limits
- Making unnecessary API calls
- Not caching YouTube data
- Not handling quota exceeded

---

## 10. Security Considerations

### 10.1 Access Control

**✓ Required:**
- Use existing TubeLinkr authentication (Clerk)
- Check user ownership of links before editing
- Check user ownership of videos before updating
- Validate YouTube OAuth tokens
- Implement rate limiting per user

**✗ Forbidden:**
- Bypassing TubeLinkr authentication
- Allowing users to edit other users' links
- Allowing users to edit other users' videos
- Not validating OAuth tokens

---

### 10.2 Data Validation

**✓ Required:**
- Validate all link URLs before insertion
- Validate placement codes before creation
- Validate YouTube video IDs before API calls
- Sanitize user input for description
- Validate description length (YouTube limits)

**✗ Forbidden:**
- Inserting unvalidated URLs
- Creating invalid placement codes
- Not validating video IDs
- Not sanitizing user input

---

## 11. Success Criteria

### 11.1 Functional Requirements

- [ ] Editor fetches and displays user's Smart Links
- [ ] Editor creates `link_usage` records when attaching links to videos
- [ ] Editor creates `placement` records with correct `source_code`
- [ ] Editor updates YouTube descriptions via YouTube API
- [ ] Editor parses existing descriptions to identify TubeLinkr links
- [ ] Editor shows video-specific click counts and placement breakdown
- [ ] Editor integrates with Share Proof creation
- [ ] Editor handles errors gracefully

### 11.2 Attribution Requirements

- [ ] All clicks are attributed via `link_usage_id` or `source_code`
- [ ] Lifetime link clicks are never shown as video-specific
- [ ] Legacy links are handled correctly (return 0 video-specific clicks)
- [ ] Reused links don't double-count clicks
- [ ] Attribution mode is displayed to users

### 11.3 Integration Requirements

- [ ] No separate data store is created
- [ ] All data flows through existing TubeLinkr APIs
- [ ] No new API endpoints are created (unless necessary)
- [ ] Existing UI components are reused where possible
- [ ] YouTube API integration uses existing OAuth

---

## 12. Recommended Implementation Order

### Phase 1: Core Integration
1. Implement link fetching from `/api/links`
2. Implement link usage creation via `/api/link-usages`
3. Implement placement creation via `/api/placements`
4. Implement YouTube API fetch/update
5. Implement basic description parsing

### Phase 2: Attribution Integration
1. Implement video-specific click counting
2. Implement placement breakdown display
3. Implement attribution mode display
4. Integrate with Video Performance page
5. Integrate with Share Proof creation

### Phase 3: UI Polish
1. Implement link highlighting in description
2. Implement placement code display
3. Implement custom placement names
4. Implement error handling and rollback
5. Implement performance optimizations

### Phase 4: Migration
1. Parse existing YouTube descriptions
2. Backfill `link_usage` records
3. Backfill `placement` records
4. Notify users about legacy links
5. Encourage migration to modern tracking

---

**Conclusion:** The YouTube description editor must be tightly integrated with TubeLinkr's existing attribution and Smart Link architecture. It should not create any separate data store or tracking system. All link operations must flow through the existing `links`, `link_usages`, and `placements` tables, and all click attribution must use the existing `link_usage_id` and `source_code` system.
