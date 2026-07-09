# TubeLinkr Link Architecture Documentation

**Version:** 1.0  
**Date:** June 24, 2026  
**Purpose:** Technical map of how links work today for safe planning of future large features

---

## 1. Core Data Model

### 1.1 links Table

**Purpose:** Smart Link definitions - reusable link objects that can be attached to multiple videos and placements.

**Level:** Link-level

**Key Columns:**
- `id` (PK, auto-increment) - Unique link identifier
- `user_id` (FK to users) - Link owner
- `slug` (TEXT, UNIQUE with user_id) - URL slug (e.g., "best-plane")
- `original_url` (TEXT) - Destination URL for redirect
- `title` (TEXT, nullable) - Optional link title
- `subtitle` (TEXT, nullable) - Optional manual subtitle for public hub cards
- `video_id` (TEXT, nullable) - **LEGACY** - Base video attachment (deprecated, use link_usages)
- `public_code` (TEXT, UNIQUE) - 6-character global smart short code (e.g., "abc123")
- `placement_count` (INTEGER, default 0) - Cached count of placements
- `is_system` (INTEGER, default 0) - System link flag (referral links cannot be edited/deleted)
- `is_active` (INTEGER, default 1) - Active status
- `created_at` (TEXT) - Creation timestamp
- `updated_at` (TEXT) - Last update timestamp

**Foreign Key Relationships:**
- `user_id` → `users.id` (ON DELETE CASCADE)

**Indexes:**
- `idx_links_user_id` on `user_id`
- `idx_links_public_code` on `public_code` (unique)
- `idx_links_public_code_lookup` on `public_code` (WHERE NOT NULL)

**Constraints:**
- UNIQUE(user_id, slug)

---

### 1.2 link_usages Table

**Purpose:** Reusable link contexts - separates link definition from link usage. Enables one Smart Link to be used across multiple videos with independent tracking.

**Level:** Usage-level (video-specific)

**Key Columns:**
- `id` (PK, auto-increment) - Unique usage identifier
- `link_id` (FK to links) - Parent Smart Link
- `user_id` (FK to users) - Usage owner
- `youtube_video_id` (TEXT, nullable) - YouTube video ID this usage is attached to
- `placement_type` (TEXT, nullable) - Placement type (e.g., "description", "pinned", "legacy")
- `placement_name` (TEXT, nullable) - Human-readable placement name
- `public_code` (TEXT, nullable) - Public-facing code for this usage
- `source_code` (TEXT, nullable) - Internal tracking code for this usage
- `destination_url_snapshot` (TEXT, nullable) - Snapshot of destination URL at creation time
- `title_snapshot` (TEXT, nullable) - Snapshot of link title at creation time
- `is_active` (INTEGER, default 1) - Active status
- `created_at` (TEXT) - Creation timestamp
- `updated_at` (TEXT) - Last update timestamp

**Foreign Key Relationships:**
- `link_id` → `links.id` (ON DELETE CASCADE)
- `user_id` → `users.id` (ON DELETE CASCADE)

**Indexes:**
- `idx_link_usages_link_id` on `link_id`
- `idx_link_usages_user_id` on `user_id`
- `idx_link_usages_video_id` on `youtube_video_id`
- `idx_link_usages_public_code` on `public_code`
- `idx_link_usages_source_code` on `source_code`

**Purpose of Snapshots:**
- `destination_url_snapshot` and `title_snapshot` preserve the state of the link at the time the usage was created. This ensures that if the parent link's destination or title changes, the usage context remains stable for historical reporting.

---

### 1.3 placements Table

**Purpose:** Named placement tracking - tracks where links are placed (description, pinned comment, bio, etc.) with source codes for click attribution.

**Level:** Placement-level

**Key Columns:**
- `id` (PK, auto-increment) - Unique placement identifier
- `link_id` (FK to links) - Parent Smart Link
- `name` (TEXT) - Human-readable placement name
- `type` (TEXT, CHECK constraint) - Placement type: 'description', 'pinned', 'bio', 'short', 'video', 'other'
- `source_code` (TEXT, UNIQUE per link) - Internal tracking code (e.g., "d", "d2", "p", "c1")
- `public_code` (TEXT) - Public-facing code (matches source_code for placements)
- `link_usage_id` (FK to link_usages, nullable) - Optional link usage this placement belongs to
- `youtube_video_id` (TEXT, nullable) - Optional YouTube video ID this placement belongs to
- `created_at` (TEXT) - Creation timestamp
- `updated_at` (TEXT) - Last update timestamp

**Foreign Key Relationships:**
- `link_id` → `links.id` (ON DELETE CASCADE)
- `link_usage_id` → `link_usages.id` (nullable)

**Indexes:**
- `idx_placements_link_id` on `link_id`
- `idx_placements_source_code` on `source_code` (unique)
- `idx_placements_public_code` on `public_code`
- `idx_placements_link_public_code` on (link_id, public_code) (unique)
- `idx_placements_link_usage_id` on `link_usage_id`
- `idx_placements_youtube_video_id` on `youtube_video_id`

**Source Code Generation Rules:**
- Standard types: 'd' (description), 'p' (pinned), 'b' (bio), 's' (short), 'v' (video)
- Sequential increments: 'd2', 'd3', 'p2', 'p3', etc.
- Custom (type='other'): 'c1', 'c2', 'c3', etc.

---

### 1.4 click_events Table

**Purpose:** Click tracking - records every click with attribution context.

**Level:** Click-level

**Key Columns:**
- `id` (PK, auto-increment) - Unique event identifier
- `link_id` (FK to links) - Clicked link
- `link_usage_id` (FK to link_usages, nullable) - Optional link usage context
- `timestamp` (TEXT, indexed) - Event timestamp
- `referrer` (TEXT, nullable) - HTTP referrer header
- `user_agent` (TEXT, nullable) - Browser/client user agent
- `ip_hash` (TEXT, nullable) - Hashed IP address for privacy
- `source` (TEXT, nullable) - Source parameter (e.g., "d", "p", "direct", "legacy")

**Foreign Key Relationships:**
- `link_id` → `links.id` (ON DELETE CASCADE)
- `link_usage_id` → `link_usages.id` (nullable)

**Indexes:**
- `idx_click_events_link_id` on `link_id`
- `idx_click_events_timestamp` on `timestamp`
- `idx_click_events_link_usage_id` on `link_usage_id`

**Source Values:**
- Placement source codes: "d", "d2", "p", "b", "s", "v", "c1", etc.
- "direct" - Direct click with no placement
- "legacy" - Legacy unattributed click
- NULL - Untracked (treated as "direct")

---

### 1.5 proof_shares Table

**Purpose:** Public proof sharing - tracks public proof share links with snapshot data for immutable proof storage.

**Level:** Proof-level

**Key Columns:**
- `id` (PK, auto-increment) - Unique proof share identifier
- `public_token` (TEXT, UNIQUE) - Random public token for proof URL
- `user_id` (FK to users) - Proof owner
- `link_id` (FK to links, nullable) - Associated link
- `link_usage_id` (FK to link_usages, nullable) - Associated link usage
- `youtube_video_id` (TEXT, nullable) - YouTube video ID
- `title` (TEXT, nullable) - Legacy title field
- `human_insight` (TEXT, nullable) - User-added insight text
- `destination_url` (TEXT, nullable) - Legacy destination URL
- `top_source_label` (TEXT, nullable) - Legacy top source label
- `additional_source_labels` (TEXT, nullable) - JSON array of additional source labels
- `is_enabled` (INTEGER, default 1) - Enabled status
- `proof_group_key` (TEXT, nullable) - Stable grouping key for batch operations
- `created_at` (TEXT) - Creation timestamp
- `last_viewed_at` (TEXT, nullable) - Last public view timestamp

