> Legacy TubeLinkr reference only.
> This document exists to preserve historical implementation details.
> New platform work should follow the InLinkr documentation.

# Video Tracking Architecture

## Current Source of Truth

**`link_usages`** is the authoritative source for video tracking in Analytics.

Each `link_usage` record represents a historical association between a smart link and a YouTube video, created when a placement is added. This table stores:
- `youtube_video_id` - The YouTube video ID
- `link_id` - The associated smart link
- `placement_type`, `placement_name` - Context about how the video was attached
- `title_snapshot`, `thumbnail` - Cached video metadata
- `created_at`, `updated_at` - Timestamps

Analytics queries `link_usages` to build the list of tracked videos, ensuring historical data is preserved even if placements are deleted.

## Legacy Fields

The `links` table contains legacy video fields that are being deprecated:

- `links.video_id` - Base/default video attached directly to a link
- `links.video_title` - Title of the base video
- `links.video_thumbnail` - Thumbnail URL of the base video

### Why These Fields Still Exist

These fields were part of the original product design where videos could be attached directly to links without placements. They still exist because:

1. **Historical data** - Many existing links have `video_id` set
2. **Migration complexity** - Removing columns requires careful schema migration
3. **Backward compatibility** - Some code paths may still reference them
4. **Rollout safety** - Keeping them allows rollback if issues arise

## Code Paths Still Reading/Writing Legacy Fields

### Reading (Still Active)

- `functions/api/public-links-by-subdomain.js` - Selects `video_id` for public link pages
- `functions/api/placements.js` - Selects `video_id` for placement logic
- `functions/api/creator-hub-settings.js` - Selects `video_id` for Creator Hub
- `functions/api/creator-hub-link-assignments.js` - Selects `video_id` in multiple queries
- `functions/api/diagnostics/attribution/[video_id].js` - Uses `video_id` for attribution
- `src/pages/PublicLinkHubPage.tsx` - Displays `link.video_id` for public pages
- `src/pages/LinksPage.tsx` - Checks `link.video_id` for conditional rendering
- `src/pages/EditLinkPage.tsx` - Initializes `selectedVideoId` from `link.video_id`

### Writing (Still Active)

- `functions/api/links.js` (POST) - Accepts and inserts `video_id` when creating links
- `functions/api/links.js` (PUT) - Accepts and updates `video_id`, `video_title`, `video_thumbnail`
- `functions/api/links/[id].js` (PUT) - Accepts and updates `video_id`, `video_title`, `video_thumbnail`
- `src/pages/NewLinkPage.tsx` - Sends `video_id` when creating links

### Analytics (Updated)

- `functions/api/links.js` (GET) - **No longer reads** `links.video_id` for Analytics aggregation (Phase 2 change)

## Long-Term Plan to Retire Legacy Fields

### Phase 1: Stop Writing to Legacy Fields (Partially Complete)

**Status:** Reverted due to schema mismatch

Originally removed `video_id` from link creation/update endpoints, but this exposed that `video_title` and `video_thumbnail` columns were never added to the database schema. Migration 035 was created to add these columns, but Phase 1 was reverted to restore link creation functionality.

**Next Steps:**
1. Ensure migration 035 is applied to all environments
2. Remove `video_id` from link creation (POST endpoint)
3. Remove `video_id`, `video_title`, `video_thumbnail` from link updates (PUT endpoints)
4. Remove `video_id` from NewLinkPage.tsx

### Phase 2: Stop Reading Legacy Fields for Analytics (Complete)

**Status:** Deployed to master (commit 80e8325)

Analytics now only uses `link_usages` for video tracking. `links.video_id` is ignored in the Analytics aggregation query.

### Phase 3: Clear Legacy Data (Future)

**Status:** Not started

Once Phase 1 is complete and no new legacy data is being written:
1. Clear all `links.video_id`, `video_title`, `video_thumbnail` fields to NULL
2. Verify Analytics still works correctly
3. Optionally drop the columns after a stabilization period

### Phase 4: Remove Legacy Code Paths (Future)

**Status:** Not started

Update or remove code paths that still read legacy fields:
- Public link pages should use placement data
- Creator Hub should use placement data
- Diagnostics should use placement data
- UI components should use placement data

