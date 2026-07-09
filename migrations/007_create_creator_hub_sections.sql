-- Create creator_hub_sections table
CREATE TABLE IF NOT EXISTS creator_hub_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  section_slot INTEGER NOT NULL,
  label TEXT,
  slug TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, section_slot),
  UNIQUE(user_id, slug),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_creator_hub_sections_user_id ON creator_hub_sections(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_hub_sections_enabled_order ON creator_hub_sections(user_id, is_enabled, display_order);