**Snapshot Fields (Phase 2 - Immutable Proof Storage):**
- `snapshot_clicks` (INTEGER, nullable) - Click count at snapshot time
- `snapshot_ctr` (REAL, nullable) - CTR at snapshot time
- `snapshot_views` (INTEGER, nullable) - Video views at snapshot time
- `snapshot_link_count` (INTEGER, nullable) - Link count at snapshot time
- `snapshot_video_title` (TEXT, nullable) - Video title at snapshot time
- `snapshot_thumbnail_url` (TEXT, nullable) - Video thumbnail at snapshot time
- `snapshot_destination_domain` (TEXT, nullable) - Destination domain at snapshot time
- `snapshot_destination_url` (TEXT, nullable) - Destination URL at snapshot time
- `snapshot_top_placement_label` (TEXT, nullable) - Top placement label at snapshot time
- `snapshot_generated_at` (TEXT, nullable) - Snapshot generation timestamp
- `snapshot_converting_placements_json` (TEXT, nullable) - JSON array of converting placements

**Foreign Key Relationships:**
- `user_id` → `users.id` (implicit)
- `link_id` → `links.id` (nullable)
- `link_usage_id` → `link_usages.id` (nullable)

**Indexes:**
- `idx_proof_shares_public_token` on `public_token` (unique)
- `idx_proof_shares_user_id` on `user_id`
- `idx_proof_shares_link_id` on `link_id`
- `idx_proof_shares_is_enabled` on `is_enabled`
- `idx_proof_shares_created_at` on `created_at`
- `idx_proof_shares_proof_group_key` on `proof_group_key`

**Proof Group Key Format:**
- With link_id: `user_id::youtube_video_id::link:{link_id}`
- With domain only: `user_id::youtube_video_id::domain:{normalized_domain}`
- Video only: `user_id::youtube_video_id`
- Fallback: `user_id::proof:{id}`

**Proof Modes:**
- **Snapshot mode:** Uses snapshot_* fields (immutable, created at proof generation time)
- **Live mode:** Calculates metrics in real-time (mutable, for ongoing tracking)

---

### 1.6 proof_share_events Table

**Purpose:** Proof engagement analytics - tracks aggregate proof engagement without exposing viewer identity.

**Level:** Proof event-level

**Key Columns:**
- `id` (PK, auto-increment) - Unique event identifier
- `proof_share_id` (FK to proof_shares) - Associated proof share
- `event_type` (TEXT, default 'view') - Event type (currently only 'view')
- `created_at` (TEXT, indexed) - Event timestamp
- `referrer` (TEXT, nullable) - HTTP referrer header
- `user_agent` (TEXT, nullable) - Browser/client user agent
- `ip_hash` (TEXT, nullable) - Hashed IP address for privacy

**Foreign Key Relationships:**
- `proof_share_id` → `proof_shares.id` (implicit)

**Indexes:**
- `idx_proof_share_events_proof_share_id` on `proof_share_id`
- `idx_proof_share_events_created_at` on `created_at`
- `idx_proof_share_events_event_type` on `event_type`

**Privacy Note:**
- IP addresses are hashed using SHA-256 before storage
- No individual viewer identity is exposed
- Only aggregate counts are used for analytics

---

## 2. Link Types / Contexts

### 2.1 Smart Link

**Definition:** A reusable link object in the `links` table.

**Characteristics:**
- Has a unique `slug` per user (e.g., "best-plane")
- Has a global `public_code` (6-character code, e.g., "abc123")
- Can be attached to multiple videos via `link_usages`
- Can have multiple named `placements`
- Represents the destination URL and metadata

**Use Cases:**
- Affiliate links that need to be tracked across multiple videos
- Sponsor links reused across content
- General purpose tracking links

**URL Patterns:**
- `go.tubelinkr.com/{public_code}` (smart short link)
- `go.tubelinkr.com/{username}/{slug}` (legacy branded link)
- `{subdomain}.tubelinkr.com/{slug}` (Pro+ subdomain)

---

### 2.2 Base Video Attachment

**Definition:** A link attached to a specific video using the legacy `links.video_id` field.

**Characteristics:**
- **DEPRECATED** - Use `link_usages` instead
- One-to-one relationship between link and video
- Cannot reuse the same link across multiple videos
- Stored in `links.video_id` column

**Migration Path:**
- Legacy links with `video_id` should have corresponding `link_usages` records
- Backfill migration creates `link_usages` with `placement_type='legacy'`

**Known Limitations:**
- Prevents link reuse across videos
- Causes double-counting when links are reused
- Returns 0 clicks in modern attribution mode (legacy_unattributed)

---

### 2.3 link_usage

**Definition:** A reusable link context in the `link_usages` table that attaches a Smart Link to a specific video.

**Characteristics:**
- Links a `link_id` to a `youtube_video_id`
- Has independent click tracking via `link_usage_id` in `click_events`
- Preserves snapshots of destination URL and title
- Can have multiple usages per link (one per video)
- Has `source_code` for placement-level tracking

**Use Cases:**
- Tracking the same affiliate link across multiple videos
- Measuring video-specific performance for reusable links
- Attribution without link duplication

**Relationship:**
- One `links` record → Many `link_usages` records
- One `link_usages` record → One `youtube_video_id`

---

### 2.4 placement

**Definition:** A named placement in the `placements` table that tracks where a link is placed.

**Characteristics:**
- Belongs to a `link_id`
- Has a `type` (description, pinned, bio, short, video, other)
- Has a unique `source_code` per link (e.g., "d", "d2", "p")
- Has a matching `public_code` for URL generation
- Optionally associated with a `link_usage_id` and `youtube_video_id`

**Placement Types:**
- `description` - YouTube video description
- `pinned` - Pinned comment
- `bio` - Channel bio/about
- `short` - YouTube Short
- `video` - Video itself
- `other` - Custom placement

**Source Code Examples:**
- First description: "d"
- Second description: "d2"
- First pinned: "p"
- Custom placement 1: "c1"

**URL Patterns:**
- `go.tubelinkr.com/{public_code}/{placement_code}` (via smart short link)
- `go.tubelinkr.com/{username}/{slug}/{placement_code}` (legacy)
- `{subdomain}.tubelinkr.com/{slug}/{placement_code}` (Pro+ subdomain)

---

### 2.5 source_code

**Definition:** Internal tracking code used for click attribution in `click_events.source`.

**Characteristics:**
- Stored in `placements.source_code`
- Stored in `link_usages.source_code`
- Written to `click_events.source` on redirect
- Used for counting clicks by placement
- Case-insensitive, normalized to lowercase

**Values:**
- Placement codes: "d", "d2", "p", "b", "s", "v", "c1", etc.
- "direct" - Direct click with no placement
- "legacy" - Legacy unattributed click
- NULL - Untracked (treated as "direct")

**Attribution Logic:**
- Clicks are counted by matching `click_events.source` to `placements.source_code`
- This is the single source of truth for placement click counts

---

### 2.6 public_code

**Definition:** Public-facing code used in URLs for clean, shareable links.

**Characteristics:**
- For `links`: 6-character global code (e.g., "abc123")
- For `placements`: Matches `source_code` (e.g., "d", "d2", "p")
- For `link_usages`: Optional custom code (e.g., "lu_31_JQZ6aM1zLXs_d")

**Uniqueness:**
- `links.public_code`: Globally unique
- `placements.public_code`: Unique per link
- `link_usages.public_code`: No uniqueness constraint

**URL Resolution:**
- `go.tubelinkr.com/{public_code}` → resolves `links.public_code`
- `go.tubelinkr.com/{public_code}/{placement_code}` → resolves placement via `placements.public_code`

---

### 2.7 Direct Click

**Definition:** A click with no placement attribution.

**Characteristics:**
- `click_events.source` is NULL or "direct"
- No corresponding placement record
- Counted as "Direct" in placement breakdowns
- Created when user visits base link URL without placement code

**URL Patterns:**
- `go.tubelinkr.com/{public_code}` (no placement code)
- `go.tubelinkr.com/{username}/{slug}` (no placement code)
- `{subdomain}.tubelinkr.com/{slug}` (no placement code)

---

### 2.8 Legacy/Unattributed Link

