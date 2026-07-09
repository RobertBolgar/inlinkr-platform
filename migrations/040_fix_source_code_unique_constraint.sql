-- Fix source_code UNIQUE constraint to be per-link instead of global
-- The source_code generation is designed to be per-link (q, q2, q3... for each link)
-- But migration 039 created a global UNIQUE constraint which causes conflicts

-- Deployment instructions:
-- Local/Dev: npx wrangler d1 execute tubelinkr-db --file=./migrations/040_fix_source_code_unique_constraint.sql
-- Production: npx wrangler d1 execute tubelinkr-prod-db --remote --file=./migrations/040_fix_source_code_unique_constraint.sql

-- Step 1: Drop the global unique index
DROP INDEX IF EXISTS idx_placements_source_code_unique;

-- Step 2: Create a composite unique index on (link_id, source_code)
-- This allows the same source_code to exist across different links
CREATE UNIQUE INDEX IF NOT EXISTS idx_placements_source_code_unique ON placements(link_id, source_code);
