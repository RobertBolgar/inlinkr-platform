-- Legacy Attribution Migration: Backfill link_usages for Legacy Links
-- This migration creates link_usage records for legacy links that use links.video_id
-- Then updates click_events and placements to use the new link_usage_id
-- This migration is idempotent and can be run multiple times safely

-- ============================================================================
-- PHASE 1: Create link_usage records for legacy links
-- ============================================================================

-- Step 1.1: Create link_usage records for legacy links without existing link_usage
-- This handles the simple case: one link, one video, no existing link_usage
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
  l.id as link_id,
  l.user_id,
  l.video_id as youtube_video_id,
  'legacy' as placement_type,
  'Legacy Link' as placement_name,
  'legacy_' || l.id || '_' || l.video_id as public_code,
  'legacy_' || l.id || '_' || l.video_id as source_code,
  l.original_url as destination_url_snapshot,
  l.title as title_snapshot,
  l.is_active,
  l.created_at,
  datetime('now') as updated_at
FROM links l
WHERE l.video_id IS NOT NULL 
  AND l.video_id != ''
  AND l.is_active = 1
  AND NOT EXISTS (
    SELECT 1 FROM link_usages lu 
    WHERE lu.link_id = l.id AND lu.youtube_video_id = l.video_id
  );

-- Step 1.2: Create link_usage records for legacy links with placement records
-- This handles the case where placement records exist with youtube_video_id
-- We create one link_usage per unique placement per video
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
SELECT DISTINCT
  p.link_id,
  l.user_id,
  p.youtube_video_id,
  p.type as placement_type,
  p.name as placement_name,
  'legacy_' || p.link_id || '_' || p.youtube_video_id || '_' || p.type as public_code,
  p.source_code,
  l.original_url as destination_url_snapshot,
  l.title as title_snapshot,
  l.is_active,
  l.created_at,
  datetime('now') as updated_at
FROM placements p
JOIN links l ON p.link_id = l.id
WHERE p.youtube_video_id IS NOT NULL 
  AND p.youtube_video_id != ''
  AND p.link_usage_id IS NULL
  AND l.is_active = 1
  AND NOT EXISTS (
    SELECT 1 FROM link_usages lu 
    WHERE lu.link_id = p.link_id 
      AND lu.youtube_video_id = p.youtube_video_id 
      AND lu.source_code = p.source_code
  );

-- ============================================================================
-- PHASE 2: Update click_events to use link_usage_id
-- ============================================================================

-- Step 2.1: Update click_events for legacy links with single link_usage
-- This handles the simple case: one link_usage per link+video
UPDATE click_events ce
SET link_usage_id = (
  SELECT lu.id 
  FROM link_usages lu
  JOIN links l ON lu.link_id = l.id
  WHERE l.id = ce.link_id 
    AND l.video_id = lu.youtube_video_id
    AND ce.link_usage_id IS NULL
  LIMIT 1
)
WHERE ce.link_usage_id IS NULL
  AND EXISTS (
    SELECT 1 FROM links l 
    WHERE l.id = ce.link_id 
      AND l.video_id IS NOT NULL 
      AND l.video_id != ''
  )
  AND EXISTS (
    SELECT 1 FROM link_usages lu
    JOIN links l ON lu.link_id = l.id
    WHERE l.id = ce.link_id 
      AND l.video_id = lu.youtube_video_id
  );

-- Step 2.2: Update click_events using source_code matching
-- This handles the case where multiple link_usages exist for the same link+video
UPDATE click_events ce
SET link_usage_id = (
  SELECT lu.id 
  FROM link_usages lu
  WHERE lu.link_id = ce.link_id 
    AND lu.source_code = ce.source
    AND ce.link_usage_id IS NULL
  LIMIT 1
)
WHERE ce.link_usage_id IS NULL
  AND ce.source IS NOT NULL
  AND ce.source != ''
  AND EXISTS (
    SELECT 1 FROM link_usages lu
    WHERE lu.link_id = ce.link_id 
      AND lu.source_code = ce.source
  );

-- ============================================================================
-- PHASE 3: Update placement records to use link_usage_id
-- ============================================================================

