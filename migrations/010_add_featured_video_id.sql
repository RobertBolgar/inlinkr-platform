-- Add featured_video_id to creator_hub_settings for YouTube video selection
-- This allows creators to select a YouTube video as featured content instead of a Smart Link

ALTER TABLE creator_hub_settings ADD COLUMN featured_video_id TEXT;
