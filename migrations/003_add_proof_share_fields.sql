-- Add human_insight and attribution fields to proof_shares table
-- This enables storing snapshot data for public proof shares

ALTER TABLE proof_shares ADD COLUMN human_insight TEXT;
ALTER TABLE proof_shares ADD COLUMN destination_url TEXT;
ALTER TABLE proof_shares ADD COLUMN top_source_label TEXT;
ALTER TABLE proof_shares ADD COLUMN additional_source_labels TEXT;
