-- Backfill proof_group_key for existing proof_shares
-- Uses deterministic grouping: user_id + youtube_video_id + link_id (or normalized destination_domain)
-- Fallback uses unique per-proof key: user_id::proof:{id}

-- Update records with link_id: user_id + youtube_video_id + link_id
UPDATE proof_shares
SET proof_group_key = user_id || '::' || youtube_video_id || '::link:' || link_id
WHERE proof_group_key IS NULL
  AND link_id IS NOT NULL
  AND youtube_video_id IS NOT NULL;

-- Update records without link_id but with destination_domain: user_id + youtube_video_id + normalized domain
UPDATE proof_shares
SET proof_group_key = user_id || '::' || youtube_video_id || '::domain:' ||
  LOWER(CASE
    WHEN snapshot_destination_domain LIKE 'www.%' THEN SUBSTR(snapshot_destination_domain, 5)
    ELSE snapshot_destination_domain
  END)
WHERE proof_group_key IS NULL
  AND link_id IS NULL
  AND youtube_video_id IS NOT NULL
  AND snapshot_destination_domain IS NOT NULL;

-- Update records with only youtube_video_id: user_id + youtube_video_id
UPDATE proof_shares
SET proof_group_key = user_id || '::' || youtube_video_id
WHERE proof_group_key IS NULL
  AND youtube_video_id IS NOT NULL;

-- Update records with neither (edge case): unique per-proof key to prevent unrelated grouping
UPDATE proof_shares
SET proof_group_key = user_id || '::proof:' || id
WHERE proof_group_key IS NULL;
