-- Create creator_hub_link_assignments table
CREATE TABLE IF NOT EXISTS creator_hub_link_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  link_id INTEGER NOT NULL,
  section_slot INTEGER NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, link_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_creator_hub_link_assignments_user_id ON creator_hub_link_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_hub_link_assignments_user_section ON creator_hub_link_assignments(user_id, section_slot);
CREATE INDEX IF NOT EXISTS idx_creator_hub_link_assignments_user_active ON creator_hub_link_assignments(user_id, is_active);
