-- Update unique constraint to allow same link in multiple sections
-- Drop old unique constraint (user_id, link_id)
-- Add new unique constraint (user_id, link_id, section_slot)

-- SQLite doesn't support ALTER TABLE DROP CONSTRAINT directly
-- Need to recreate the table

-- Step 1: Create new table with correct constraints
CREATE TABLE IF NOT EXISTS creator_hub_link_assignments_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  link_id INTEGER NOT NULL,
  section_slot INTEGER NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, link_id, section_slot),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

-- Step 2: Copy data from old table to new table
INSERT INTO creator_hub_link_assignments_new (id, user_id, link_id, section_slot, display_order, is_active, created_at, updated_at)
SELECT id, user_id, link_id, section_slot, display_order, is_active, created_at, updated_at
FROM creator_hub_link_assignments;

-- Step 3: Drop old table
DROP TABLE creator_hub_link_assignments;

-- Step 4: Rename new table to old table name
ALTER TABLE creator_hub_link_assignments_new RENAME TO creator_hub_link_assignments;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_creator_hub_link_assignments_user_id ON creator_hub_link_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_hub_link_assignments_user_section ON creator_hub_link_assignments(user_id, section_slot);
CREATE INDEX IF NOT EXISTS idx_creator_hub_link_assignments_user_active ON creator_hub_link_assignments(user_id, is_active);
