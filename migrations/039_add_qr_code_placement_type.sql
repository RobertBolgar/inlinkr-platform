-- Add 'qr_code' to placements type CHECK constraint
-- This enables QR code placements with future scalability for other QR types

-- Deployment instructions:
-- Local/Dev: npx wrangler d1 execute tubelinkr-db --file=./migrations/039_add_qr_code_placement_type.sql
-- Production: npx wrangler d1 execute tubelinkr-prod-db --remote --file=./migrations/039_add_qr_code_placement_type.sql

-- SQLite doesn't support ALTER TABLE to modify CHECK constraints directly
-- We need to recreate the table with the updated constraint

-- Step 1: Clean up duplicate source_code values by adding suffixes
-- This handles existing data integrity issues before migration
UPDATE placements SET source_code = source_code || '_' || id
WHERE id NOT IN (
  SELECT MIN(id) FROM placements GROUP BY source_code
);

-- Step 2: Create new placements table with updated CHECK constraint
CREATE TABLE IF NOT EXISTS placements_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('description', 'pinned', 'bio', 'short', 'video', 'other', 'qr_code')),
  source_code TEXT NOT NULL,
  public_code TEXT,
  link_usage_id INTEGER,
  youtube_video_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

-- Step 3: Copy existing data to new table
INSERT INTO placements_new (id, link_id, name, type, source_code, public_code, link_usage_id, youtube_video_id, created_at, updated_at)
SELECT id, link_id, name, type, source_code, public_code, link_usage_id, youtube_video_id, created_at, updated_at
FROM placements;

-- Step 4: Drop old table
DROP TABLE placements;

-- Step 5: Rename new table to original name
ALTER TABLE placements_new RENAME TO placements;

-- Step 6: Add UNIQUE constraint on source_code using CREATE UNIQUE INDEX
CREATE UNIQUE INDEX IF NOT EXISTS idx_placements_source_code_unique ON placements(source_code);

-- Step 7: Recreate other indexes
CREATE INDEX IF NOT EXISTS idx_placements_link_id ON placements(link_id);
CREATE INDEX IF NOT EXISTS idx_placements_public_code ON placements(public_code);
CREATE INDEX IF NOT EXISTS idx_placements_link_public_code ON placements(link_id, public_code);
CREATE INDEX IF NOT EXISTS idx_placements_link_usage_id ON placements(link_usage_id);
CREATE INDEX IF NOT EXISTS idx_placements_youtube_video_id ON placements(youtube_video_id);