## Desired Architecture

```
Smart Link
    ↓
Placement
    ↓
YouTube Video
```

**Rules:**
- Smart links should not have base/default videos
- Videos should only be attached through placements
- `link_usages` is the single source of truth for video tracking
- Analytics uses `link_usages` exclusively
- Historical data is preserved even if placements are deleted

## Backfill Performed (June 28, 2026)

### Issue

After Phase 2 deployment, 6 legitimate videos disappeared from Analytics because they only existed in `links.video_id` and had no corresponding `link_usage` records.

### Root Cause

The videos were created before the placement system was fully implemented and were never backfilled to `link_usages`. When Analytics stopped reading `links.video_id`, these videos vanished.

### Backfill Query

Created 109 link_usage records for legacy base videos:

```sql
INSERT OR IGNORE INTO link_usages (
  link_id,
  user_id,
  youtube_video_id,
  placement_type,
  placement_name,
  public_code,
  source_code,
  destination_url_snapshot,
  title_snapshot,
  is_active,
  created_at,
  updated_at
)
SELECT
  l.id,
  l.user_id,
  l.video_id,
  'legacy_base_video',
  'Legacy Base Video',
  'legacy_base_' || l.id || '_' || l.video_id,
  NULL,
  l.original_url,
  l.title,
  l.is_active,
  l.created_at,
  datetime('now')
FROM links l
WHERE l.video_id IS NOT NULL
  AND l.video_id != ''
  AND l.video_id != 'rrsAWjLkn0M'
  AND l.is_system = 0
  AND NOT EXISTS (
    SELECT 1 FROM link_usages lu
    WHERE lu.link_id = l.id
      AND lu.youtube_video_id = l.video_id
  );
```

### Safety Conditions

- Excluded `rrsAWjLkn0M` (test video intentionally cleared from Invite link)
- Excluded system links (`is_system = 0`)
- Used `INSERT OR IGNORE` to prevent duplicates
- Used `NOT EXISTS` guard to avoid recreating existing records

### Result

- 109 link_usage records created
- 6 missing videos restored to Analytics
- Invite link remains free of video associations
- No data deleted (click_events, proof_shares, placements preserved)

## Invite Link Cleanup

### Issue

The Invite (system) link had a legacy `link_usage` record (id=27) with `youtube_video_id = rrsAWjLkn0M`, causing the test video to appear in Analytics even though the link itself had no base video.

### Cleanup Query

```sql
UPDATE link_usages
SET youtube_video_id = NULL
WHERE id = 27
AND link_id = 3
AND youtube_video_id = 'rrsAWjLkn0M';
```

### Result

- Invite link now has no video association
- Test video `rrsAWjLkn0M` no longer appears from Invite link
- Link_usage record preserved (only video_id cleared)
- rrsAWjLkn0M still appears in Analytics from other user links (expected)

## System Link Video Field Clearing

### Issue

System links (like Invite) are protected from edits, but their base video fields needed to be clearable.

### Solution

Modified update endpoints to allow clearing video fields on system links while blocking other edits:

**functions/api/links.js (PUT):**
- Allows updating `video_id`, `video_title`, `video_thumbnail` on system links
- Blocks other field updates (slug, title, destination, is_active)
- Checks if only video fields are being updated before allowing system link edits

**functions/api/links/[id].js (PUT):**
- Same logic applied for individual link updates

### Result

- System links can now have base video cleared via UI
- System links remain protected from other modifications
- Invite link base video can be removed through Manage Placements

## Migration Files

### 035_add_link_video_title_thumbnail.sql

Adds missing `video_title` and `video_thumbnail` columns to `links` table. These columns were referenced in the API but never added via migration, causing schema mismatches.

### backfill-legacy-base-videos.sql

One-time backfill to create `link_usage` records for legacy base videos that only existed in `links.video_id`. Ensures Analytics shows all tracked videos after Phase 2 deployment.

## References

- `migrations/backfill-legacy-link-usages.sql` - Original backfill that created link_usages from links.video_id
- `migrations/cloudflare-video-id-migration.sql` - Original migration that added video_id column
- `migrations/cloudflare-link-usages-migration.sql` - Migration that created link_usages table
