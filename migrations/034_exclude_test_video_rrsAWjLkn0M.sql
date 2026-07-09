-- Exclude test video rrsAWjLkn0M from analytics
-- This video was attached to the protected Invite system link and should not appear in Analytics
-- The exclusion mechanism allows hiding videos without deleting links or historical data

-- Note: This migration requires the user_id to be set appropriately
-- For production, this should be run with the actual user_id
-- For now, this is a template migration that can be adapted

-- INSERT INTO analytics_video_exclusions (user_id, youtube_video_id, reason, created_at)
-- VALUES (REPLACE_WITH_USER_ID, 'rrsAWjLkn0M', 'Test video attached to Invite link', datetime('now'));
