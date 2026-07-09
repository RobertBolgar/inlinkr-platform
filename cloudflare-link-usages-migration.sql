-- Phase 1: Additive schema for reusable links
-- Creates link_usages table to separate link definition from link usage
-- Adds nullable columns for future attribution
-- Backfills existing links with video_id

-- Create link_usages table
CREATE TABLE IF NOT EXISTS link_usages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  youtube_video_id TEXT,
  placement_type TEXT,
  placement_name TEXT,
  public_code TEXT,
  source_code TEXT,
  destination_url_snapshot TEXT,
  title_snapshot TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add safe indexes (non-unique for now)
CREATE INDEX IF NOT EXISTS idx_link_usages_link_id ON link_usages(link_id);
CREATE INDEX IF NOT EXISTS idx_link_usages_user_id ON link_usages(user_id);
CREATE INDEX IF NOT EXISTS idx_link_usages_video_id ON link_usages(youtube_video_id);
CREATE INDEX IF NOT EXISTS idx_link_usages_public_code ON link_usages(public_code);
CREATE INDEX IF NOT EXISTS idx_link_usages_source_code ON link_usages(source_code);

-- Add nullable columns to existing tables for future attribution
-- These columns are nullable and will not affect existing functionality
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- To make this idempotent, we attempt the ALTER and accept failure if column exists
-- This is safe for D1 which tracks migration execution

-- Add link_usage_id to click_events if it doesn't exist
-- If this fails (column already exists), the migration will stop
-- This is acceptable because D1 migrations should be run once per environment
ALTER TABLE click_events ADD COLUMN link_usage_id INTEGER;

-- Add link_usage_id to proof_shares if it doesn't exist
ALTER TABLE proof_shares ADD COLUMN link_usage_id INTEGER;

-- Create indexes (these are idempotent with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_click_events_link_usage_id ON click_events(link_usage_id);
CREATE INDEX IF NOT EXISTS idx_proof_shares_link_usage_id ON proof_shares(link_usage_id);

-- Backfill: Create link_usage records for existing links with video_id
-- Use INSERT with NOT EXISTS check to prevent duplicates if migration is run multiple times
-- This is idempotent without requiring a UNIQUE constraint
INSERT INTO link_usages (
  link_id,
  user_id,
  youtube_video_id,
  placement_type,
  placement_name,
  public_code,
  source_code,
  destination_url_snapshot,
  title_snapshot,
  is_active,
  created_at,
  updated_at
)
SELECT 
  id as link_id,
  user_id,
  video_id as youtube_video_id,
  'legacy' as placement_type,
  'Legacy video attachment' as placement_name,
  NULL as public_code,
  'legacy' as source_code,
  original_url as destination_url_snapshot,
  title as title_snapshot,
  1 as is_active,
  created_at,
  updated_at
FROM links
WHERE video_id IS NOT NULL
  AND is_active = 1
  AND NOT EXISTS (
    SELECT 1 FROM link_usages 
    WHERE link_usages.link_id = links.id 
      AND link_usages.youtube_video_id = links.video_id
      AND link_usages.placement_type = 'legacy'
  );

-- Preserve links.video_id - do NOT drop or modify
-- This column remains for backward compatibility during transition
