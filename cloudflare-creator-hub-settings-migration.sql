-- Create creator_hub_settings table for Creator Hub customization
-- This allows creators to customize their public hub presentation

CREATE TABLE IF NOT EXISTS creator_hub_settings (
  user_id INTEGER PRIMARY KEY,
  creator_tagline TEXT,
  creator_bio TEXT,
  featured_link_id INTEGER,
  featured_title_override TEXT,
  featured_description_override TEXT,
  featured_cta_text TEXT,
  show_resources INTEGER DEFAULT 1,
  show_videos INTEGER DEFAULT 1,
  show_metrics INTEGER DEFAULT 1,
  custom_section_title TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (featured_link_id) REFERENCES links(id) ON DELETE SET NULL
);

-- Create index for featured_link_id lookups
CREATE INDEX IF NOT EXISTS idx_creator_hub_settings_featured_link_id ON creator_hub_settings(featured_link_id);
