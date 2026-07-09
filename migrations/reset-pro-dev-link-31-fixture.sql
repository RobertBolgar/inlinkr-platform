-- ============================================================================
-- PRO-DEV ONLY: Reset pro-dev to clean seed state for link_id = 31
-- ============================================================================
-- WARNING: DO NOT RUN THIS SCRIPT ON PRODUCTION
-- This script is for pro-dev testing only. It removes manual migration changes
-- and restores the original bug state for retesting.
--
-- Usage: npx wrangler d1 execute tubelinkr-db --remote --file migrations/reset-pro-dev-link-31-fixture.sql
-- ============================================================================

-- Reset click events (remove link_usage_id = 27)
UPDATE click_events
SET link_usage_id = NULL
WHERE link_usage_id = 27;

-- Reset placement 59 (remove link_usage_id)
UPDATE placements
SET link_usage_id = NULL
WHERE id = 59;

-- Delete the manually created link_usage 27
DELETE FROM link_usages
WHERE id = 27;

-- Verification: Check reset state
SELECT 'VERIFICATION: Reset to clean seed state' as step;
SELECT COUNT(*) as link_usage_27_count FROM link_usages WHERE id = 27;
SELECT COUNT(*) as placement_59_link_usage FROM placements WHERE id = 59 AND link_usage_id IS NOT NULL;
SELECT COUNT(*) as clicks_with_link_usage_27 FROM click_events WHERE link_usage_id = 27;
SELECT COUNT(*) as total_clicks_link_31 FROM click_events WHERE link_id = 31;
