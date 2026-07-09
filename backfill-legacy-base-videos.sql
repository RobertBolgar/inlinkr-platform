-- Backfill link_usage records for legacy base videos
-- Creates link_usage records for links where:
-- - links.video_id IS NOT NULL
-- - links.video_id != ''
-- - No matching link_usage exists for that link_id + youtube_video_id
-- - Excludes rrsAWjLkn0M (the test video we intentionally cleared)
-- - Excludes system links (is_system = 0)

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
