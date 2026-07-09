-- JQ Attribution Repair Migration for link_id = 31
-- This migration safely assigns placement 59 and its 5 clicks to JQZ6aM1zLXs
-- This migration is idempotent and can be run multiple times safely

-- ============================================================================
-- VERIFICATION: Before Migration
-- ============================================================================

-- Verify 1: Check if link_usage already exists for JQZ6aM1zLXs
SELECT 'VERIFICATION 1: Check existing link_usage for JQZ6aM1zLXs' as verification_step;
SELECT id, link_id, youtube_video_id, source_code, placement_type, placement_name
FROM link_usages
WHERE link_id = 31 
  AND youtube_video_id = 'JQZ6aM1zLXs' 
  AND source_code = 'd';

-- Verify 2: Check current state of placement 59
SELECT 'VERIFICATION 2: Current state of placement 59' as verification_step;
SELECT id, link_id, source_code, link_usage_id, youtube_video_id, name, type
FROM placements
WHERE id = 59;

-- Verify 3: Check current state of the 5 click events
SELECT 'VERIFICATION 3: Current state of the 5 click events' as verification_step;
SELECT id, link_id, link_usage_id, source, timestamp
FROM click_events
WHERE id IN (145, 140, 139, 138, 137)
ORDER BY id;

-- Verify 4: Count clicks that would be affected
SELECT 'VERIFICATION 4: Count of clicks to be updated' as verification_step;
SELECT COUNT(*) as click_count
FROM click_events
WHERE id IN (145, 140, 139, 138, 137)
  AND link_id = 31
  AND source = 'd'
  AND link_usage_id IS NULL;

-- ============================================================================
-- MIGRATION STEPS
-- ============================================================================

-- Step 1: Create link_usage for JQZ6aM1zLXs (idempotent)
-- Uses INSERT OR IGNORE to prevent duplicates
-- Uses source_code = 'd' to match placement 59
-- Uses a safe public_code pattern: 'lu_{link_id}_{youtube_video_id}_{source_code}'
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
  31 as link_id,
  user_id,
  'JQZ6aM1zLXs' as youtube_video_id,
  'description' as placement_type,
  'YouTube Description' as placement_name,
  'lu_31_JQZ6aM1zLXs_d' as public_code,
  'd' as source_code,
  original_url as destination_url_snapshot,
  title as title_snapshot,
  is_active,
  created_at,
  datetime('now') as updated_at
FROM links
WHERE id = 31
  AND NOT EXISTS (
    SELECT 1 FROM link_usages 
    WHERE link_id = 31 
      AND youtube_video_id = 'JQZ6aM1zLXs' 
      AND source_code = 'd'
  );

-- Step 2: Update placement 59 to link to the new link_usage (idempotent)
-- Only updates placement 59
-- Only updates if link_usage_id is NULL (idempotent)
UPDATE placements
SET link_usage_id = (
  SELECT id FROM link_usages 
  WHERE link_id = 31 
    AND youtube_video_id = 'JQZ6aM1zLXs' 
    AND source_code = 'd'
    LIMIT 1
)
WHERE id = 59
  AND link_usage_id IS NULL;

-- Step 3: Update the 5 specific click events to use the new link_usage_id (idempotent)
-- Only updates the exact 5 click IDs
-- Only updates if link_usage_id is NULL (idempotent)
-- Only updates if link_id = 31 and source = 'd' (safety check)
UPDATE click_events
SET link_usage_id = (
  SELECT id FROM link_usages 
  WHERE link_id = 31 
    AND youtube_video_id = 'JQZ6aM1zLXs' 
    AND source_code = 'd'
    LIMIT 1
)
WHERE id IN (145, 140, 139, 138, 137)
  AND link_id = 31
  AND source = 'd'
  AND link_usage_id IS NULL;

-- ============================================================================
-- VERIFICATION: After Migration
-- ============================================================================

-- Verify 5: Check that link_usage was created
SELECT 'VERIFICATION 5: Check link_usage was created' as verification_step;
SELECT id, link_id, youtube_video_id, source_code, placement_type, placement_name, public_code
FROM link_usages
WHERE link_id = 31 
  AND youtube_video_id = 'JQZ6aM1zLXs' 
  AND source_code = 'd';

-- Verify 6: Check that placement 59 was updated
SELECT 'VERIFICATION 6: Check placement 59 was updated' as verification_step;
SELECT id, link_id, source_code, link_usage_id, youtube_video_id, name, type
FROM placements
WHERE id = 59;

-- Verify 7: Check that the 5 click events were updated
SELECT 'VERIFICATION 7: Check the 5 click events were updated' as verification_step;
SELECT id, link_id, link_usage_id, source, timestamp
FROM click_events
WHERE id IN (145, 140, 139, 138, 137)
ORDER BY id;

-- Verify 8: Count updated clicks
SELECT 'VERIFICATION 8: Count of updated clicks' as verification_step;
SELECT COUNT(*) as updated_click_count
FROM click_events
WHERE id IN (145, 140, 139, 138, 137)
  AND link_id = 31
  AND source = 'd'
  AND link_usage_id IS NOT NULL;

-- Verify 9: Verify no other clicks were affected
SELECT 'VERIFICATION 9: Verify no other clicks were affected' as verification_step;
SELECT COUNT(*) as other_affected_clicks
FROM click_events
WHERE link_id = 31
  AND link_usage_id IS NOT NULL
  AND id NOT IN (145, 140, 139, 138, 137, 136, 135, 134);

-- ============================================================================
-- ROLLBACK SQL (use only if migration causes issues)
-- ============================================================================

-- Rollback Step 1: Reset the 5 click events
UPDATE click_events
SET link_usage_id = NULL
WHERE id IN (145, 140, 139, 138, 137)
  AND link_id = 31
  AND source = 'd'
  AND link_usage_id = (
    SELECT id FROM link_usages 
    WHERE link_id = 31 
      AND youtube_video_id = 'JQZ6aM1zLXs' 
      AND source_code = 'd'
  );

-- Rollback Step 2: Reset placement 59
UPDATE placements
SET link_usage_id = NULL
WHERE id = 59
  AND link_usage_id = (
    SELECT id FROM link_usages 
    WHERE link_id = 31 
      AND youtube_video_id = 'JQZ6aM1zLXs' 
      AND source_code = 'd'
  );

-- Rollback Step 3: Delete the created link_usage
DELETE FROM link_usages
WHERE link_id = 31 
  AND youtube_video_id = 'JQZ6aM1zLXs' 
  AND source_code = 'd'
  AND public_code = 'lu_31_JQZ6aM1zLXs_d';
