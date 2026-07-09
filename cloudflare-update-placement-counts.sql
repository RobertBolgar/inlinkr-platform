-- Update placement_count for all existing links based on actual placements
UPDATE links 
SET placement_count = (
  SELECT COUNT(*) 
  FROM placements 
  WHERE placements.link_id = links.id
);