**Definition:** A link created before the link_usages/placements system, using only `links.video_id`.

**Characteristics:**
- Has `links.video_id` set
- No corresponding `link_usages` record
- No `placements` records
- Clicks have `source='legacy'` or NULL
- Returns 0 clicks in modern attribution mode

**Migration Status:**
- Backfill migration creates `link_usages` with `placement_type='legacy'`
- Some legacy links may still lack proper attribution

**Known Issues:**
- Lifetime link clicks are shown as 0 in video performance
- Cannot distinguish between video-specific and lifetime clicks
- Should be migrated to proper `link_usages` + `placements`

---

## 3. Current Attribution Modes

### 3.1 Usage Attribution

**Definition:** Click attribution via `link_usage_id` in `click_events`.

**How Records Are Created:**
- User creates a `link_usage` record for a specific video
- Redirect worker sets `click_events.link_usage_id` when processing clicks
- Requires modern tracking infrastructure (link_usages + placements)

**How Clicks Are Counted:**
```sql
SELECT COUNT(*) FROM click_events WHERE link_usage_id = ?
```

**How Placements Are Resolved:**
- Placements are optional in usage attribution
- Clicks can be attributed at the usage level without placement-level detail
- Placement breakdown requires `source` field matching

**How Video Performance Uses It:**
- Primary mode for video-specific click counting
- Counts clicks by `link_usage_id` for the video
- Returns `attribution_mode='usage'`

**How Links Page Uses It:**
- Shows per-usage click counts in `link_usages` array
- Displays `proof_available=true` for usages with `source_code`
- Shows placement data for base video attachment

**How Share Proof Uses It:**
- Live mode: Uses `getVideoClickCount()` which prioritizes usage attribution
- Snapshot mode: Stores `snapshot_clicks` calculated via usage attribution
- Creates proofs with `link_usage_id` context

**Known Limitations:**
- Requires proper `link_usages` setup
- Legacy links without usages fall back to placement or legacy mode
- Placement-level detail requires additional `source` field tracking

---

### 3.2 Placement Attribution

**Definition:** Click attribution via `source` field matching `placements.source_code`.

**How Records Are Created:**
- User creates a `placement` record with `source_code`
- Redirect worker sets `click_events.source` to the placement's `source_code`
- Requires `placements` table with proper `source_code` values

**How Clicks Are Counted:**
```sql
SELECT COUNT(*) FROM click_events 
WHERE link_id = ? AND source = ?
```

**How Placements Are Resolved:**
- Resolved by matching `click_events.source` to `placements.source_code`
- Can be scoped to video via `placements.youtube_video_id` or `placements.link_usage_id`
- Falls back to link-level if no video context

**How Video Performance Uses It:**
- Secondary mode when no `link_usages` exist
- Counts clicks by placement source for the video's links
- Returns `attribution_mode='placement'`

**How Links Page Uses It:**
- Shows placement-level click counts via `getPlacementClickCounts()`
- Displays "Direct" virtual placement for unattributed clicks
- Used in Manage Placements page

**How Share Proof Uses It:**
- Live mode: Uses `getVideoPlacementBreakdown()` for placement breakdown
- Snapshot mode: Stores `snapshot_converting_placements_json`
- Shows top placement label in proof

**Known Limitations:**
- Requires proper `placements` setup
- Can be ambiguous if link is reused across videos without video-scoped placements
- Legacy links without placements fall back to legacy mode

---

### 3.3 Legacy/Unattributed Mode

**Definition:** Fallback mode for links created before the attribution system.

**How Records Are Created:**
- Links created with only `links.video_id`
- No `link_usages` or `placements` records
- Clicks have `source='legacy'` or NULL

**How Clicks Are Counted:**
- Returns 0 clicks in modern attribution mode
- Prevents showing lifetime link clicks as video-specific clicks
- Avoids double-counting when links are reused

**How Placements Are Resolved:**
- No placement resolution
- All clicks treated as unattributed
- No placement breakdown available

**How Video Performance Uses It:**
- Returns `attribution_mode='legacy_unattributed'`
- Shows 0 clicks to avoid misleading data
- Displays message about needing modern tracking

**How Links Page Uses It:**
- Shows `proof_available=false`
- Shows `proof_context_type='legacy'`
- Encourages user to add placements for proper tracking

**How Share Proof Uses It:**
- Cannot create proofs from legacy context
- Requires modern tracking (source_code) for proof generation
- Shows error if user attempts to share proof from legacy link

**Known Limitations:**
- No video-specific click data
- No placement breakdown
- Cannot create Share Proofs
- Should be migrated to proper attribution

---

## 4. URL / Redirect Structure

### 4.1 go.tubelinkr.com

**Route Handler:** `worker.js` (Cloudflare Worker)

**URL Patterns:**
- `go.tubelinkr.com/{public_code}` - Smart short link (Phase 2)
- `go.tubelinkr.com/{public_code}/{placementCode}` - Smart short link with placement
- `go.tubelinkr.com/{username}/{slug}` - Legacy branded link
- `go.tubelinkr.com/{username}/{slug}/{placementCode}` - Legacy branded link with placement

**Resolution Order (Phase 2):**
1. Try path as global `public_code` (1 or 2 segments)
2. Fallback to legacy `username/slug` (2 or 3 segments)

**Database Records Resolved:**
- Smart short link: `links.public_code`
- Legacy: `users.username` + `links.slug`
- Placement: `placements.public_code` or `placements.source_code`

**Click Events Created:**
- Yes - always creates `click_events` record
- Sets `link_id` from resolved link
- Sets `source` from placement code or "direct"
- Sets `link_usage_id` if available

**Source Code vs Public Code:**
- Uses `placements.source_code` for `click_events.source`
- Uses `placements.public_code` for URL resolution
- Falls back to using public_code as source_code for backward compatibility

**Branded Domains/Subdomains:**
- Not supported on go.tubelinkr.com
- Use username subdomains for branded links

---

### 4.2 username.tubelinkr.com

**Route Handler:** `worker.js` (Cloudflare Worker)

**URL Patterns:**
- `{subdomain}.tubelinkr.com/` - Creator hub root
- `{subdomain}.tubelinkr.com/{slug}` - Branded link
- `{subdomain}.tubelinkr.com/{slug}/{placementCode}` - Branded link with placement

**Database Records Resolved:**
- User: `users.subdomain`
- Link: `links.slug` (scoped to user)
- Placement: `placements.public_code` or `placements.source_code`

**Access Control:**
- Requires effective Pro access (paid Pro, referral Pro, or Founder)
- Checks `checkEffectiveProAccess()` function
- Returns 403 if user doesn't have Pro access

**Click Events Created:**
- Yes - always creates `click_events` record
- Same logic as go.tubelinkr.com

**Source Code vs Public Code:**
- Same as go.tubelinkr.com

**Branded Domains/Subdomains:**
- Yes - this is the branded subdomain feature
- Requires Pro+ access
- Subdomain must match `users.subdomain`

---

### 4.3 /invite

**Route Handler:** System links with `slug='invite'` or `slug='my-invite'`

**URL Patterns:**
- `go.tubelinkr.com/{username}/invite` - Referral link
- `go.tubelinkr.com/{username}/my-invite` - Personal referral link

**Database Records Resolved:**
- User: `users.username`
- Link: `links.slug` = 'invite' or 'my-invite'
- System link: `links.is_system = 1`

**Click Events Created:**
- Yes - creates `click_events` record
- Used for referral qualification tracking

**Source Code vs Public Code:**
- Uses system link's `public_code` if available
- No placement tracking for referral links

**Branded Domains/Subdomains:**
- Not supported for referral links
- Uses go.tubelinkr.com only

---

### 4.4 Smart Link URLs

**Route Handler:** `worker.js` (Cloudflare Worker)

**URL Patterns:**
- `go.tubelinkr.com/{public_code}` - Global smart short link
- `go.tubelinkr.com/{username}/{slug}` - Branded smart link
- `{subdomain}.tubelinkr.com/{slug}` - Pro+ branded smart link

