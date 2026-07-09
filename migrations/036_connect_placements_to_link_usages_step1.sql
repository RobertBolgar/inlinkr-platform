-- Step 1: Connect placements that already declare their video to matching link_usage
-- For placements where youtube_video_id IS NOT NULL, find the matching active link_usage
-- and populate link_usage_id. This establishes the canonical path:
-- Placement → link_usage → click_events.link_usage_id → Analytics

UPDATE placements
SET link_usage_id = (
  SELECT lu.id FROM link_usages lu
  WHERE lu.link_id = placements.link_id
    AND lu.youtube_video_id = placements.youtube_video_id
    AND lu.is_active = 1
  ORDER BY lu.id ASC
  LIMIT 1
)
WHERE placements.link_usage_id IS NULL
  AND placements.youtube_video_id IS NOT NULL;
