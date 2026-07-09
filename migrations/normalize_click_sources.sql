-- One-time migration to normalize click_events.source values
-- This ensures all historical click data matches the new normalized source_code system

-- Step 1: Update all non-null sources to be lowercase, trimmed, and without spaces
UPDATE click_events 
SET source = LOWER(TRIM(REPLACE(source, ' ', '')))
WHERE source IS NOT NULL;

-- Step 2: Replace NULL sources with 'direct'
UPDATE click_events 
SET source = 'direct'
WHERE source IS NULL;

-- Verification query (optional, to check the migration)
-- SELECT COUNT(*) as total_clicks, 
--        COUNT(DISTINCT source) as unique_sources,
--        source 
-- FROM click_events 
-- GROUP BY source;