**Database Records Resolved:**
- Global: `links.public_code`
- Branded: `users.username` + `links.slug`
- Pro+: `users.subdomain` + `links.slug`

**Click Events Created:**
- Yes - always creates `click_events` record
- Sets `link_id` from resolved link
- Sets `source='direct'` if no placement code

**Source Code vs Public Code:**
- Uses `links.public_code` for resolution
- No source code for base link (direct click)

**Branded Domains/Subdomains:**
- Supported via Pro+ subdomains
- Requires effective Pro access

---

### 4.5 Placement URLs

**Route Handler:** `worker.js` (Cloudflare Worker)

**URL Patterns:**
- `go.tubelinkr.com/{public_code}/{placementCode}` - Smart short link with placement
- `go.tubelinkr.com/{username}/{slug}/{placementCode}` - Branded link with placement
- `{subdomain}.tubelinkr.com/{slug}/{placementCode}` - Pro+ branded link with placement

**Database Records Resolved:**
- Link: via public_code or username/slug
- Placement: `placements.public_code` or `placements.source_code`

**Click Events Created:**
- Yes - always creates `click_events` record
- Sets `link_id` from resolved link
- Sets `source` from placement's `source_code`

**Source Code vs Public Code:**
- Uses `placements.public_code` for URL resolution
- Uses `placements.source_code` for `click_events.source`

**Branded Domains/Subdomains:**
- Supported via Pro+ subdomains
- Requires effective Pro access

---

### 4.6 Proof URLs

**Route Handler:** `functions/api/proof-shares/[token].js`

**URL Patterns:**
- `tubelinkr.com/proof/{public_token}` - Public proof page

**Database Records Resolved:**
- Proof: `proof_shares.public_token`
- User: `proof_shares.user_id`
- Link: `proof_shares.link_id` (nullable)
- Link Usage: `proof_shares.link_usage_id` (nullable)
- Video: `proof_shares.youtube_video_id`

**Click Events Created:**
- No - proof views create `proof_share_events`, not `click_events`
- Proof view events are tracked separately for analytics

**Source Code vs Public Code:**
- Uses `proof_shares.public_token` for URL resolution
- No source code involved in proof URLs

**Branded Domains/Subdomains:**
- Not supported for proof URLs
- Uses main tubelinkr.com domain

---

### 4.7 Creator Hub URLs

**Route Handler:** `worker.js` (Cloudflare Worker) + React app

**URL Patterns:**
- `{subdomain}.tubelinkr.com/` - Creator hub root
- `{subdomain}.tubelinkr.com/{section}` - Hub sections

**Database Records Resolved:**
- User: `users.subdomain`
- Hub Settings: `creator_hub_settings`
- Link Assignments: `creator_hub_link_assignments`
- Sections: `creator_hub_sections`

**Click Events Created:**
- No - hub pages don't create click events
- Hub links may redirect and create click events

**Source Code vs Public Code:**
- Not applicable for hub pages
- Hub links use their own tracking

**Branded Domains/Subdomains:**
- Yes - this is the primary branded subdomain feature
- Requires effective Pro access

---

## 5. Page / API Map

### 5.1 Links Page

**Page:** `src/pages/LinksPage.tsx`

**API Endpoint:** `/api/links` (GET)

**Key Queries:**
- Fetch all user links with click counts
- Fetch `link_usages` for each link
- Fetch placement data for base video attachment
- Fetch YouTube metadata for videos

**Main Data Source:**
- `links` table (primary)
- `link_usages` table (for video contexts)
- `placements` table (for base video placements)
- `click_events` table (for click counts)

**Attribution Logic Used:**
- Uses `/api/links` which calls `getLinkUsageClickCounts()`
- Shows per-usage click counts via `link_usage_id`
- Shows base video placement data
- Determines `proof_available` based on `source_code` presence

**Special Handling:**
- Auto-refreshes every 15 seconds
- Refetches on tab visibility/focus
- Shows proof modal with video-specific metrics from `/api/video/{video_id}`

---

### 5.2 Manage Placements Page

**Page:** `src/pages/ManagePlacementsPage.tsx` (implied from LinksPage navigation)

**API Endpoint:** `/api/placements` (GET, POST, DELETE)

**Key Queries:**
- GET: Fetch placements for a specific `link_id`
- POST: Create new placement with `source_code` generation
- DELETE: Remove placement and update `placement_count`

**Main Data Source:**
- `placements` table (primary)
- `links` table (for `placement_count` updates)
- `click_events` table (for click counts via `getPlacementClickCounts()`)

**Attribution Logic Used:**
- Uses `getPlacementClickCounts()` from `analytics-helper.js`
- Single source of truth for placement click counts
- Counts clicks by matching `click_events.source` to `placements.source_code`
- Adds virtual "Direct" placement for unattributed clicks

**Special Handling:**
- Generates sequential `source_code` values (d, d2, d3...)
- Updates `links.placement_count` on create/delete
- Validates `source_code` uniqueness per link

---

### 5.3 Analytics Page

**Page:** `src/pages/AnalyticsPage.tsx`

**API Endpoint:** `/api/links` (GET) + `/api/proof-shares/list` (GET)

**Key Queries:**
- Fetch all user links with video stats
- Fetch video-level click counts and placement breakdowns
- Fetch placement metadata for source labeling
- Fetch proof views count

**Main Data Source:**
- `links` table (for link list)
- `link_usages` table (for video contexts)
- `click_events` table (for click counts)
- `placements` table (for placement names)
- `proof_shares` table (for proof views)
- `proof_share_events` table (for view counts)

**Attribution Logic Used:**
- Uses `/api/links` which calls `getVideoClickCount()` and `getVideoPlacementBreakdown()`
- Prioritizes usage attribution over placement attribution
- Falls back to legacy mode for unattributed links
- Shows `attribution_mode` in video stats

**Special Handling:**
- Auto-refreshes every 15 seconds
- Shows top performing videos with placement breakdown
- Shows click-by-placement donut chart
- Fetches YouTube connection status for views data

---

### 5.4 Video Performance Page

**Page:** `src/pages/VideoPerformancePage.tsx`

**API Endpoint:** `/api/video/{video_id}` (GET)

**Key Queries:**
- Fetch video-specific click count
- Fetch placement breakdown for the video
- Fetch all Smart Links attached to the video
- Fetch YouTube video metadata (views, title, thumbnail)

**Main Data Source:**
- `link_usages` table (primary for video context)
- `links` table (for Smart Link metadata)
- `placements` table (for placement breakdown)
- `click_events` table (for click counts)
- YouTube API (for views, title, thumbnail)

**Attribution Logic Used:**
- Uses `getVideoClickCount()` from `analytics-helper.js`
- Uses `getVideoPlacementBreakdown()` from `analytics-helper.js`
- Prioritizes usage attribution (link_usage_id)
- Falls back to placement attribution (source matching)
- Returns 0 for legacy/unattributed links

**Special Handling:**
- Shows per-link click counts within the video
- Shows placement breakdown for each link
- Calculates CTR from YouTube views
- Shows attribution mode badge

---

### 5.5 Proofs Page

**Page:** `src/pages/ProofsPage.tsx`

**API Endpoint:** `/api/proof-shares/list` (GET)

**Key Queries:**
- Fetch all proof shares for the user
- Fetch view counts from `proof_share_events`
- Fetch link metadata for associated links

**Main Data Source:**
- `proof_shares` table (primary)
- `proof_share_events` table (for view counts)
- `links` table (for link metadata)

**Attribution Logic Used:**
- Uses snapshot fields if available (snapshot mode)
- Falls back to legacy fields (live mode)
- Does not recalculate metrics for snapshot proofs
- Shows `proof_mode` (snapshot vs live)

**Special Handling:**
- Shows proof view counts
- Distinguishes between snapshot and live proofs
- Shows proof group key for batch operations
- Supports enabling/disabling proofs

---

### 5.6 Public Proof Page

