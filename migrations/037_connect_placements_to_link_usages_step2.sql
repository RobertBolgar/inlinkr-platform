-- Step 2: Connect placements for single-video links to legacy_base_video
-- For links with exactly ONE active video, all remaining unattributed placements
-- (those without youtube_video_id) unambiguously belong to that one video.
-- This safely connects them to the legacy_base_video link_usage.
-- Links with multiple videos are NOT updated to avoid guessing attribution.

UPDATE placements
SET link_usage_id = (
  SELECT lu.id FROM link_usages lu
  WHERE lu.link_id = placements.link_id
    AND lu.placement_type = 'legacy_base_video'
    AND lu.is_active = 1
  LIMIT 1
)
WHERE placements.link_usage_id IS NULL
  AND placements.youtube_video_id IS NULL
  AND (
    SELECT COUNT(DISTINCT lu.youtube_video_id)
    FROM link_usages lu
    WHERE lu.link_id = placements.link_id
      AND lu.is_active = 1
  ) = 1
  AND EXISTS (
    SELECT 1 FROM link_usages lu
    WHERE lu.link_id = placements.link_id
      AND lu.placement_type = 'legacy_base_video'
      AND lu.is_active = 1
  );
