-- Phase 1: Add snapshot fields to proof_shares for immutable proof storage
-- This is additive and backward-compatible - old proof shares will have NULL snapshot fields

-- Add snapshot metrics fields
ALTER TABLE proof_shares ADD COLUMN snapshot_clicks INTEGER;
ALTER TABLE proof_shares ADD COLUMN snapshot_ctr REAL;
ALTER TABLE proof_shares ADD COLUMN snapshot_views INTEGER;
ALTER TABLE proof_shares ADD COLUMN snapshot_link_count INTEGER;

-- Add snapshot metadata fields
ALTER TABLE proof_shares ADD COLUMN snapshot_video_title TEXT;
ALTER TABLE proof_shares ADD COLUMN snapshot_thumbnail_url TEXT;
ALTER TABLE proof_shares ADD COLUMN snapshot_destination_domain TEXT;
ALTER TABLE proof_shares ADD COLUMN snapshot_destination_url TEXT;
ALTER TABLE proof_shares ADD COLUMN snapshot_top_placement_label TEXT;

-- Add snapshot timestamp
ALTER TABLE proof_shares ADD COLUMN snapshot_generated_at TEXT;

-- Add snapshot converting placements as JSON
ALTER TABLE proof_shares ADD COLUMN snapshot_converting_placements_json TEXT;