**Page:** Public page (not in src/pages, served via API)

**API Endpoint:** `/api/proof-shares/{token}` (GET)

**Key Queries:**
- Fetch proof share by public token
- Fetch user info for creator username
- Record proof view event (non-blocking)
- Calculate live metrics if in live mode

**Main Data Source:**
- `proof_shares` table (primary)
- `users` table (for creator info)
- `link_usages` table (for live mode metrics)
- `click_events` table (for live mode metrics)
- YouTube API (for live mode views/thumbnail)
- `proof_share_events` table (for view tracking)

**Attribution Logic Used:**
- Snapshot mode: Uses pre-calculated snapshot fields only
- Live mode: Uses `getVideoClickCount()` and `getVideoPlacementBreakdown()`
- Same attribution logic as Video Performance page
- Records view event without blocking proof rendering

**Special Handling:**
- Non-blocking view event recording
- Privacy-safe IP hashing
- Returns safe public data only (no internal IDs)
- Shows proof mode and snapshot timestamp

---

### 5.7 Creator Hub Page

**Page:** React app served via worker.js

**API Endpoints:**
- `/api/creator-hub-settings` (GET, PUT)
- `/api/creator-hub-link-assignments` (GET, POST, DELETE)
- `/api/public-links-by-subdomain` (GET)

**Key Queries:**
- Fetch hub settings (featured video, sections)
- Fetch link assignments for hub sections
- Fetch public links for subdomain

**Main Data Source:**
- `creator_hub_settings` table (primary)
- `creator_hub_link_assignments` table (for link assignments)
- `creator_hub_sections` table (for section definitions)
- `links` table (for link metadata)
- `users` table (for subdomain resolution)

**Attribution Logic Used:**
- No attribution logic for hub configuration
- Links shown in hub use their own tracking
- Clicks on hub links create click events normally

**Special Handling:**
- Requires effective Pro access
- Serves React app shell from worker
- Proxies API requests to main origin
- Enforces subdomain access control

---

### 5.8 Settings Creator Impact Section

**Page:** Part of Settings page (implied)

**API Endpoint:** `/api/creator-impact/status` (GET)

**Key Queries:**
- Fetch creator impact stats
- Fetch referral status
- Fetch recent referrals

**Main Data Source:**
- `creator_impact_stats` table (primary)
- `referrals` table (for referral relationships)
- `users` table (for referral user data)
- `referral_rewards` table (for reward history)

**Attribution Logic Used:**
- No link attribution logic
- Uses separate referral tracking system
- Based on referral qualification (signup + link + 2 clicks)

**Special Handling:**
- Shows total referrals, qualified referrals, paid conversions
- Shows ambassador status and badges
- Separate from link/placement attribution
- Used for Creator Impact reporting only

---

## 6. Single Source of Truth

### 6.1 Total Smart Link Clicks

**Source:** `click_events` table, grouped by `link_id`

**Query:**
```sql
SELECT COUNT(*) FROM click_events WHERE link_id = ?
```

**API Function:** `functions/api/links.js` (GET endpoint)

**Usage:**
- Links Page: Shows total clicks per link
- Analytics Page: Aggregates across all links
- Dashboard Page: Shows total clicks summary

**Notes:**
- This is lifetime link clicks across all videos
- Not video-specific
- Includes all attribution modes

---

### 6.2 Video-Specific Clicks

**Source:** `click_events` table, filtered by `link_usage_id` or placement attribution

**Query (Usage Attribution):**
```sql
SELECT COUNT(*) FROM click_events WHERE link_usage_id IN (
  SELECT id FROM link_usages 
  WHERE user_id = ? AND youtube_video_id = ? AND is_active = 1
)
```

**Query (Placement Attribution):**
```sql
SELECT COUNT(*) FROM click_events 
WHERE link_id IN (
  SELECT id FROM links WHERE user_id = ? AND video_id = ? AND is_active = 1
)
AND source IN (
  SELECT source_code FROM placements 
  WHERE link_id IN (SELECT id FROM links WHERE user_id = ? AND video_id = ?)
  AND (youtube_video_id = ? OR link_usage_id IN (
    SELECT id FROM link_usages WHERE youtube_video_id = ?
  ))
)
```

**API Function:** `getVideoClickCount()` in `functions/api/analytics-helper.js`

**Usage:**
- Video Performance Page: Shows video-specific clicks
- Analytics Page: Shows video stats
- Share Proof (Live Mode): Calculates proof metrics

**Notes:**
- Prioritizes usage attribution over placement attribution
- Returns 0 for legacy/unattributed links
- Prevents double-counting when links are reused

---

### 6.3 Placement Clicks

**Source:** `click_events` table, filtered by `link_id` and `source`

**Query:**
```sql
SELECT COUNT(*) FROM click_events 
WHERE link_id = ? AND source = ?
```

**API Function:** `getPlacementClickCounts()` in `functions/api/analytics-helper.js`

**Usage:**
- Manage Placements Page: Shows placement click counts
- Links Page: Shows base video placement data
- Analytics Page: Shows placement breakdown

**Notes:**
- Single source of truth for placement clicks
- Matches `click_events.source` to `placements.source_code`
- Adds virtual "Direct" placement for unattributed clicks

---

### 6.4 CTR (Click-Through Rate)

**Source:** Calculated from video-specific clicks and YouTube views

**Query:**
```sql
-- Clicks from getVideoClickCount()
-- Views from YouTube API
CTR = (clicks / views) * 100
```

**API Function:** Calculated in `functions/api/links.js` and `functions/api/video/[video_id].js`

**Usage:**
- Video Performance Page: Shows CTR per video
- Analytics Page: Shows CTR in video stats
- Share Proof: Shows CTR in proof

**Notes:**
- Requires YouTube API connection
- Uses video-specific clicks, not lifetime link clicks
- Returns NULL if views not available

---

### 6.5 Traffic Source Breakdown

**Source:** `click_events` table, grouped by `source` field

**Query (Usage Attribution):**
```sql
SELECT source, COUNT(*) as count 
FROM click_events 
WHERE link_usage_id IN (
  SELECT id FROM link_usages 
  WHERE user_id = ? AND youtube_video_id = ? AND is_active = 1
)
GROUP BY source
```

**Query (Placement Attribution):**
```sql
SELECT p.source_code, COUNT(*) as count 
FROM click_events ce
JOIN placements p ON ce.source = p.source_code
WHERE p.link_id IN (
  SELECT id FROM links WHERE user_id = ? AND video_id = ?
)
AND (p.youtube_video_id = ? OR p.link_usage_id IN (
  SELECT id FROM link_usages WHERE youtube_video_id = ?
))
GROUP BY p.source_code
```

**API Function:** `getVideoPlacementBreakdown()` in `functions/api/analytics-helper.js`

**Usage:**
- Video Performance Page: Shows placement breakdown per link
- Analytics Page: Shows placement breakdown per video
- Share Proof: Shows converting placements

**Notes:**
- Uses same attribution logic as video click counting
- Returns empty array for legacy/unattributed links
- Maps source codes to human-readable names

---

### 6.6 Share Proof Metrics

**Source:** `proof_shares` table (snapshot mode) or live calculation (live mode)

**Snapshot Mode:**
- Uses `snapshot_clicks`, `snapshot_ctr`, `snapshot_views`, `snapshot_link_count`
- Uses `snapshot_converting_placements_json` for placement breakdown
- Immutable, created at proof generation time

**Live Mode:**
- Uses `getVideoClickCount()` for clicks
- Uses `getVideoPlacementBreakdown()` for placement breakdown
- Uses YouTube API for views and thumbnail
- Calculates CTR dynamically

**API Function:** `functions/api/proof-shares/[token].js`

**Usage:**
- Public Proof Page: Displays proof metrics
- Proofs Page: Lists proof metrics

**Notes:**
- Snapshot mode prioritized over live mode
- Live mode used for ongoing tracking
- Proof view events tracked separately in `proof_share_events`

---

### 6.7 Creator Impact Referrals

