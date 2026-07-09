-- Magic Link Authentication Tables

-- Create magic link tokens table
CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_magic_tokens_token ON magic_link_tokens(token);
CREATE INDEX IF NOT EXISTS idx_magic_tokens_email ON magic_link_tokens(email);
