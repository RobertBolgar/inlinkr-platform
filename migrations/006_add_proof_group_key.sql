-- Add proof_group_key column to proof_shares for stable group-based operations
-- This enables production-safe group disabling without relying on title matching

ALTER TABLE proof_shares ADD COLUMN proof_group_key TEXT;

-- Create index for fast group-based queries
CREATE INDEX IF NOT EXISTS idx_proof_shares_proof_group_key ON proof_shares(proof_group_key);
