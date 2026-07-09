-- Add public_code field to placements table for clean, human-readable tracking URLs
ALTER TABLE placements ADD COLUMN public_code TEXT;

-- Create index on public_code for efficient lookups
CREATE INDEX IF NOT EXISTS idx_placements_public_code ON placements(public_code);

-- Create unique constraint on public_code per link
CREATE UNIQUE INDEX IF NOT EXISTS idx_placements_link_public_code ON placements(link_id, public_code);

-- Populate public_code for existing placements
-- Default placements get readable codes
UPDATE placements SET public_code = 'description' WHERE type = 'description' AND public_code IS NULL;
UPDATE placements SET public_code = 'pinned' WHERE type = 'pinned' AND public_code IS NULL;
UPDATE placements SET public_code = 'bio' WHERE type = 'bio' AND public_code IS NULL;
UPDATE placements SET public_code = 'short' WHERE type = 'short' AND public_code IS NULL;
UPDATE placements SET public_code = 'video' WHERE type = 'video' AND public_code IS NULL;

-- For other/unknown placements, generate a slug from the name
-- This will be a simple slugification (lowercase, replace spaces with hyphens)
UPDATE placements SET public_code = lower(replace(replace(name, ' ', '-'), '_', '-')) 
WHERE type = 'other' AND public_code IS NULL;
