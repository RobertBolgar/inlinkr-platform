import { getAuthenticatedUser } from '../auth-helper.js';
import { checkRateLimit, getUserRateLimitKey, RATE_LIMITS, createRateLimitResponse } from '../rate-limit-helper.js';
import { getVideoClickCount } from '../analytics-helper.js';

export async function onRequest(context) {
  const { request, env, params } = context;

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get authenticated user
    const user = await getAuthenticatedUser(request, env);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check rate limit
    const rateLimitKey = getUserRateLimitKey(user.id);
    const rateLimitResult = await checkRateLimit(env, rateLimitKey, RATE_LIMITS.ANALYTICS);

    if (!rateLimitResult.success) {
      return createRateLimitResponse('Too many requests. Please try again later.');
    }

    // Extract video_id from params - handle both destructured and direct access
    const video_id = params?.video_id || params?.id;

    if (!video_id) {
      console.error('Video Performance API: Missing video_id from params', JSON.stringify(params));
      return new Response(JSON.stringify({ error: 'video_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify ownership: Fetch link_usages and links for this video that belong to the user
    let linkUsages = { results: [] };
    let links = { results: [] };

    try {
      linkUsages = await env.DB.prepare(
        `SELECT id, link_id, youtube_video_id, placement_type, placement_name,
                public_code, source_code, destination_url_snapshot, title_snapshot
         FROM link_usages
         WHERE user_id = ? AND youtube_video_id = ? AND is_active = 1`
      ).bind(user.id, video_id).all();
    } catch (error) {
      console.error('Video Performance API: Error fetching link_usages', error);
    }

    // Fetch links from both modern (link_usages) and legacy (links.video_id) paths
    // Then combine and dedupe by link ID
    try {
      const usages = linkUsages.results || [];
      const allLinks = new Map();

      // Path 1: Fetch parent links from link_usages (modern tracking)
      if (usages.length > 0) {
        const linkIds = usages.map(u => u.link_id);
        const placeholders = linkIds.map(() => '?').join(',');
        const usageLinks = await env.DB.prepare(
          `SELECT id, slug, title, original_url, video_id
           FROM links
           WHERE id IN (${placeholders}) AND user_id = ? AND is_active = 1`
        ).bind(...linkIds, user.id).all();
        (usageLinks.results || []).forEach(l => allLinks.set(l.id, l));
      }

      // Path 2: Fetch links by video_id (legacy base video attachment)
      // Always run this, even if link_usages exist, to catch base-video links
      const legacyLinks = await env.DB.prepare(
        `SELECT id, slug, title, original_url, video_id
         FROM links
         WHERE user_id = ? AND video_id = ? AND is_active = 1`
      ).bind(user.id, video_id).all();
      (legacyLinks.results || []).forEach(l => allLinks.set(l.id, l));

      // Convert Map back to results format
      links = { results: Array.from(allLinks.values()) };
    } catch (error) {
      console.error('Video Performance API: Error fetching links', error);
    }

    // If no data found, return 404
    if ((!linkUsages.results || linkUsages.results.length === 0) &&
        (!links.results || links.results.length === 0)) {
      console.log('Video Performance API: No data found for video', video_id, 'user', user.id);
      return new Response(JSON.stringify({ error: 'Video not found or no data available' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const usages = linkUsages.results || [];
    const userLinks = links.results || [];

    // Build canonical currentVideoAttributionRows array FIRST
    // This is the single source of truth for all attribution calculations
    const currentVideoAttributionRows = [];

    // Add usage-based attribution rows (modern tracking with link_usages)
    if (usages.length > 0) {
      const linkMap = new Map();
      userLinks.forEach(l => linkMap.set(l.id, l));

      for (const usage of usages) {
        const link = linkMap.get(usage.link_id);
        if (!link) continue;

        // This usage is valid for the current video (already filtered by youtube_video_id)
        currentVideoAttributionRows.push({
          link_id: usage.link_id,
          link_usage_id: usage.id,
          placement_type: usage.placement_type,
          placement_name: usage.placement_name,
          source_code: usage.source_code,
          destination_url: usage.destination_url_snapshot || link.original_url,
          link_title: usage.title_snapshot || link.title || link.slug,
          link_slug: link.slug,
          youtube_video_id: usage.youtube_video_id,
          attribution_type: 'usage'
        });
      }
    } else {
      // Legacy mode: add legacy links without link_usages
      for (const link of userLinks) {
        currentVideoAttributionRows.push({
          link_id: link.id,
          link_usage_id: null,
          placement_type: null,
          placement_name: null,
          source_code: null,
          destination_url: link.original_url,
          link_title: link.title || link.slug,
          link_slug: link.slug,
          youtube_video_id: link.video_id,
          attribution_type: 'legacy'
        });
      }
    }

    // Fetch placements for all links, filtered by current video_id
    // This is the source of truth for placement metadata
    const placementMap = new Map();
    const linkIdArray = [];
    usages.forEach(u => {
      if (u.link_id) linkIdArray.push(u.link_id);
    });
    userLinks.forEach(l => linkIdArray.push(l.id));

    if (linkIdArray.length > 0) {
      try {
        const placeholders = linkIdArray.map(() => '?').join(',');
        const placementsResult = await env.DB.prepare(
          `SELECT p.id, p.link_id, p.name, p.type, p.source_code, p.link_usage_id, p.youtube_video_id
           FROM placements p
           WHERE p.link_id IN (${placeholders})
           AND (
             -- Condition 1: Placement has youtube_video_id matching current video
             p.youtube_video_id = ?
             OR
             -- Condition 2: Placement has link_usage_id belonging to current video
             p.link_usage_id IN (SELECT id FROM link_usages WHERE youtube_video_id = ?)
             OR
             -- Condition 3: Legacy fallback - placement has no video context, parent link has video_id matching current video,
             -- and source_code is not used by other placements/link_usages for different videos
             (
               p.youtube_video_id IS NULL
               AND p.link_usage_id IS NULL
               AND p.link_id IN (SELECT id FROM links WHERE video_id = ?)
               AND p.source_code NOT IN (
                 SELECT source_code FROM placements WHERE link_id = p.link_id AND youtube_video_id IS NOT NULL AND youtube_video_id != ?
                 UNION
                 SELECT source_code FROM link_usages WHERE link_id = p.link_id AND youtube_video_id IS NOT NULL AND youtube_video_id != ?
               )
             )
           )`
        ).bind(...linkIdArray, video_id, video_id, video_id, video_id, video_id).all();

        (placementsResult.results || []).forEach(p => {
          placementMap.set(p.source_code, p);
        });
      } catch (error) {
        console.error('Video Performance API: Error fetching placements', error);
      }
    }

    // Enrich attribution rows with placement metadata
    for (const row of currentVideoAttributionRows) {
      if (row.source_code) {
        const placement = placementMap.get(row.source_code);
        if (placement) {
          row.placement_id = placement.id;
          row.placement_name = placement.name || row.placement_name;
          row.placement_type = placement.type || row.placement_type;
        }
      }
    }

    // DEBUG: Log canonical rows
    console.log('Video Performance API: Canonical attribution rows for video', video_id, ':', JSON.stringify(currentVideoAttributionRows, null, 2));

    // Build click counting rows: use canonical rows if they have source_code,
    // otherwise fall back to video-scoped placementMap entries
    const clickCountRows = currentVideoAttributionRows.some(r => r.source_code)
      ? currentVideoAttributionRows
      : Array.from(placementMap.values()).map(p => {
          const link = userLinks.find(l => l.id === p.link_id);
          return {
            link_id: p.link_id,
            link_usage_id: p.link_usage_id,
            source_code: p.source_code,
            placement_name: p.name,
            placement_type: p.type,
            destination_url: link?.original_url || '',
            link_title: link?.title || link?.slug || '',
            link_slug: link?.slug || ''
          };
        });

    // Calculate total_clicks from canonical array
    let totalClicks = 0;
    let attributionMode = 'none';

    if (usages.length > 0) {
      // Usage mode: count clicks by link_usage_id
      const usageIds = usages.map(u => u.id);
      const placeholders = usageIds.map(() => '?').join(',');
      try {
        const clickResult = await env.DB.prepare(
          `SELECT COUNT(*) as count FROM click_events WHERE link_usage_id IN (${placeholders})`
        ).bind(...usageIds).first();
        totalClicks = clickResult?.count || 0;
        attributionMode = 'usage';
      } catch (error) {
        console.error('Video Performance API: Error fetching usage-mode clicks', error);
      }
    } else if (currentVideoAttributionRows.length > 0 && placementMap.size > 0) {
      // Placement mode: count clicks by link_id + source from click counting rows
      try {
        let total = 0;
        for (const row of clickCountRows) {
          if (row.source_code) {
            const clickResult = await env.DB.prepare(
              `SELECT COUNT(*) as count FROM click_events WHERE link_id = ? AND source = ?`
            ).bind(row.link_id, row.source_code).first();
            total += clickResult?.count || 0;
          }
        }
        totalClicks = total;
        attributionMode = 'placement';
      } catch (error) {
        console.error('Video Performance API: Error fetching placement-mode clicks', error);
      }
    } else if (currentVideoAttributionRows.length > 0) {
      // Legacy mode: no attribution data available
      attributionMode = 'legacy';
      totalClicks = 0;
    }

    // Fetch YouTube metadata
    let title = null;
    let thumbnail = null;
    let views = null;
    let ctr = null;

    try {
      const connection = await env.DB.prepare(
        'SELECT access_token, refresh_token FROM youtube_connections WHERE user_id = ? AND is_active = 1'
      ).bind(user.id).first();

      if (connection) {
        let accessToken = connection.access_token;
        const refreshToken = connection.refresh_token;

        const refreshAccessToken = async () => {
          const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
          const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;

          if (!clientId || !clientSecret) {
            throw new Error('Google OAuth not configured');
          }

          const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: refreshToken,
              grant_type: 'refresh_token',
            }),
          });

          if (!refreshResponse.ok) {
            throw new Error('Token refresh failed');
          }

          const refreshData = await refreshResponse.json();
          const newAccessToken = refreshData.access_token;
          const expiresIn = refreshData.expires_in || 3600;
          const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

          await env.DB.prepare(
            'UPDATE youtube_connections SET access_token = ?, token_expires_at = ? WHERE user_id = ? AND is_active = 1'
          ).bind(newAccessToken, tokenExpiresAt, user.id).run();

          return newAccessToken;
        };

        let videosResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${video_id}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        if (videosResponse.status === 401) {
          try {
            accessToken = await refreshAccessToken();
            videosResponse = await fetch(
              `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${video_id}`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                },
              }
            );
          } catch (refreshError) {
            console.error('Token refresh error:', refreshError);
          }
        }

        if (videosResponse.ok) {
          const videosData = await videosResponse.json();
          if (videosData.items && videosData.items.length > 0) {
            const item = videosData.items[0];
            title = item.snippet?.title || null;
            thumbnail = item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || null;
            views = parseInt(item.statistics?.viewCount || '0', 10);
            ctr = views > 0 ? (totalClicks / views) * 100 : null;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching YouTube metadata:', error);
    }

    // Build placements list from canonical array
    const placements = [];
    const placementClicks = new Map();

    // Calculate placement clicks from canonical array
    if (attributionMode === 'usage') {
      // Usage mode: count clicks by link_usage_id, grouped by source
      for (const row of currentVideoAttributionRows) {
        if (row.source_code && row.link_usage_id) {
          const clickResult = await env.DB.prepare(
            `SELECT COUNT(*) as count FROM click_events WHERE link_usage_id = ? AND source = ?`
          ).bind(row.link_usage_id, row.source_code).first();
          const count = clickResult?.count || 0;
          const currentCount = placementClicks.get(row.source_code) || 0;
          placementClicks.set(row.source_code, currentCount + count);
        }
      }
    } else if (attributionMode === 'placement') {
      // Placement mode: count clicks by link_id + source from click counting rows
      for (const row of clickCountRows) {
        if (row.source_code) {
          const clickResult = await env.DB.prepare(
            `SELECT COUNT(*) as count FROM click_events WHERE link_id = ? AND source = ?`
          ).bind(row.link_id, row.source_code).first();
          const count = clickResult?.count || 0;
          const currentCount = placementClicks.get(row.source_code) || 0;
          placementClicks.set(row.source_code, currentCount + count);
        }
      }
    }

    // Build placements list from placementClicks
    placementClicks.forEach((count, source) => {
      const placement = placementMap.get(source);
      placements.push({
        placement_id: placement?.id || -1,
        placement_name: placement?.name || 'Direct',
        placement_type: placement?.type || 'direct',
        clicks: count
      });
    });
    placements.sort((a, b) => b.clicks - a.clicks);

    // Calculate link click counts from canonical array
    const linkClicks = new Map();
    if (attributionMode === 'usage') {
      const usageIds = usages.map(u => u.id);
      const placeholders = usageIds.map(() => '?').join(',');
      try {
        const linkResults = await env.DB.prepare(
          `SELECT link_id, COUNT(*) as count FROM click_events WHERE link_usage_id IN (${placeholders}) GROUP BY link_id`
        ).bind(...usageIds).all();
        (linkResults.results || []).forEach(l => {
          linkClicks.set(l.link_id, l.count);
        });
      } catch (error) {
        console.error('Video Performance API: Error fetching link clicks', error);
      }
    } else if (attributionMode === 'placement') {
      // Count clicks by link_id from click counting rows
      for (const row of clickCountRows) {
        if (row.source_code) {
          const clickResult = await env.DB.prepare(
            `SELECT COUNT(*) as count FROM click_events WHERE link_id = ? AND source = ?`
          ).bind(row.link_id, row.source_code).first();
          const count = clickResult?.count || 0;
          const currentCount = linkClicks.get(row.link_id) || 0;
          linkClicks.set(row.link_id, currentCount + count);
        }
      }
    }

    // Build smart links list from all userLinks attached to this video
    // This ensures links with 0 clicks or no attribution data are still displayed
    const smartLinks = [];
    const uniqueLinkIds = new Set();

    // Collect all unique link IDs from userLinks (these are all links attached to the video)
    userLinks.forEach(l => uniqueLinkIds.add(l.id));

    for (const linkId of uniqueLinkIds) {
      const link = userLinks.find(l => l.id === linkId);
      if (!link) continue;

      const clicks = linkClicks.get(linkId) || 0;
      let destinationDomain = null;
      try {
        const url = new URL(link.original_url);
        destinationDomain = url.hostname;
      } catch {
        destinationDomain = link.original_url;
      }

      // Get placement breakdown for this link from click counting rows
      const linkRows = clickCountRows.filter(r => r.link_id === linkId);
      const placementBreakdown = [];
      let topSource = null;
      let maxCount = 0;

      for (const row of linkRows) {
        if (!row.source_code) continue;

        let clickCount = 0;
        if (attributionMode === 'usage' && row.link_usage_id) {
          const clickResult = await env.DB.prepare(
            `SELECT COUNT(*) as count FROM click_events WHERE link_usage_id = ? AND source = ?`
          ).bind(row.link_usage_id, row.source_code).first();
          clickCount = clickResult?.count || 0;
        } else if (attributionMode === 'placement') {
          const clickResult = await env.DB.prepare(
            `SELECT COUNT(*) as count FROM click_events WHERE link_id = ? AND source = ?`
          ).bind(row.link_id, row.source_code).first();
          clickCount = clickResult?.count || 0;
        }

        // Include placements even with 0 clicks so placement name is available
        placementBreakdown.push({
          source_code: row.source_code,
          click_count: clickCount,
          placement_name: row.placement_name || 'Direct',
          placement_type: row.placement_type || 'direct'
        });

        if (clickCount > maxCount) {
          maxCount = clickCount;
          topSource = row.placement_name || 'Direct';
        }
      }

      placementBreakdown.sort((a, b) => b.click_count - a.click_count);

      smartLinks.push({
        link_id: link.id,
        slug: link.slug,
        title: link.title || link.slug,
        destination_domain: destinationDomain,
        destination_url: link.original_url,
        clicks: clicks,
        top_source: topSource,
        link_usage_id: attributionMode === 'usage' ? linkRows[0]?.link_usage_id : null,
        proof_available: attributionMode !== 'legacy',
        proof_context_type: attributionMode,
        placement_breakdown: placementBreakdown
      });
    }
    smartLinks.sort((a, b) => b.clicks - a.clicks);

    // Build best click paths (placement → link → destination) from click counting rows
    const clickPaths = [];
    for (const row of clickCountRows) {
      if (!row.source_code) continue;

      let clickCount = 0;
      if (attributionMode === 'usage' && row.link_usage_id) {
        const clickResult = await env.DB.prepare(
          `SELECT COUNT(*) as count FROM click_events WHERE link_usage_id = ? AND source = ?`
        ).bind(row.link_usage_id, row.source_code).first();
        clickCount = clickResult?.count || 0;
      } else if (attributionMode === 'placement') {
        const clickResult = await env.DB.prepare(
          `SELECT COUNT(*) as count FROM click_events WHERE link_id = ? AND source = ?`
        ).bind(row.link_id, row.source_code).first();
        clickCount = clickResult?.count || 0;
      }

      if (clickCount > 0) {
        let destinationDomain = null;
        try {
          const url = new URL(row.destination_url);
          destinationDomain = url.hostname;
        } catch {
          destinationDomain = row.destination_url;
        }

        clickPaths.push({
          placement_name: row.placement_name || 'Direct',
          placement_type: row.placement_type || 'direct',
          link_title: row.link_title,
          link_slug: row.link_slug,
          destination_domain: destinationDomain,
          clicks: clickCount
        });
      }
    }
    clickPaths.sort((a, b) => b.clicks - a.clicks);
    // For legacy mode, clickPaths remains empty

    // Fetch proofs for this video
    let proofsResult = { results: [] };
    try {
      proofsResult = await env.DB.prepare(
        `SELECT public_token, proof_mode, snapshot_clicks, created_at, is_enabled, link_id
       FROM proof_shares
       WHERE user_id = ? AND youtube_video_id = ?
       ORDER BY created_at DESC`
      ).bind(user.id, video_id).all();
    } catch (error) {
      console.error('Video Performance API: Error fetching proofs', error);
    }

    const proofs = (proofsResult.results || []).map(p => ({
      public_token: p.public_token,
      proof_mode: p.snapshot_clicks !== null ? 'snapshot' : 'live',
      snapshot_clicks: p.snapshot_clicks,
      created_at: p.created_at,
      is_enabled: p.is_enabled
    }));

    return new Response(JSON.stringify({
      success: true,
      data: {
        video_id,
        title,
        thumbnail,
        youtube_url: `https://youtube.com/watch?v=${video_id}`,
        total_clicks: totalClicks,
        total_views: views,
        ctr: ctr !== null ? parseFloat(ctr.toFixed(2)) : null,
        link_count: smartLinks.length,
        placements,
        smart_links: smartLinks,
        click_paths: clickPaths,
        proofs,
        attribution_mode: attributionMode
      }
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching video performance:', error);
    return new Response(JSON.stringify({ error: 'Failed to load video performance' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
