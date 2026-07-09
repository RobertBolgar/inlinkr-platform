-- Migration to change source_code uniqueness from global to per-link
-- This allows the same source_code (e.g., c1) to be used on different links

-- Step 1: Drop the old global unique constraint on source_code
-- SQLite doesn't support ALTER TABLE to drop constraints directly,
-- so we need to recreate the table

-- Create a new placements table with the correct uniqueness constraint
CREATE TABLE IF NOT EXISTS placements_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('description', 'pinned', 'bio', 'short', 'video', 'other')),
  source_code TEXT NOT NULL,
  public_code TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(link_id, source_code),
  FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

-- Copy data from old table to new table
INSERT INTO placements_new (id, link_id, name, type, source_code, public_code, created_at, updated_at)
SELECT id, link_id, name, type, source_code, public_code, created_at, updated_at
FROM placements;

-- Drop the old table
DROP TABLE placements;

-- Rename the new table to placements
ALTER TABLE placements_new RENAME TO placements;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_placements_link_id ON placements(link_id);
CREATE INDEX IF NOT EXISTS idx_placements_source_code ON placements(source_code);
CREATE INDEX IF NOT EXISTS idx_placements_public_code ON placements(public_code);
