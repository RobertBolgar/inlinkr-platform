-- Performance optimization: Add indexes for high-traffic columns
-- These indexes improve query performance for /api/links and analytics queries

-- Index on click_events.source for faster source-based filtering
CREATE INDEX IF NOT EXISTS idx_click_events_source ON click_events(source);

-- Index on links.video_id for faster video-based lookups
CREATE INDEX IF NOT EXISTS idx_links_video_id ON links(video_id);
