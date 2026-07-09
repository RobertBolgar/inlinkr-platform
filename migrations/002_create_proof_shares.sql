-- Create proof_shares table for public proof sharing
-- This table tracks public proof share links with random tokens

CREATE TABLE IF NOT EXISTS proof_shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_token TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  link_id INTEGER,
  youtube_video_id TEXT,
  title TEXT,
  is_enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  last_viewed_at TEXT
);

-- Create unique index on public_token for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_proof_shares_public_token ON proof_shares(public_token);

-- Create index on user_id for user's proof shares
CREATE INDEX IF NOT EXISTS idx_proof_shares_user_id ON proof_shares(user_id);

-- Create index on link_id for proof shares per link
CREATE INDEX IF NOT EXISTS idx_proof_shares_link_id ON proof_shares(link_id);

-- Create index on is_enabled for filtering active shares
CREATE INDEX IF NOT EXISTS idx_proof_shares_is_enabled ON proof_shares(is_enabled);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_proof_shares_created_at ON proof_shares(created_at);
