-- Create analytics_video_exclusions table
-- This allows users to hide specific videos from Analytics without deleting links or historical data
CREATE TABLE IF NOT EXISTS analytics_video_exclusions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  youtube_video_id TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, youtube_video_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_analytics_video_exclusions_user_id ON analytics_video_exclusions(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_video_exclusions_video_id ON analytics_video_exclusions(youtube_video_id);
