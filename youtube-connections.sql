-- Create youtube_connections table for storing OAuth tokens
CREATE TABLE IF NOT EXISTS youtube_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  youtube_channel_id TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TEXT NOT NULL,
  connected_at TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_youtube_connections_user_id ON youtube_connections(user_id);
