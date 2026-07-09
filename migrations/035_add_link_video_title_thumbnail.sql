-- Add video_title and video_thumbnail columns to links table
-- These were referenced in the old API but never added via migration
-- Adding them now to ensure schema matches expected usage

ALTER TABLE links ADD COLUMN video_title TEXT;
ALTER TABLE links ADD COLUMN video_thumbnail TEXT;
