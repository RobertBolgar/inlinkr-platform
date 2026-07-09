-- Create YouTube metadata cache table for performance optimization
-- This caches YouTube API responses to avoid repeated calls

CREATE TABLE IF NOT EXISTS youtube_metadata_cache (
  video_id TEXT PRIMARY KEY,
  title TEXT,
  thumbnail TEXT,
  view_count INTEGER,
  cached_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- Create index for efficient cleanup of expired entries
CREATE INDEX IF NOT EXISTS idx_youtube_metadata_cache_expires_at ON youtube_metadata_cache(expires_at);
