-- Add public_code field to links table for global smart short codes
-- This enables go.tubelinkr.com/{public_code} routing for Free links

-- Add public_code column
ALTER TABLE links ADD COLUMN public_code TEXT;

-- Create unique index on public_code for global uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_links_public_code ON links(public_code);

-- Create index for efficient lookups (partial index on non-null values)
CREATE INDEX IF NOT EXISTS idx_links_public_code_lookup ON links(public_code) WHERE public_code IS NOT NULL;

-- Backfill existing links with generated public codes
-- Generate 6-character lowercase alphanumeric codes
UPDATE links 
SET public_code = lower(hex(randomblob(3)))
WHERE public_code IS NULL;
