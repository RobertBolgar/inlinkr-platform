-- Legacy Attribution Migration Report: Diagnostic Query
-- This query identifies all legacy links where links.video_id exists but no matching link_usage exists

-- Report 1: Legacy links without corresponding link_usages
SELECT 
  l.id as link_id,
  l.user_id,
  l.slug,
  l.title,
  l.original_url,
  l.video_id as legacy_video_id,
  l.is_active,
  l.created_at as link_created_at,
  l.updated_at as link_updated_at,
  CASE 
    WHEN lu.id IS NULL THEN 'MISSING_LINK_USAGE'
    ELSE 'HAS_LINK_USAGE'
  END as link_usage_status,
  lu.id as existing_link_usage_id,
  lu.youtube_video_id as link_usage_video_id,
  lu.placement_type,
  lu.placement_name,
  lu.is_active as link_usage_active
FROM links l
LEFT JOIN link_usages lu ON l.id = lu.link_id AND l.video_id = lu.youtube_video_id
WHERE l.video_id IS NOT NULL 
  AND l.video_id != ''
  AND l.is_active = 1
ORDER BY l.user_id, l.video_id, l.id;

-- Report 2: Count of legacy links by user
SELECT 
  l.user_id,
  u.username,
  COUNT(*) as legacy_link_count,
  COUNT(CASE WHEN lu.id IS NULL THEN 1 END) as missing_link_usage_count,
  COUNT(CASE WHEN lu.id IS NOT NULL THEN 1 END) as has_link_usage_count
FROM links l
LEFT JOIN users u ON l.user_id = u.id
LEFT JOIN link_usages lu ON l.id = lu.link_id AND l.video_id = lu.youtube_video_id
WHERE l.video_id IS NOT NULL 
  AND l.video_id != ''
  AND l.is_active = 1
GROUP BY l.user_id, u.username
ORDER BY legacy_link_count DESC;

-- Report 3: Legacy links by video_id (to identify videos with multiple legacy links)
SELECT 
  l.video_id,
  COUNT(*) as legacy_link_count,
  COUNT(CASE WHEN lu.id IS NULL THEN 1 END) as missing_link_usage_count,
  GROUP_CONCAT(l.slug, ', ') as link_slugs
FROM links l
LEFT JOIN link_usages lu ON l.id = lu.link_id AND l.video_id = lu.youtube_video_id
WHERE l.video_id IS NOT NULL 
  AND l.video_id != ''
  AND l.is_active = 1
GROUP BY l.video_id
ORDER BY legacy_link_count DESC;

-- Report 4: Click events for legacy links (to assess impact)
SELECT 
  l.id as link_id,
  l.slug,
  l.video_id as legacy_video_id,
  COUNT(ce.id) as total_clicks,
  COUNT(CASE WHEN ce.link_usage_id IS NULL THEN 1 END) as clicks_without_link_usage_id,
  COUNT(CASE WHEN ce.link_usage_id IS NOT NULL THEN 1 END) as clicks_with_link_usage_id,
  MIN(ce.timestamp) as first_click,
  MAX(ce.timestamp) as last_click
FROM links l
LEFT JOIN click_events ce ON l.id = ce.link_id
WHERE l.video_id IS NOT NULL 
  AND l.video_id != ''
  AND l.is_active = 1
GROUP BY l.id, l.slug, l.video_id
ORDER BY total_clicks DESC;

-- Report 5: Placement records for legacy links
SELECT 
  l.id as link_id,
  l.slug,
  l.video_id as legacy_video_id,
  p.id as placement_id,
  p.name as placement_name,
  p.type as placement_type,
  p.source_code,
  p.link_usage_id,
  p.youtube_video_id as placement_video_id,
  CASE 
    WHEN p.link_usage_id IS NOT NULL THEN 'HAS_LINK_USAGE_ID'
    WHEN p.youtube_video_id IS NOT NULL THEN 'HAS_YOUTUBE_VIDEO_ID'
    ELSE 'NO_VIDEO_CONTEXT'
  END as placement_video_context
FROM links l
LEFT JOIN placements p ON l.id = p.link_id
WHERE l.video_id IS NOT NULL 
  AND l.video_id != ''
  AND l.is_active = 1
ORDER BY l.id, p.id;