**Source:** `referrals` table + `creator_impact_stats` table

**Query:**
```sql
-- Total referrals
SELECT COUNT(*) FROM referrals WHERE referrer_user_id = ?

-- Qualified referrals
SELECT COUNT(*) FROM referrals 
WHERE referrer_user_id = ? AND is_qualified = 1

-- Paid conversions
SELECT COUNT(*) FROM users 
WHERE referred_by = ? AND subscription_status = 'active'
```

**API Function:** `/api/creator-impact/status`

**Usage:**
- Rewards Page: Shows referral stats
- Settings Creator Impact: Shows impact stats

**Notes:**
- Separate from link attribution system
- Based on referral qualification (signup + link + 2 clicks)
- Includes IP check for fraud prevention

---

## 7. Future Feature Guidance

### 7.1 Revenue Tracking

**Recommended Tables/APIs:**
- **Use:** `link_usages` table for video-specific revenue attribution
- **Use:** `placements` table for placement-level revenue breakdown
- **Use:** `click_events` table for click-level revenue tracking
- **Add:** New `revenue_events` table for revenue transactions

**Tables/APIs to Avoid:**
- **Avoid:** `links.video_id` (legacy, deprecated)
- **Avoid:** Lifetime link clicks for video-specific revenue
- **Avoid:** Direct `link_id` queries without video context

**New Tables Needed:**
- `revenue_events` (id, link_usage_id, placement_id, amount, currency, timestamp, metadata)
- `campaign_revenue` (id, campaign_id, link_usage_id, total_revenue, timestamp)

**Implementation Notes:**
- Use `link_usage_id` for video-specific revenue attribution
- Use `source_code` for placement-level revenue breakdown
- Never attribute lifetime link clicks to a single video
- Consider adding `revenue_snapshot` to `proof_shares` for revenue proofs

---

### 7.2 Sponsor Campaign Reporting

**Recommended Tables/APIs:**
- **Use:** `link_usages` table for campaign-specific usages
- **Use:** `placements` table for campaign placement tracking
- **Use:** `click_events` table for campaign click attribution
- **Add:** New `sponsor_campaigns` table for campaign definitions

**Tables/APIs to Avoid:**
- **Avoid:** Generic `links` queries without campaign context
- **Avoid:** Mixing campaign and non-campaign clicks
- **Avoid:** Legacy `links.video_id` for campaign tracking

**New Tables Needed:**
- `sponsor_campaigns` (id, sponsor_id, name, start_date, end_date, budget, status)
- `campaign_assignments` (id, campaign_id, link_usage_id, placement_id)
- `campaign_events` (id, campaign_id, event_type, amount, timestamp)

**Implementation Notes:**
- Create campaign-specific `link_usages` with `placement_type='campaign'`
- Use `source_code` to distinguish campaign placements
- Report video-specific campaign performance via `link_usage_id`
- Never use lifetime link clicks for campaign reporting

---

### 7.3 Creator Badges

**Recommended Tables/APIs:**
- **Use:** `creator_impact_stats` table for badge eligibility
- **Use:** `referrals` table for referral-based badges
- **Use:** Existing badge logic in Rewards page
- **Add:** New `creator_badges` table for badge definitions

**Tables/APIs to Avoid:**
- **Avoid:** Link attribution for badge eligibility (use separate system)
- **Avoid:** Mixing badge logic with link tracking
- **Avoid:** Badge calculations in hot path (click recording)

**New Tables Needed:**
- `creator_badges` (id, user_id, badge_type, earned_at, expires_at, metadata)
- `badge_definitions` (id, badge_type, name, description, icon, requirements_json)

**Implementation Notes:**
- Keep badge system separate from link attribution
- Use `creator_impact_stats` for impact-based badges
- Use `referrals` for referral-based badges
- Calculate badges asynchronously (not in click path)

---

### 7.4 Link Groups / Folders

**Recommended Tables/APIs:**
- **Use:** `links` table for link definitions
- **Use:** `link_usages` table for video contexts
- **Add:** New `link_groups` table for group definitions
- **Add:** New `link_group_memberships` table for group assignments

**Tables/APIs to Avoid:**
- **Avoid:** Modifying existing `links` table structure
- **Avoid:** Using `video_id` for grouping (use groups table)
- **Avoid:** Grouping by `slug` patterns (fragile)

**New Tables Needed:**
- `link_groups` (id, user_id, name, description, color, icon, created_at)
- `link_group_memberships` (id, group_id, link_id, added_at)

**Implementation Notes:**
- Groups are UI organization only, not attribution
- Don't affect click counting or attribution logic
- Keep group queries separate from hot path
- Consider group-level analytics (aggregated stats)

---

### 7.5 Advanced Analytics

**Recommended Tables/APIs:**
- **Use:** `click_events` table for raw click data
- **Use:** `link_usages` table for video context
- **Use:** `placements` table for placement context
- **Add:** New `analytics_aggregations` table for pre-computed stats

**Tables/APIs to Avoid:**
- **Avoid:** Ad-hoc queries on `click_events` in production
- **Avoid:** Real-time aggregation on large datasets
- **Avoid:** Modifying existing attribution logic

**New Tables Needed:**
- `analytics_aggregations` (id, metric_type, entity_id, date, value, metadata)
- `funnel_events` (id, user_id, funnel_type, step, timestamp, metadata)

**Implementation Notes:**
- Pre-compute aggregations asynchronously
- Use time-series partitioning for large datasets
- Keep raw `click_events` for debugging
- Consider materialized views for common queries

---

### 7.6 Export Reports

**Recommended Tables/APIs:**
- **Use:** `click_events` table for raw data export
- **Use:** `link_usages` table for video context
- **Use:** `placements` table for placement context
- **Add:** New `export_jobs` table for async export tracking

**Tables/APIs to Avoid:**
- **Avoid:** Synchronous exports (use async jobs)
- **Avoid:** Exporting sensitive data (IP hashes, user agents)
- **Avoid:** Large exports without pagination

**New Tables Needed:**
- `export_jobs` (id, user_id, export_type, status, file_url, created_at, completed_at)
- `export_schedules` (id, user_id, export_type, schedule, last_run_at)

**Implementation Notes:**
- Use async job queue for large exports
- Sanitize sensitive data before export
- Support CSV, JSON, and PDF formats
- Cache export results for re-download

---

### 7.7 Public Sponsor Reports

**Recommended Tables/APIs:**
- **Use:** `link_usages` table for video-specific data
- **Use:** `placements` table for placement breakdown
- **Use:** `proof_shares` table for snapshot-based reports
- **Add:** New `sponsor_reports` table for report definitions

**Tables/APIs to Avoid:**
- **Avoid:** Live data for public reports (use snapshots)
- **Avoid:** Exposing internal IDs or sensitive data
- **Avoid:** Real-time calculation in public reports

**New Tables Needed:**
- `sponsor_reports` (id, sponsor_id, report_type, snapshot_data, created_at, expires_at)
- `report_access_tokens` (id, report_id, token, created_at, expires_at, access_count)

**Implementation Notes:**
- Use snapshot-based reporting (like Share Proof)
- Generate reports asynchronously
- Use access tokens for report sharing
- Never expose raw click events or user data

---

### 7.8 Team Accounts

**Recommended Tables/APIs:**
- **Use:** `users` table for individual team members
- **Use:** `links` table for team-owned links
- **Add:** New `teams` table for team definitions
- **Add:** New `team_memberships` table for team member roles

**Tables/APIs to Avoid:**
- **Avoid:** Sharing user credentials
- **Avoid:** Modifying existing `links.user_id` without migration
- **Avoid:** Mixing personal and team links without clear separation

**New Tables Needed:**
- `teams` (id, name, owner_id, created_at, plan, subscription_status)
- `team_memberships` (id, team_id, user_id, role, joined_at)
- `team_link_ownership` (id, team_id, link_id, transferred_at)

