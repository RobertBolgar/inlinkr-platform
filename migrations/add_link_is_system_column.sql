-- Add is_system column to links table
-- This column will be used to mark system-generated links (like invite links)
-- System links should not count toward user's link limits

ALTER TABLE links ADD COLUMN is_system INTEGER DEFAULT 0;

-- Create index for efficient querying of non-system links
CREATE INDEX IF NOT EXISTS idx_links_user_id_non_system ON links(user_id, is_system);
