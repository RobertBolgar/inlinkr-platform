-- Add subtitle field to links table
-- This allows for optional manual subtitles for public hub cards

ALTER TABLE links ADD COLUMN subtitle TEXT;
