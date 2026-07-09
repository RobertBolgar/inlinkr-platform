-- Create placements table for named placement tracking
CREATE TABLE IF NOT EXISTS placements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('description', 'pinned', 'bio', 'short', 'video', 'other', 'qr_code')),
  source_code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

-- Create indexes on placements
CREATE INDEX IF NOT EXISTS idx_placements_link_id ON placements(link_id);
CREATE INDEX IF NOT EXISTS idx_placements_source_code ON placements(source_code);

-- Add placement_count column to links table for quick access
ALTER TABLE links ADD COLUMN placement_count INTEGER DEFAULT 0;
