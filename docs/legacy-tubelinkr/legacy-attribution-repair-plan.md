> Legacy TubeLinkr reference only.
> This document exists to preserve historical implementation details.
> New platform work should follow the InLinkr documentation.

# Legacy Attribution Repair Plan

## Problem Statement

Smart Links can be reused across multiple videos, but the legacy `links.video_id` model only allows one video per link. This causes cross-video data leakage in Video Performance pages.

**Example Bug:**
- Video JQZ6aM1zLXs shows 8 clicks (includes 3 from AA1kfTe-dO0)
- Video AA1kfTe-dO0 shows 3 clicks
- Both videos use the same Smart Link
- The Smart Link has `links.video_id` set to one video, causing the other to inherit wrong data

## Root Cause

1. **Legacy Model**: `links.video_id` stores a single video ID per link
2. **Modern Model**: `link_usages` table allows multiple video contexts per link
3. **Data Gap**: Some links still use `links.video_id` without corresponding `link_usage` records
4. **Click Events**: Some clicks have `link_usage_id IS NULL`, falling back to `link_id` aggregation

## Repair Strategy

### Phase 1: Diagnostic (Do Not Touch Data)

1. Run `migrations/diagnose-legacy-links.sql` to identify:
   - All legacy links with `links.video_id` but no `link_usage`
   - Click count impact for each legacy link
   - Placement records for each legacy link
   - Users affected by legacy links

2. Export results to CSV for analysis

3. **Decision Point**: If legacy links have significant click data, proceed with caution. If minimal, proceed with migration.

### Phase 2: Backfill link_usages for Legacy Links

**Goal**: Create `link_usage` records for all legacy links.

**Logic**:
- For each legacy link with `links.video_id`:
  - Create a `link_usage` record with:
    - `link_id` = legacy link ID
    - `user_id` = legacy link user ID
    - `youtube_video_id` = `links.video_id`
    - `placement_type` = 'legacy' (or infer from placement records)
    - `placement_name` = 'Legacy Link' (or infer from placement records)
    - `public_code` = generate unique code
    - `source_code` = generate unique source code
    - `destination_url_snapshot` = `links.original_url`
    - `title_snapshot` = `links.title`
    - `is_active` = `links.is_active`
    - `created_at` = `links.created_at`
    - `updated_at` = current timestamp

**Edge Cases**:
- If `link_usage` already exists for this `link_id` + `youtube_video_id`, skip
- If placement records exist, infer `placement_type` and `placement_name` from them
- If multiple placement records exist for the same video, create multiple `link_usage` records

### Phase 3: Backfill click_events.link_usage_id

**Goal**: Update click events to use the new `link_usage_id`.

**Logic**:
- For each click event with `link_usage_id IS NULL`:
  - Find the corresponding `link_usage` record (by `link_id` + `youtube_video_id` or by `source` + `link_id`)
  - Update `click_events.link_usage_id` = `link_usage.id`

**Edge Cases**:
- If no matching `link_usage` exists, leave as NULL (will be direct/unattributed)
- If multiple `link_usage` records exist for the same `link_id`, use `source` to match
- If `source` is NULL, use the first `link_usage` record for that `link_id`

### Phase 4: Update placement records

**Goal**: Ensure placement records have correct `link_usage_id`.

**Logic**:
- For each placement with `link_usage_id IS NULL` and `youtube_video_id` set:
  - Find the corresponding `link_usage` record (by `link_id` + `youtube_video_id`)
  - Update `placements.link_usage_id` = `link_usage.id`

**Edge Cases**:
- If no matching `link_usage` exists, create one
- If multiple `link_usage` records exist, use `source_code` to match

### Phase 5: Clean up legacy data

**Goal**: Remove legacy `links.video_id` column after migration is verified.

**Logic**:
- Set `links.video_id = NULL` for all links
- Remove the column entirely (after verification)

**Edge Cases**:
- Do this only after verifying all data is correctly migrated
- Keep a backup of the data before removal

### Phase 6: Update Application Code

**Goal**: Remove legacy attribution mode from application code.

**Changes**:
- Remove `links.video_id` references from all queries
- Remove legacy attribution mode from `analytics-helper.js`
- Remove legacy attribution mode from `video/[video_id].js`
- Update Video Performance to only use `link_usage_id`-based queries
- Update Links page to aggregate by `link_usage_id` groups

### Phase 7: Verification

**Goal**: Verify migration correctness.

**Checks**:
1. Total click counts match pre-migration values
2. Video Performance pages show correct video-scoped data
3. Links page shows correct aggregate data
4. No duplicate `link_usage` records for same `link_id` + `youtube_video_id`
5. All click events have `link_usage_id` set (except true direct clicks)
6. All placement records have `link_usage_id` set

## Migration Script

See `migrations/backfill-legacy-link-usages.sql` for the implementation.

## Rollback Plan

If migration fails:

1. **Phase 2 Rollback**: Delete `link_usage` records created during migration (identified by `created_at` timestamp)
2. **Phase 3 Rollback**: Set `click_events.link_usage_id = NULL` for updated records
3. **Phase 4 Rollback**: Set `placements.link_usage_id = NULL` for updated records
4. **Phase 5 Rollback**: Restore `links.video_id` from backup
5. **Phase 6 Rollback**: Revert application code changes

## Risks and Mitigations

### Risk 1: Duplicate link_usage Records

**Mitigation**: Use `INSERT OR IGNORE` or check for existence before inserting

### Risk 2: Incorrect link_usage_id Assignment

**Mitigation**: Use multiple matching criteria (link_id + youtube_video_id, source + link_id) and log ambiguous cases

### Risk 3: Click Count Mismatch

**Mitigation**: Compare pre- and post-migration click counts before committing

### Risk 4: User Impact

**Mitigation**: Communicate migration to users, provide support, monitor for issues

### Risk 5: Performance Impact

**Mitigation**: Run migration during low-traffic period, use batch processing

## Timeline

- **Phase 1**: 1-2 hours (diagnostic)
- **Phase 2**: 2-4 hours (backfill link_usages)
- **Phase 3**: 4-8 hours (backfill click_events, depends on data volume)
- **Phase 4**: 1-2 hours (update placements)
- **Phase 5**: 1 hour (cleanup)
- **Phase 6**: 4-8 hours (code changes, testing)
- **Phase 7**: 2-4 hours (verification)

**Total**: 15-29 hours

## Success Criteria

1. All legacy links have corresponding `link_usage` records
2. All click events have `link_usage_id` set (except true direct clicks)
3. All placement records have `link_usage_id` set
4. Video Performance pages show correct video-scoped data
5. Links page shows correct aggregate data
6. No duplicate `link_usage` records
7. Click counts match pre-migration values
8. No user-reported issues after migration
