-- Attribution Trace Report for link_id = 31
-- "The Prompts That Started It All"
-- This report traces every click_event to determine true ownership

-- ============================================================================
-- REPORT 1: Click-by-Click Attribution Trace
-- ============================================================================

SELECT 
  ce.id as click_id,
  ce.timestamp,
  ce.link_id,
  ce.link_usage_id,
  ce.source as click_source,
  p.id as placement_id,
  p.source_code as placement_source_code,
  p.youtube_video_id as placement_youtube_video_id,
  p.link_usage_id as placement_link_usage_id,
  lu.id as link_usage_id_matched,
  lu.youtube_video_id as link_usage_youtube_video_id,
  l.video_id as links_video_id,
  -- Final attributed owner determination logic
  CASE 
    -- Priority 1: If click has link_usage_id, use that link_usage's youtube_video_id
    WHEN ce.link_usage_id IS NOT NULL THEN (
      SELECT youtube_video_id FROM link_usages WHERE id = ce.link_usage_id
    )
    -- Priority 2: If click has source, match to placement and use placement's video context
    WHEN ce.source IS NOT NULL AND p.id IS NOT NULL THEN (
      CASE 
        WHEN p.link_usage_id IS NOT NULL THEN (
          SELECT youtube_video_id FROM link_usages WHERE id = p.link_usage_id
        )
        WHEN p.youtube_video_id IS NOT NULL THEN p.youtube_video_id
        ELSE 'Unknown'
      END
    )
    -- Priority 3: If click has no link_usage_id and no source, it's Direct
    WHEN ce.link_usage_id IS NULL AND (ce.source IS NULL OR ce.source = '') THEN 'Direct'
    -- Priority 4: Otherwise Unknown
    ELSE 'Unknown'
  END as final_attributed_owner
FROM click_events ce
LEFT JOIN placements p ON ce.source = p.source_code AND ce.link_id = p.link_id
LEFT JOIN link_usages lu ON ce.link_usage_id = lu.id
LEFT JOIN links l ON ce.link_id = l.id
WHERE ce.link_id = 31
ORDER BY ce.timestamp DESC;

-- ============================================================================
-- REPORT 2: Attribution Totals
-- ============================================================================

SELECT 
  CASE 
    WHEN ce.link_usage_id IS NOT NULL THEN (
      SELECT youtube_video_id FROM link_usages WHERE id = ce.link_usage_id
    )
    WHEN ce.source IS NOT NULL AND p.id IS NOT NULL THEN (
      CASE 
        WHEN p.link_usage_id IS NOT NULL THEN (
          SELECT youtube_video_id FROM link_usages WHERE id = p.link_usage_id
        )
        WHEN p.youtube_video_id IS NOT NULL THEN p.youtube_video_id
        ELSE 'Unknown'
      END
    )
    WHEN ce.link_usage_id IS NULL AND (ce.source IS NULL OR ce.source = '') THEN 'Direct'
    ELSE 'Unknown'
  END as final_attributed_owner,
  COUNT(*) as click_count
FROM click_events ce
LEFT JOIN placements p ON ce.source = p.source_code AND ce.link_id = p.link_id
WHERE ce.link_id = 31
GROUP BY final_attributed_owner
ORDER BY click_count DESC;

-- ============================================================================
-- REPORT 3: Placements for link_id = 31
-- ============================================================================

SELECT 
  p.id as placement_id,
  p.source_code,
  p.link_usage_id,
  p.youtube_video_id,
  p.name as placement_name,
  p.type as placement_type,
  -- Count clicks for this placement
  (SELECT COUNT(*) FROM click_events ce WHERE ce.link_id = 31 AND ce.source = p.source_code) as click_count
FROM placements p
WHERE p.link_id = 31
ORDER BY p.id;

-- ============================================================================
-- REPORT 4: Link Usages for link_id = 31
-- ============================================================================

