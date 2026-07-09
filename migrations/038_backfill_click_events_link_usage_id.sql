-- Step 3: Backfill historical click_events.link_usage_id
-- After Steps 1 and 2, placements.link_usage_id is populated for known paths.
-- This migration backfills link_usage_id on historical clicks where the source_code
-- now has a known placement → link_usage path. This restores historical analytics
-- for clicks that were previously invisible due to the legacy_base_video bug.

UPDATE click_events
SET link_usage_id = (
  SELECT p.link_usage_id FROM placements p
  WHERE p.link_id = click_events.link_id
    AND p.source_code = click_events.source
    AND p.link_usage_id IS NOT NULL
  LIMIT 1
)
WHERE click_events.link_usage_id IS NULL
  AND click_events.source IS NOT NULL
  AND click_events.source != 'direct'
  AND EXISTS (
    SELECT 1 FROM placements p
    WHERE p.link_id = click_events.link_id
      AND p.source_code = click_events.source
      AND p.link_usage_id IS NOT NULL
  );