**Implementation Notes:**
- Migrate existing `links.user_id` to team ownership
- Add `owner_type` column to `links` (user vs team)
- Keep personal links separate from team links
- Implement role-based access control (RBAC)

---

### 7.9 Ambassador/Referral Leaderboards

**Recommended Tables/APIs:**
- **Use:** `creator_impact_stats` table for impact metrics
- **Use:** `referrals` table for referral counts
- **Use:** Existing referral tracking system
- **Add:** New `leaderboard_entries` table for cached rankings

**Tables/APIs to Avoid:**
- **Avoid:** Real-time leaderboard calculation (use caching)
- **Avoid:** Including sensitive user data in leaderboards
- **Avoid:** Leaderboard queries in hot path

**New Tables Needed:**
- `leaderboard_entries` (id, leaderboard_type, user_id, rank, score, calculated_at)
- `leaderboard_snapshots` (id, leaderboard_type, date, top_entries_json)

**Implementation Notes:**
- Calculate leaderboards asynchronously (e.g., daily)
- Cache results in `leaderboard_entries`
- Use `creator_impact_stats` for impact-based leaderboards
- Use `referrals` for referral-based leaderboards

---

## 8. Risks / Do Not Break Rules

### 8.1 Critical Rules

**1. Never treat lifetime link clicks as video-specific clicks.**
- **Why:** Links can be reused across multiple videos. Lifetime clicks include all videos, not just one.
- **How to avoid:** Always use `link_usage_id` or placement-scoped queries for video-specific metrics.
- **Consequence of breaking:** Double-counting, misleading analytics, incorrect Share Proof data.

**2. Never create proofs from ambiguous video-level context.**
- **Why:** Proofs require immutable, unambiguous video attribution. Legacy links lack this.
- **How to avoid:** Only allow proofs from `link_usages` with `source_code` or placements with video context.
- **Consequence of breaking:** Proofs showing wrong data, user confusion, loss of trust.

**3. Never count legacy links as attributed video clicks.**
- **Why:** Legacy links use `links.video_id` without proper attribution. Lifetime clicks ≠ video clicks.
- **How to avoid:** Return 0 clicks for legacy links in modern attribution mode. Encourage migration.
- **Consequence of breaking:** Inflated video metrics, incorrect CTR calculations.

**4. Never use link_id alone to determine video performance when a link is reused.**
- **Why:** One link can be attached to multiple videos via `link_usages`. `link_id` is not video-specific.
- **How to avoid:** Always use `link_usage_id` or video-scoped placement queries.
- **Consequence of breaking:** Showing wrong video performance, cross-contamination of metrics.

**5. Always preserve snapshot proof immutability.**
- **Why:** Proofs are meant to be immutable records of performance at a point in time.
- **How to avoid:** Never update `snapshot_*` fields after proof creation. Use live mode for ongoing tracking.
- **Consequence of breaking:** Loss of proof integrity, inability to verify historical claims.

**6. Keep Creator Impact reporting separate from billing/pro/founder access control.**
- **Why:** Creator Impact is a separate recognition system from paid subscriptions.
- **How to avoid:** Use `creator_impact_stats` for impact, use `users` table for billing. Don't mix them.
- **Consequence of breaking:** Confusion between impact and access, incorrect access control.

