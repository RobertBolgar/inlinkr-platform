/**
 * Shared analytics utility functions for consistent click counting across all pages
 */

/**
 * Get click counts for all placements of a specific link
 * 
 * This is the single source of truth for placement click counts.
 * All pages (Dashboard, Analytics, Link Performance) must use this function.
 * 
 * @param {number} linkId - The link ID to get placement counts for
 * @param {object} env - Cloudflare environment with DB binding
 * @returns {Promise<Array>} Array of placements with click counts
 */
export async function getPlacementClickCounts(linkId, env) {
  // Get all placements for the link
  const placements = await env.DB.prepare(
    `SELECT id, link_id, name, type, source_code, public_code, link_usage_id, youtube_video_id, created_at, updated_at 
     FROM placements WHERE link_id = ? ORDER BY created_at DESC`
  ).bind(linkId).all();
  
  const placementList = placements.results || [];
  
  // Batch query click counts for all placements to avoid N+1
  const sourceCodes = placementList.map(p => p.source_code);
  let clickCountsMap = new Map();
  
  if (sourceCodes.length > 0) {
    const sourcePlaceholders = sourceCodes.map(() => '?').join(',');
    const clickResults = await env.DB.prepare(
      `SELECT source, COUNT(*) as count FROM click_events 
       WHERE link_id = ? AND source IN (${sourcePlaceholders}) GROUP BY source`
    ).bind(linkId, ...sourceCodes).all();
    
    (clickResults.results || []).forEach(row => {
      clickCountsMap.set(row.source, row.count);
    });
  }
  
  // Get click counts for each placement using single source of truth
  // Only match on source_code, not public_code
  const placementsWithClicks = placementList.map(placement => ({
    ...placement,
    clicks: clickCountsMap.get(placement.source_code) || 0
  }));
  
  // Add virtual "Direct" placement for clicks with no source
  const directClickCount = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM click_events 
     WHERE link_id = ? AND (source = 'direct' OR source IS NULL)`
  ).bind(linkId).first();
  
  if (directClickCount && directClickCount.count > 0) {
    placementsWithClicks.push({
      id: -1,
      link_id: parseInt(linkId),
      name: 'Direct',
      type: 'direct',
      source_code: 'direct',
      public_code: 'direct',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      clicks: directClickCount.count
    });
  }
  
  return placementsWithClicks;
}

/**
 * Get click counts for all link_usages of a specific link
 * 
 * This provides per-usage click counts for reusable destination analytics.
 * 
 * @param {number} linkId - The link ID to get usage counts for
 * @param {object} env - Cloudflare environment with DB binding
 * @returns {Promise<Object>} Object mapping link_usage_id to click count
 */
export async function getLinkUsageClickCounts(linkId, env) {
  const clickResults = await env.DB.prepare(
    `SELECT link_usage_id, COUNT(*) as clicks
     FROM click_events
     WHERE link_id = ? AND link_usage_id IS NOT NULL
     GROUP BY link_usage_id`
  ).bind(linkId).all();

  const usageClickCounts = {};
  (clickResults.results || []).forEach(row => {
    usageClickCounts[row.link_usage_id] = row.clicks;
  });

  return usageClickCounts;
}

/**
 * Get standardized click count for a specific video
 * 
 * This is the single source of truth for video-level click counting.
 * All pages (Analytics, Video Performance, Proof live mode) must use this function.
 * 
 * Logic:
 * 1. If link_usages exist for the video, count clicks by link_usage_id (for reusable links)
 * 2. If no link_usages but placements exist for the video's links, count clicks by placement.source matching click_events.source
 * 3. For legacy videos (links.video_id but no link_usages or placements), return 0 to avoid showing lifetime link clicks
 * 4. This prevents double-counting when links are reused across multiple videos
 * 
 * @param {string} userId - The user ID
 * @param {string} videoId - The YouTube video ID
 * @param {object} env - Cloudflare environment with DB binding
 * @returns {Promise<{count: number, attributionMode: string}>} Object with count and attribution mode
 */
export async function getVideoClickCount(userId, videoId, env) {
  // First, check if there are active link_usages for this video
  const linkUsages = await env.DB.prepare(
    `SELECT id FROM link_usages 
     WHERE user_id = ? AND youtube_video_id = ? AND is_active = 1`
  ).bind(userId, videoId).all();

  const usages = linkUsages.results || [];

  if (usages.length > 0) {
    // Count clicks by link_usage_id (for reusable links)
    const usageIds = usages.map(u => u.id);
    const placeholders = usageIds.map(() => '?').join(',');
    const clickResult = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM click_events WHERE link_usage_id IN (${placeholders})`
    ).bind(...usageIds).first();
    return {
      count: clickResult?.count || 0,
      attributionMode: 'usage'
    };
  }

  // Check if there are links attached to this video
  const links = await env.DB.prepare(
    `SELECT id FROM links WHERE user_id = ? AND video_id = ? AND is_active = 1`
  ).bind(userId, videoId).all();

  const userLinks = links.results || [];

  if (userLinks.length > 0) {
    // Check if there are placements for these links
    // Filter by current video_id FIRST: either youtube_video_id matches or link_usage_id belongs to this video
    const linkIds = userLinks.map(l => l.id);
    const placeholders = linkIds.map(() => '?').join(',');
    const placements = await env.DB.prepare(
      `SELECT id, link_id, source_code, link_usage_id
       FROM placements
       WHERE link_id IN (${placeholders})
       AND (youtube_video_id = ? OR link_usage_id IN (
         SELECT id FROM link_usages WHERE youtube_video_id = ?
       ))`
    ).bind(...linkIds, videoId, videoId).all();

    const placementList = placements.results || [];

    if (placementList.length > 0) {
      // Count clicks by placement.source matching click_events.source
      // Use link_usage_id if available for video-scoped query, otherwise fall back to link_id
      // Batch query to avoid N+1
      const usageIds = placementList.filter(p => p.link_usage_id).map(p => p.link_usage_id);
      const linkIds = placementList.filter(p => !p.link_usage_id).map(p => p.link_id);
      const sourceCodes = placementList.map(p => p.source_code);

      let totalClicks = 0;

      // Batch query for link_usage_id placements
      if (usageIds.length > 0) {
        const usagePlaceholders = usageIds.map(() => '?').join(',');
        const sourcePlaceholders = sourceCodes.map(() => '?').join(',');
        const usageClickResults = await env.DB.prepare(
          `SELECT link_usage_id, source, COUNT(*) as count 
           FROM click_events 
           WHERE link_usage_id IN (${usagePlaceholders}) AND source IN (${sourcePlaceholders})
           GROUP BY link_usage_id, source`
        ).bind(...usageIds, ...sourceCodes).all();

        const usageClickMap = new Map();
        (usageClickResults.results || []).forEach(row => {
          const key = `${row.link_usage_id}_${row.source}`;
          usageClickMap.set(key, row.count);
        });

        for (const placement of placementList) {
          if (placement.link_usage_id) {
            const key = `${placement.link_usage_id}_${placement.source_code}`;
            totalClicks += usageClickMap.get(key) || 0;
          }
        }
      }

      // Batch query for link_id placements
      if (linkIds.length > 0) {
        const linkPlaceholders = linkIds.map(() => '?').join(',');
        const sourcePlaceholders = sourceCodes.map(() => '?').join(',');
        const linkClickResults = await env.DB.prepare(
          `SELECT link_id, source, COUNT(*) as count 
           FROM click_events 
           WHERE link_id IN (${linkPlaceholders}) AND source IN (${sourcePlaceholders})
           GROUP BY link_id, source`
        ).bind(...linkIds, ...sourceCodes).all();

        const linkClickMap = new Map();
        (linkClickResults.results || []).forEach(row => {
          const key = `${row.link_id}_${row.source}`;
          linkClickMap.set(key, row.count);
        });

        for (const placement of placementList) {
          if (!placement.link_usage_id) {
            const key = `${placement.link_id}_${placement.source_code}`;
            totalClicks += linkClickMap.get(key) || 0;
          }
        }
      }

      return {
        count: totalClicks,
        attributionMode: 'placement'
      };
    }

    // Legacy video with links but no link_usages or placements
    // Return 0 clicks to avoid showing lifetime link clicks as video clicks
    return {
      count: 0,
      attributionMode: 'legacy_unattributed'
    };
  }

  // No data at all
  return {
    count: 0,
    attributionMode: 'none'
  };
}

