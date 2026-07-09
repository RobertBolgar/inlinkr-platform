-- Create activity_events table for admin activity feed
-- This table centralizes platform event logging for admin visibility
-- Designed to support future multi-admin roles via visibility_scope field

CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_user_id INTEGER,
  target_user_id INTEGER,
  event_title TEXT,
  event_description TEXT,
  metadata_json TEXT,
  severity TEXT DEFAULT 'info',
  visibility_scope TEXT DEFAULT 'owner',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_activity_events_event_type ON activity_events(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_events_actor_user_id ON activity_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_target_user_id ON activity_events(target_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_created_at ON activity_events(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_events_visibility_scope ON activity_events(visibility_scope);
