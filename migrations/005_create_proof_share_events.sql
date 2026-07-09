-- Phase 1: Create proof_share_events table for proof engagement analytics
-- This table tracks aggregate proof engagement without exposing viewer identity

CREATE TABLE IF NOT EXISTS proof_share_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proof_share_id INTEGER NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'view',
  created_at TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  ip_hash TEXT
);

-- Create index on proof_share_id for fast lookups by proof
CREATE INDEX IF NOT EXISTS idx_proof_share_events_proof_share_id ON proof_share_events(proof_share_id);

-- Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_proof_share_events_created_at ON proof_share_events(created_at);

-- Create index on event_type for filtering by event type
CREATE INDEX IF NOT EXISTS idx_proof_share_events_event_type ON proof_share_events(event_type);