/**
 * Get standardized placement click breakdown for a specific video
 * 
 * This provides consistent placement-level click counts for a video.
 * Uses the same filtering logic as getVideoClickCount.
 * 
 * @param {string} userId - The user ID
 * @param {string} videoId - The YouTube video ID
 * @param {object} env - Cloudflare environment with DB binding
 * @returns {Promise<{breakdown: Array, attributionMode: string}>} Object with breakdown and attribution mode
 */
export async function getVideoPlacementBreakdown(userId, videoId, env) {
  // First, check if there are active link_usages for this video
  const linkUsages = await env.DB.prepare(
    `SELECT id FROM link_usages 
     WHERE user_id = ? AND youtube_video_id = ? AND is_active = 1`
  ).bind(userId, videoId).all();

  const usages = linkUsages.results || [];

  if (usages.length > 0) {
    // Count clicks by source, filtered by link_usage_id
    const usageIds = usages.map(u => u.id);
    const placeholders = usageIds.map(() => '?').join(',');
    const placementResults = await env.DB.prepare(
      `SELECT source, COUNT(*) as count 
       FROM click_events 
       WHERE link_usage_id IN (${placeholders}) 
       GROUP BY source`
    ).bind(...usageIds).all();
    return {
      breakdown: placementResults.results || [],
      attributionMode: 'usage'
    };
  }

  // Check if there are links attached to this video
  const links = await env.DB.prepare(
    `SELECT id FROM links WHERE user_id = ? AND video_id = ? AND is_active = 1`
  ).bind(userId, videoId).all();

  const userLinks = links.results || [];

  if (userLinks.length > 0) {
    // Check if there are placements for these links
    // Filter by current video_id FIRST: either youtube_video_id matches or link_usage_id belongs to this video
    const linkIds = userLinks.map(l => l.id);
    const placeholders = linkIds.map(() => '?').join(',');
    const placements = await env.DB.prepare(
      `SELECT id, link_id, source_code, link_usage_id
       FROM placements
       WHERE link_id IN (${placeholders})
       AND (youtube_video_id = ? OR link_usage_id IN (
         SELECT id FROM link_usages WHERE youtube_video_id = ?
       ))`
    ).bind(...linkIds, videoId, videoId).all();

    const placementList = placements.results || [];

    if (placementList.length > 0) {
      // Count clicks by placement.source matching click_events.source
      // Use link_usage_id if available for video-scoped query, otherwise fall back to link_id
      // Batch query to avoid N+1
      const usageIds = placementList.filter(p => p.link_usage_id).map(p => p.link_usage_id);
      const linkIds = placementList.filter(p => !p.link_usage_id).map(p => p.link_id);
      const sourceCodes = placementList.map(p => p.source_code);

      const breakdown = [];

      // Batch query for link_usage_id placements
      if (usageIds.length > 0) {
        const usagePlaceholders = usageIds.map(() => '?').join(',');
        const sourcePlaceholders = sourceCodes.map(() => '?').join(',');
        const usageClickResults = await env.DB.prepare(
          `SELECT link_usage_id, source, COUNT(*) as count 
           FROM click_events 
           WHERE link_usage_id IN (${usagePlaceholders}) AND source IN (${sourcePlaceholders})
           GROUP BY link_usage_id, source`
        ).bind(...usageIds, ...sourceCodes).all();

        const usageClickMap = new Map();
        (usageClickResults.results || []).forEach(row => {
          const key = `${row.link_usage_id}_${row.source}`;
          usageClickMap.set(key, row.count);
        });

        for (const placement of placementList) {
          if (placement.link_usage_id) {
            const key = `${placement.link_usage_id}_${placement.source_code}`;
            const count = usageClickMap.get(key) || 0;
            if (count > 0) {
              breakdown.push({
                source: placement.source_code,
                count
              });
            }
          }
        }
      }

      // Batch query for link_id placements
      if (linkIds.length > 0) {
        const linkPlaceholders = linkIds.map(() => '?').join(',');
        const sourcePlaceholders = sourceCodes.map(() => '?').join(',');
        const linkClickResults = await env.DB.prepare(
          `SELECT link_id, source, COUNT(*) as count 
           FROM click_events 
           WHERE link_id IN (${linkPlaceholders}) AND source IN (${sourcePlaceholders})
           GROUP BY link_id, source`
        ).bind(...linkIds, ...sourceCodes).all();

        const linkClickMap = new Map();
        (linkClickResults.results || []).forEach(row => {
          const key = `${row.link_id}_${row.source}`;
          linkClickMap.set(key, row.count);
        });

        for (const placement of placementList) {
          if (!placement.link_usage_id) {
            const key = `${placement.link_id}_${placement.source_code}`;
            const count = linkClickMap.get(key) || 0;
            if (count > 0) {
              breakdown.push({
                source: placement.source_code,
                count
              });
            }
          }
        }
      }

      return {
        breakdown,
        attributionMode: 'placement'
      };
    }

    // Legacy video with links but no link_usages or placements
    // Return empty breakdown to avoid showing lifetime link clicks
    return {
      breakdown: [],
      attributionMode: 'legacy_unattributed'
    };
  }

  // No data at all
  return {
    breakdown: [],
    attributionMode: 'none'
  };
}