SELECT 
  lu.id as usage_id,
  lu.link_id,
  lu.youtube_video_id,
  lu.placement_type,
  lu.placement_name,
  lu.source_code,
  lu.is_active,
  -- Count clicks for this link_usage
  (SELECT COUNT(*) FROM click_events ce WHERE ce.link_usage_id = lu.id) as click_count
FROM link_usages lu
WHERE lu.link_id = 31
ORDER BY lu.id;

-- ============================================================================
-- REPORT 5: Click Events with All Possible Owners (for debugging)
-- ============================================================================

SELECT 
  ce.id as click_id,
  ce.timestamp,
  ce.link_id,
  ce.link_usage_id,
  ce.source as click_source,
  -- Possible owner from link_usage_id
  CASE 
    WHEN ce.link_usage_id IS NOT NULL THEN (
      SELECT youtube_video_id FROM link_usages WHERE id = ce.link_usage_id
    )
    ELSE NULL
  END as owner_from_link_usage_id,
  -- Possible owner from placement match
  CASE 
    WHEN ce.source IS NOT NULL THEN (
      SELECT p.youtube_video_id FROM placements p 
      WHERE p.link_id = ce.link_id AND p.source_code = ce.source
    )
    ELSE NULL
  END as owner_from_placement_youtube_video_id,
  -- Possible owner from placement.link_usage_id
  CASE 
    WHEN ce.source IS NOT NULL THEN (
      SELECT lu.youtube_video_id FROM placements p
      JOIN link_usages lu ON p.link_usage_id = lu.id
      WHERE p.link_id = ce.link_id AND p.source_code = ce.source
    )
    ELSE NULL
  END as owner_from_placement_link_usage_id,
  -- Possible owner from links.video_id (legacy)
  l.video_id as owner_from_links_video_id,
  -- Current query logic (what the API uses)
  CASE 
    WHEN ce.link_usage_id IS NOT NULL THEN (
      SELECT youtube_video_id FROM link_usages WHERE id = ce.link_usage_id
    )
    WHEN ce.source IS NOT NULL THEN (
      SELECT p.youtube_video_id FROM placements p 
      WHERE p.link_id = ce.link_id AND p.source_code = ce.source
    )
    ELSE NULL
  END as current_api_owner
FROM click_events ce
LEFT JOIN links l ON ce.link_id = l.id
WHERE ce.link_id = 31
ORDER BY ce.timestamp DESC;

-- ============================================================================
-- REPORT 6: Identify Clicks with Conflicting Owners
-- ============================================================================

SELECT 
  ce.id as click_id,
  ce.timestamp,
  ce.link_usage_id,
  ce.source as click_source,
  CASE 
    WHEN ce.link_usage_id IS NOT NULL THEN (
      SELECT youtube_video_id FROM link_usages WHERE id = ce.link_usage_id
    )
    ELSE NULL
  END as owner_from_link_usage_id,
  CASE 
    WHEN ce.source IS NOT NULL THEN (
      SELECT p.youtube_video_id FROM placements p 
      WHERE p.link_id = ce.link_id AND p.source_code = ce.source
    )
    ELSE NULL
  END as owner_from_placement_youtube_video_id,
  l.video_id as owner_from_links_video_id,
  CASE 
    WHEN ce.link_usage_id IS NOT NULL AND (
      SELECT youtube_video_id FROM link_usages WHERE id = ce.link_usage_id
    ) IS NOT NULL
    AND ce.source IS NOT NULL
    AND (
      SELECT p.youtube_video_id FROM placements p 
      WHERE p.link_id = ce.link_id AND p.source_code = ce.source
    ) IS NOT NULL
    AND (
      SELECT youtube_video_id FROM link_usages WHERE id = ce.link_usage_id
    ) != (
      SELECT p.youtube_video_id FROM placements p 
      WHERE p.link_id = ce.link_id AND p.source_code = ce.source
    )
    THEN 'CONFLICT'
    ELSE 'OK'
  END as conflict_status
FROM click_events ce
LEFT JOIN links l ON ce.link_id = l.id
WHERE ce.link_id = 31
ORDER BY ce.timestamp DESC;