**7. Never use root-level Pages Functions (like [[route]].js or [[catchall]].js).**
- **Why:** These consistently crash the entire TubeLinkr site.
- **How to avoid:** Use API endpoints (functions/api/*) for all routing. Keep routing within /api/ prefix.
- **Consequence of breaking:** Complete site downtime, deployment failures.

---

### 8.2 Data Integrity Rules

**8. Never modify links.video_id for existing links.**
- **Why:** `links.video_id` is deprecated. Modifying it breaks legacy attribution.
- **How to avoid:** Use `link_usages` for new video attachments. Leave `video_id` as-is for legacy links.
- **Consequence of breaking:** Breaks legacy link tracking, data loss.

**9. Never delete link_usages without updating click_events.**
- **Why:** `click_events.link_usage_id` references `link_usages.id`. Orphaned clicks lose context.
- **How to avoid:** Set `click_events.link_usage_id = NULL` before deleting `link_usages`. Or use ON DELETE SET NULL.
- **Consequence of breaking:** Orphaned click events, broken attribution.

**10. Never create placements without source_code.**
- **Why:** `source_code` is the single source of truth for click attribution.
- **How to avoid:** Always generate `source_code` when creating placements. Use sequential generation logic.
- **Consequence of breaking:** Unattributed clicks, broken placement tracking.

**11. Never use public_code for click attribution.**
- **Why:** `public_code` is for URL resolution. `source_code` is for attribution.
- **How to avoid:** Always use `source_code` in `click_events.source`. Map `public_code` to `source_code` in redirect worker.
- **Consequence of breaking:** Incorrect attribution, mismatched analytics.

**12. Never allow duplicate source_code per link.**
- **Why:** `source_code` must be unique per link for unambiguous attribution.
- **How to avoid:** Enforce UNIQUE constraint on (link_id, source_code). Check before insert.
- **Consequence of breaking:** Ambiguous click attribution, incorrect placement counts.

---

### 8.3 Performance Rules

**13. Never query click_events without indexes.**
- **Why:** `click_events` can be large. Full table scans are slow.
- **How to avoid:** Always use indexed columns (link_id, link_usage_id, timestamp). Add indexes for new query patterns.
- **Consequence of breaking:** Slow page loads, timeout errors, database overload.

**14. Never calculate video stats in the client.**
- **Why:** Video stats require complex attribution logic. Client calculation is error-prone.
- **How to avoid:** Use server-side functions (`getVideoClickCount`, `getVideoPlacementBreakdown`).
- **Consequence of breaking:** Inconsistent metrics, client performance issues.

**15. Never fetch all click_events for a user.**
- **Why:** This can return millions of rows. Causes memory issues and timeouts.
- **How to avoid:** Use aggregation queries (COUNT, GROUP BY). Paginate when fetching raw events.
- **Consequence of breaking:** Memory exhaustion, slow queries, API timeouts.

---

### 8.4 Security Rules

**16. Never expose internal IDs in public URLs.**
- **Why:** Internal IDs can be guessed and enumerated. Security risk.
- **How to avoid:** Use `public_code` or `public_token` for public URLs. Keep internal IDs server-side.
- **Consequence of breaking:** ID enumeration attacks, unauthorized access.

**17. Never expose raw IP addresses in APIs.**
- **Why:** IP addresses are PII. Privacy violation.
- **How to avoid:** Always use `ip_hash` (SHA-256). Never return raw IPs in API responses.
- **Consequence of breaking:** Privacy violations, GDPR compliance issues.

**18. Never allow users to modify is_system links.**
- **Why:** System links (referral links) must remain immutable for security.
- **How to avoid:** Check `links.is_system = 1` before allowing edits/deletes. Block modifications.
- **Consequence of breaking:** Security bypass, referral system abuse.

---

### 8.5 Migration Rules

**19. Never drop links.video_id column.**
- **Why:** Legacy links still use this column. Dropping it breaks legacy tracking.
- **How to avoid:** Leave column in place. Mark as deprecated in documentation. Migrate to `link_usages` over time.
- **Consequence of breaking:** Data loss, broken legacy links, user impact.

**20. Never change click_events.source values for existing events.**
- **Why:** `source` values are used for historical attribution. Changing them breaks historical reports.
- **How to avoid:** Never update `click_events.source`. Add new events with new values if needed.
- **Consequence of breaking:** Broken historical analytics, incorrect reports.

**21. Never migrate link_usages without backfilling click_events.**
- **Why:** `click_events.link_usage_id` must reference valid `link_usages.id`.
- **How to avoid:** Update `click_events.link_usage_id` when creating `link_usages`. Use idempotent migration scripts.
- **Consequence of breaking:** Orphaned click events, broken attribution.

---

## 9. Known Weak Points

### 9.1 Legacy Link Migration

**Issue:** Many legacy links still use `links.video_id` without proper `link_usages` and `placements`.

**Impact:**
- Legacy links show 0 clicks in modern attribution mode
- Cannot create Share Proofs from legacy links
- Video performance data is incomplete

**Recommended Fix:**
- Run backfill migration to create `link_usages` for all legacy links
- Create default placements for legacy links
- Notify users to update their links for proper tracking

**Status:** Partially addressed by `backfill-legacy-link-usages.sql`, but some links may still lack proper attribution.

---

### 9.2 Placement Video Context

**Issue:** Some `placements` records lack `youtube_video_id` or `link_usage_id`, making video-scoped queries ambiguous.

**Impact:**
- Placement attribution may include clicks from multiple videos
- Video performance may show incorrect placement breakdown
- Share Proof placement data may be inaccurate

**Recommended Fix:**
- Backfill `placements.youtube_video_id` from associated `link_usages`
- Backfill `placements.link_usage_id` for placements with video context
- Add validation to ensure new placements have video context

**Status:** Partially addressed by `add-placement-video-context.sql`, but backfill may be incomplete.

---

### 9.3 Click Event Orphaning

**Issue:** If `link_usages` are deleted without updating `click_events.link_usage_id`, clicks become orphaned.

**Impact:**
- Orphaned clicks lose video context
- Attribution becomes incomplete
- Historical reports may be inaccurate

**Recommended Fix:**
- Add ON DELETE SET NULL constraint on `click_events.link_usage_id`
- Or use soft deletes for `link_usages` (is_active flag)
- Add periodic cleanup job to identify orphaned clicks

**Status:** Not currently addressed. Risk exists if `link_usages` are deleted.

---

### 9.4 Snapshot Proof Expiration

**Issue:** Snapshot proofs don't have an expiration mechanism. Old proofs may show outdated data.

**Impact:**
- Proofs may show metrics that are no longer relevant
- Users may share outdated performance data
- No way to auto-expire old proofs

**Recommended Fix:**
- Add `expires_at` column to `proof_shares`
- Auto-disable proofs after 90 days
- Add warning when viewing old proofs

**Status:** Not currently implemented. All proofs remain active indefinitely.

---

### 9.5 Public Code Collisions

**Issue:** `links.public_code` is globally unique but generated randomly. Collisions are possible but rare.

**Impact:**
- Link creation fails if collision occurs
- User may need to retry link creation
- Poor user experience if collisions are frequent

**Recommended Fix:**
- Improve collision detection and retry logic
- Use larger character set for public codes
- Consider using deterministic codes based on link_id

**Status:** Collision detection exists in `generateUniquePublicCode()`, but retry logic is limited to 10 attempts.

---

### 9.6 Placement Count Inconsistency

**Issue:** `links.placement_count` is a cached value that can become inconsistent with actual placement count.

**Impact:**
- Dashboard may show incorrect placement count
- Link cards may show wrong placement status
- User confusion about placement state

**Recommended Fix:**
- Add periodic recalculation job
- Use triggers to update placement_count on placement changes
- Or remove cached count and calculate on-demand

**Status:** Manual updates in placement API, but no periodic recalculation.

---

## 10. Recommended Next Cleanup Tasks

### 10.1 High Priority

**1. Complete Legacy Link Migration**
- Run `backfill-legacy-link-usages.sql` on production
- Verify all legacy links have corresponding `link_usages`
- Create default placements for legacy links
- Notify users to update their links

**2. Backfill Placement Video Context**
- Run backfill to set `placements.youtube_video_id` from `link_usages`
- Run backfill to set `placements.link_usage_id` for video-scoped placements
- Add validation to ensure new placements have video context

**3. Add ON DELETE Constraints**
- Add ON DELETE SET NULL for `click_events.link_usage_id`
- Add ON DELETE CASCADE for orphaned records
- Test constraint behavior in staging

---

### 10.2 Medium Priority

**4. Implement Snapshot Proof Expiration**
- Add `expires_at` column to `proof_shares`
- Auto-disable proofs after 90 days
- Add warning when viewing old proofs
- Migrate existing proofs with appropriate expiration

**5. Fix Placement Count Inconsistency**
- Add periodic recalculation job for `links.placement_count`
- Or remove cached count and calculate on-demand
- Add monitoring for placement count drift

**6. Improve Public Code Generation**
- Use larger character set for public codes
- Consider deterministic codes based on link_id
- Add better collision detection and retry logic

---

### 10.3 Low Priority

**7. Add Click Event Cleanup Job**
- Identify and clean up orphaned click events
- Add monitoring for orphaned click rate
- Consider archiving old click events

**8. Implement Proof Group Operations**
- Add batch enable/disable by `proof_group_key`
- Add batch delete by `proof_group_key`
- Add UI for bulk proof management

**9. Add Analytics Aggregation Tables**
- Create `analytics_aggregations` table
- Pre-compute daily/weekly/monthly stats
- Use aggregations for dashboard queries

---

## 11. Architecture Diagrams

### 11.1 Entity Relationship Diagram

```
users (1) ----< (N) links
  |                   |
  |                   | (1) ----< (N) link_usages
  |                   |                   |
  |                   |                   | (1) ----< (N) placements
  |                   |                   |
  |                   |                   | (1) ----< (N) click_events
  |                   |                   |
  |                   |                   | (1) ----< (1) proof_shares ----< (N) proof_share_events
  |
  | (1) ----< (N) creator_impact_stats
  |
  | (1) ----< (N) referrals
  |
  | (1) ----< (N) founder_access
  |
  | (1) ----< (1) creator_hub_settings ----< (N) creator_hub_link_assignments
                                          |
                                          | (N) ----< (1) links
```

### 11.2 Attribution Flow Diagram

```
User Click
  |
  v
worker.js (redirect handler)
  |
  +-- Resolve link (public_code or username/slug)
  |   |
  |   +-- links.public_code OR users.username + links.slug
  |
  +-- Resolve placement (placement_code)
  |   |
  |   +-- placements.public_code OR placements.source_code
  |
  +-- Create click_event
      |
      +-- link_id (from resolved link)
      +-- source (from placement.source_code or 'direct')
      +-- link_usage_id (from placement.link_usage_id or link_usage lookup)
      |
      v
click_events table
```

### 11.3 Video Performance Calculation Flow

```
Video Performance Request
  |
  v
getVideoClickCount(user_id, video_id)
  |
  +-- Check for link_usages with youtube_video_id
  |   |
  |   +-- Found: Count clicks by link_usage_id (usage attribution)
  |   |   |
  |   |   +-- SELECT COUNT(*) FROM click_events WHERE link_usage_id IN (...)
  |   |
  |   +-- Not found: Check for links with video_id
  |       |
  |       +-- Found: Check for placements with video context
  |       |   |
  |       |   +-- Found: Count clicks by placement.source (placement attribution)
  |       |   |   |
  |       |   |   +-- SELECT COUNT(*) FROM click_events WHERE link_id = ? AND source = ?
  |       |
  |       +-- Not found: Return 0 (legacy_unattributed)
  |
  v
Return { count, attribution_mode }
```

### 11.4 Share Proof Generation Flow

```
Share Proof Request
  |
  v
Determine Proof Context
  |
  +-- link_usage_id (modern tracking)
  |   |
  |   +-- Fetch video-specific metrics via getVideoClickCount()
  |   +-- Fetch placement breakdown via getVideoPlacementBreakdown()
  |   +-- Fetch YouTube metadata (views, title, thumbnail)
  |
  +-- link_id + video_id (placement tracking)
  |   |
  |   +-- Fetch video-specific metrics via getVideoClickCount()
  |   +-- Fetch placement breakdown via getVideoPlacementBreakdown()
  |   +-- Fetch YouTube metadata
  |
  +-- link_id only (legacy)
      |
      +-- Reject: Cannot create proof from legacy context
  |
  v
Create proof_shares Record
  |
  +-- Set snapshot_* fields with current metrics
  +-- Set proof_group_key for batch operations
  +-- Generate public_token for URL
  |
  v
Return proof URL
```

---

**Document End**
