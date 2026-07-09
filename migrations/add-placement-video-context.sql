-- Add video context fields to placements table
-- This migration is additive and backwards compatible
-- Enables placements to track which YouTube video they belong to

-- Add nullable link_usage_id field
ALTER TABLE placements ADD COLUMN link_usage_id INTEGER;

-- Add nullable youtube_video_id field
ALTER TABLE placements ADD COLUMN youtube_video_id TEXT;

-- Add index for link_usage_id for efficient queries
CREATE INDEX IF NOT EXISTS idx_placements_link_usage_id ON placements(link_usage_id);

-- Add index for youtube_video_id for efficient video-scoped queries
CREATE INDEX IF NOT EXISTS idx_placements_youtube_video_id ON placements(youtube_video_id);
