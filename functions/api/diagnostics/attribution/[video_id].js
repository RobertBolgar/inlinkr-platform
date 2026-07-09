import { getAuthenticatedUser } from '../../auth-helper.js';
import { checkRateLimit, getUserRateLimitKey, RATE_LIMITS, createRateLimitResponse } from '../../rate-limit-helper.js';

export async function onRequest(context) {
  const { request, env, params } = context;

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check if diagnostics are enabled (disabled on production by default)
  if (env.ENABLE_DIAGNOSTICS !== 'true') {
    return new Response(JSON.stringify({ error: 'Diagnostics endpoint is disabled' }), {
      status: 403,
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

    // Check rate limit (diagnostic endpoint: stricter limit)
    const rateLimitKey = getUserRateLimitKey(user.id);
    const rateLimitResult = await checkRateLimit(env, rateLimitKey, { requests: 30, period: 60 });

    if (!rateLimitResult.success) {
      return createRateLimitResponse('Too many diagnostic requests. Please try again later.');
    }

    // Extract video_id from params
    const video_id = params?.video_id || params?.id;

    if (!video_id) {
      return new Response(JSON.stringify({ error: 'video_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch all data for this video that belongs to the user
    const [linkUsages, links, placements, clickEvents] = await Promise.all([
      env.DB.prepare(
        `SELECT * FROM link_usages WHERE youtube_video_id = ? AND user_id = ?`
      ).bind(video_id, user.id).all(),
      env.DB.prepare(
        `SELECT * FROM links WHERE video_id = ? AND user_id = ?`
      ).bind(video_id, user.id).all(),
      env.DB.prepare(
        `SELECT * FROM placements WHERE youtube_video_id = ? AND link_id IN (SELECT id FROM links WHERE user_id = ?)`
      ).bind(video_id, user.id).all(),
      env.DB.prepare(
        `SELECT * FROM click_events WHERE link_id IN (SELECT id FROM links WHERE user_id = ?)`
      ).bind(user.id).all()
    ]);

    // Get all link_ids for this user
    const userLinkIds = new Set((links.results || []).map(l => l.id));

    // Get all link_usages for this user (to handle cross-video links)
    const allUserLinkUsages = await env.DB.prepare(
      `SELECT * FROM link_usages WHERE user_id = ?`
    ).bind(user.id).all();

    // Get all placements for this user's links
    const allUserPlacements = await env.DB.prepare(
      `SELECT * FROM placements WHERE link_id IN (${Array.from(userLinkIds).map(() => '?').join(',')})`
    ).bind(...Array.from(userLinkIds)).all();

    // Get all click events for this user's links
    const allUserClickEvents = await env.DB.prepare(
      `SELECT * FROM click_events WHERE link_id IN (${Array.from(userLinkIds).map(() => '?').join(',')})`
    ).bind(...Array.from(userLinkIds)).all();

    // Build canonical attribution rows
    const canonicalAttributionRows = [];
    const linkMap = new Map((links.results || []).map(l => [l.id, l]));
    const linkUsageMap = new Map((allUserLinkUsages.results || []).map(lu => [lu.id, lu]));
    const placementMap = new Map((allUserPlacements.results || []).map(p => [p.source_code, p]));

    // Add rows from link_usages for this video
    for (const usage of (linkUsages.results || [])) {
      const link = linkMap.get(usage.link_id);
      if (!link) continue;

      canonicalAttributionRows.push({
        link_id: usage.link_id,
        link_usage_id: usage.id,
        placement_id: null,
        source_code: usage.source_code,
        youtube_video_id: usage.youtube_video_id,
        placement_type: usage.placement_type,
        placement_name: usage.placement_name,
        destination_url: usage.destination_url_snapshot || link.original_url,
        link_title: usage.title_snapshot || link.title || link.slug,
        link_slug: link.slug,
        attribution_type: 'usage'
      });
    }

    // Add rows from legacy links (links.video_id)
    for (const link of (links.results || [])) {
      if (link.video_id === video_id) {
        // Check if this link already has a link_usage for this video
        const hasUsage = (linkUsages.results || []).some(lu => lu.link_id === link.id && lu.youtube_video_id === video_id);
        if (!hasUsage) {
          canonicalAttributionRows.push({
            link_id: link.id,
            link_usage_id: null,
            placement_id: null,
            source_code: null,
            youtube_video_id: link.video_id,
            placement_type: null,
            placement_name: null,
            destination_url: link.original_url,
            link_title: link.title || link.slug,
            link_slug: link.slug,
            attribution_type: 'legacy'
          });
        }
      }
    }

    // Calculate click counts by link_id
    const clicksByLinkId = new Map();
    for (const click of (allUserClickEvents.results || [])) {
      const count = clicksByLinkId.get(click.link_id) || 0;
      clicksByLinkId.set(click.link_id, count + 1);
    }

    // Calculate click counts by link_usage_id
    const clicksByLinkUsageId = new Map();
    for (const click of (allUserClickEvents.results || [])) {
      if (click.link_usage_id) {
        const count = clicksByLinkUsageId.get(click.link_usage_id) || 0;
        clicksByLinkUsageId.set(click.link_usage_id, count + 1);
      }
    }

    // Calculate click counts by source
    const clicksBySource = new Map();
    for (const click of (allUserClickEvents.results || [])) {
      const source = click.source || 'direct';
      const count = clicksBySource.get(source) || 0;
      clicksBySource.set(source, count + 1);
    }

    // Identify excluded rows (placements without video context)
    const excludedRows = [];
    for (const placement of (allUserPlacements.results || [])) {
      if (!placement.youtube_video_id && !placement.link_usage_id) {
        const link = linkMap.get(placement.link_id);
        excludedRows.push({
          placement_id: placement.id,
          link_id: placement.link_id,
          source_code: placement.source_code,
          placement_name: placement.name,
          placement_type: placement.type,
          reason: 'No video context (youtube_video_id and link_usage_id are NULL)'
        });
      }
    }

    // Determine attribution mode
    let attributionMode = 'legacy';
    if (linkUsages.results && linkUsages.results.length > 0) {
      attributionMode = 'usage';
    } else if (placements.results && placements.results.length > 0) {
      attributionMode = 'placement';
    }

    // Calculate total clicks for this video
    let totalClicks = 0;
    for (const row of canonicalAttributionRows) {
      if (row.link_usage_id) {
        totalClicks += clicksByLinkUsageId.get(row.link_usage_id) || 0;
      } else if (row.source_code) {
        // For legacy/placement mode, count by source
        const sourceClicks = await env.DB.prepare(
          `SELECT COUNT(*) as count FROM click_events WHERE link_id = ? AND source = ?`
        ).bind(row.link_id, row.source_code).first();
        totalClicks += sourceClicks?.count || 0;
      }
    }

    const response = {
      video_id,
      user_id: user.id,
      attribution_mode: attributionMode,
      total_clicks: totalClicks,
      related_links: links.results || [],
      related_link_usages: linkUsages.results || [],
      related_placements: placements.results || [],
      clicks_by_link_id: Object.fromEntries(clicksByLinkId),
      clicks_by_link_usage_id: Object.fromEntries(clicksByLinkUsageId),
      clicks_by_source: Object.fromEntries(clicksBySource),
      canonical_attribution_rows: canonicalAttributionRows,
      excluded_rows: excludedRows,
      all_user_link_usages: allUserLinkUsages.results || [],
      all_user_placements: allUserPlacements.results || [],
      all_user_click_events_count: (allUserClickEvents.results || []).length
    };

    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Diagnostics API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
