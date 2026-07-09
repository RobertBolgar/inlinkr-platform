-- Add video_id column to links table
-- This migration adds support for attaching YouTube video IDs to links

ALTER TABLE links ADD COLUMN video_id TEXT DEFAULT NULL;