-- Step 3.1: Update placements with youtube_video_id to use link_usage_id
UPDATE placements p
SET link_usage_id = (
  SELECT lu.id 
  FROM link_usages lu
  WHERE lu.link_id = p.link_id 
    AND lu.youtube_video_id = p.youtube_video_id
    AND p.link_usage_id IS NULL
  LIMIT 1
)
WHERE p.link_usage_id IS NULL
  AND p.youtube_video_id IS NOT NULL 
  AND p.youtube_video_id != ''
  AND EXISTS (
    SELECT 1 FROM link_usages lu
    WHERE lu.link_id = p.link_id 
      AND lu.youtube_video_id = p.youtube_video_id
  );

-- Step 3.2: Update placements with source_code matching
UPDATE placements p
SET link_usage_id = (
  SELECT lu.id 
  FROM link_usages lu
  WHERE lu.link_id = p.link_id 
    AND lu.source_code = p.source_code
    AND p.link_usage_id IS NULL
  LIMIT 1
)
WHERE p.link_usage_id IS NULL
  AND p.source_code IS NOT NULL
  AND p.source_code != ''
  AND EXISTS (
    SELECT 1 FROM link_usages lu
    WHERE lu.link_id = p.link_id 
      AND lu.source_code = p.source_code
  );

-- ============================================================================
-- PHASE 4: Verification Queries
-- ============================================================================

-- Verification 1: Count of legacy links without link_usage (should be 0 after migration)
SELECT 
  COUNT(*) as legacy_links_without_link_usage
FROM links l
WHERE l.video_id IS NOT NULL 
  AND l.video_id != ''
  AND l.is_active = 1
  AND NOT EXISTS (
    SELECT 1 FROM link_usages lu 
    WHERE lu.link_id = l.id AND lu.youtube_video_id = l.video_id
  );

-- Verification 2: Count of click_events without link_usage_id for legacy links (should be minimal)
SELECT 
  COUNT(*) as click_events_without_link_usage_id
FROM click_events ce
JOIN links l ON ce.link_id = l.id
WHERE ce.link_usage_id IS NULL
  AND l.video_id IS NOT NULL 
  AND l.video_id != '';

-- Verification 3: Count of placements without link_usage_id with youtube_video_id (should be 0)
SELECT 
  COUNT(*) as placements_without_link_usage_id
FROM placements p
WHERE p.link_usage_id IS NULL
  AND p.youtube_video_id IS NOT NULL 
  AND p.youtube_video_id != '';

-- Verification 4: Duplicate link_usage check (should be 0)
SELECT 
  link_id,
  youtube_video_id,
  COUNT(*) as duplicate_count
FROM link_usages
GROUP BY link_id, youtube_video_id
HAVING COUNT(*) > 1;

-- Verification 5: Click count comparison (pre/post migration)
-- This helps verify that total click counts haven't changed
SELECT 
  l.id as link_id,
  l.slug,
  l.video_id as legacy_video_id,
  COUNT(ce.id) as total_clicks,
  COUNT(CASE WHEN ce.link_usage_id IS NOT NULL THEN 1 END) as clicks_with_link_usage_id,
  COUNT(CASE WHEN ce.link_usage_id IS NULL THEN 1 END) as clicks_without_link_usage_id
FROM links l
LEFT JOIN click_events ce ON l.id = ce.link_id
WHERE l.video_id IS NOT NULL 
  AND l.video_id != ''
  AND l.is_active = 1
GROUP BY l.id, l.slug, l.video_id
ORDER BY total_clicks DESC;

-- ============================================================================
-- ROLLBACK QUERIES (use only if migration fails)
-- ============================================================================

-- Rollback 1: Delete link_usage records created by this migration
-- WARNING: This will delete ALL link_usage records with placement_type='legacy'
-- DELETE FROM link_usages 
-- WHERE placement_type = 'legacy' 
--   OR public_code LIKE 'legacy_%';

-- Rollback 2: Reset click_events.link_usage_id for legacy links
-- UPDATE click_events ce
-- SET link_usage_id = NULL
-- WHERE EXISTS (
--   SELECT 1 FROM links l 
--   WHERE l.id = ce.link_id 
--     AND l.video_id IS NOT NULL 
--     AND l.video_id != ''
-- );

-- Rollback 3: Reset placements.link_usage_id
-- UPDATE placements
-- SET link_usage_id = NULL
-- WHERE link_usage_id IS NOT NULL;
