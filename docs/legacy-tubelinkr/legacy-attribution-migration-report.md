> Legacy TubeLinkr reference only.
> This document exists to preserve historical implementation details.
> New platform work should follow the InLinkr documentation.

# Legacy Attribution Migration Report

## Purpose

This report identifies all legacy links where `links.video_id` exists but no matching `link_usage` exists. These links are using the old attribution model and need to be migrated to the modern `link_usages`-based model.

## Diagnostic Queries

Run the diagnostic queries in `migrations/diagnose-legacy-links.sql` to generate the following reports:

### Report 1: Legacy Links Without Corresponding link_usages

Shows each legacy link with its current `link_usage` status.

**Columns:**
- `link_id` - Link ID
- `user_id` - User ID
- `slug` - Link slug
- `title` - Link title
- `original_url` - Destination URL
- `legacy_video_id` - Old `links.video_id` value
- `is_active` - Link active status
- `link_usage_status` - 'MISSING_LINK_USAGE' or 'HAS_LINK_USAGE'
- `existing_link_usage_id` - Existing link_usage ID if present
- `link_usage_video_id` - Video ID from existing link_usage
- `placement_type` - Placement type from existing link_usage
- `placement_name` - Placement name from existing link_usage
- `link_usage_active` - Active status of existing link_usage

### Report 2: Count of Legacy Links by User

Shows the distribution of legacy links across users.

**Columns:**
- `user_id` - User ID
- `username` - Username
- `legacy_link_count` - Total legacy links for user
- `missing_link_usage_count` - Links without link_usage
- `has_link_usage_count` - Links with existing link_usage

### Report 3: Legacy Links by Video ID

Shows videos with multiple legacy links.

**Columns:**
- `video_id` - YouTube video ID
- `legacy_link_count` - Total legacy links for video
- `missing_link_usage_count` - Links without link_usage
- `link_slugs` - Comma-separated list of link slugs

### Report 4: Click Events for Legacy Links

Shows click count impact for each legacy link.

**Columns:**
- `link_id` - Link ID
- `slug` - Link slug
- `legacy_video_id` - Old `links.video_id` value
- `total_clicks` - Total clicks for this link
- `clicks_without_link_usage_id` - Clicks without link_usage_id
- `clicks_with_link_usage_id` - Clicks with link_usage_id
- `first_click` - First click timestamp
- `last_click` - Last click timestamp

### Report 5: Placement Records for Legacy Links

Shows placement records associated with legacy links.

**Columns:**
- `link_id` - Link ID
- `slug` - Link slug
- `legacy_video_id` - Old `links.video_id` value
- `placement_id` - Placement ID
- `placement_name` - Placement name
- `placement_type` - Placement type
- `source_code` - Source code
- `link_usage_id` - link_usage_id from placement
- `placement_video_id` - youtube_video_id from placement
- `placement_video_context` - Video context status

## How to Run the Diagnostic

1. Open Cloudflare D1 dashboard
2. Select the TubeLinkr database
3. Run each query from `migrations/diagnose-legacy-links.sql`
4. Export results to CSV for analysis

## Expected Findings

Based on the current bug (JQZ6aM1zLXs showing 8 instead of 5), we expect to find:

1. **JQZ6aM1zLXs** may have a legacy link with `links.video_id = 'JQZ6aM1zLXs'` but no corresponding `link_usage`
2. **AA1kfTe-dO0** may have a legacy link with `links.video_id = 'AA1kfTe-dO0'` but no corresponding `link_usage`
3. Both links may point to the same Smart Link (same `link_id`)
4. Click events may have `link_usage_id IS NULL` for both videos
5. Placement records may have `youtube_video_id` set directly without `link_usage_id`

## Repair Plan

See `migrations/backfill-legacy-link-usages.sql` for the migration script.

## Risks

1. **Data Loss**: If the migration script creates duplicate `link_usage` records, it could cause double-counting
2. **Click Attribution**: If click events have incorrect `link_usage_id` values, attribution will be wrong
3. **Placement Linkage**: If placement records have incorrect `youtube_video_id` values, they won't link correctly
4. **User Impact**: Users may see different click counts after migration

## Rollback Plan

If the migration causes issues:
1. Delete newly created `link_usage` records (identified by `created_at` timestamp)
2. Restore `links.video_id` values if they were cleared
3. Verify click counts match pre-migration values

## Verification

After migration, verify:
1. All legacy links have corresponding `link_usage` records
2. Click counts match pre-migration values
3. Video Performance pages show correct video-scoped data
4. Links page shows correct aggregate data
