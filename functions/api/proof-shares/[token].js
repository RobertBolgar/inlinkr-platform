/**
 * Get public proof data by token
 * 
 * GET /api/proof-shares/{token}
 * 
 * Returns safe public proof data only:
 * - video title
 * - thumbnail
 * - clicks
 * - ctr
 * - views
 * - measured placements
 * - destination domain/name
 * - creator username
 * - created_at
 * 
 * Does NOT expose:
 * - email
 * - internal IDs
 * - Stripe info
 * - referral info
 * - private analytics
 */

import { getVideoClickCount, getVideoPlacementBreakdown } from '../analytics-helper.js';

export async function onRequest(context) {
  const { request, env, params } = context;

  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { token } = params;

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Look up proof share by token with Phase 2 snapshot fields
    const proofShare = await env.DB.prepare(
      `SELECT id, user_id, link_id, youtube_video_id, link_usage_id, title, human_insight, destination_url, top_source_label, additional_source_labels, is_enabled, created_at,
         snapshot_clicks, snapshot_ctr, snapshot_views, snapshot_link_count,
         snapshot_video_title, snapshot_thumbnail_url, snapshot_destination_domain, snapshot_destination_url,
         snapshot_top_placement_label, snapshot_generated_at, snapshot_converting_placements_json
       FROM proof_shares
       WHERE public_token = ?`
    ).bind(token).first();

    if (!proofShare) {
      return new Response(JSON.stringify({ error: 'Proof not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if proof is disabled
    if (proofShare.is_enabled === 0) {
      return new Response(JSON.stringify({ error: 'Proof is no longer available' }), {
        status: 410,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Phase 1: Record proof view event (non-blocking)
    // This tracks aggregate proof engagement without exposing viewer identity
    const recordViewEvent = async () => {
      try {
        // Get request metadata for privacy-safe tracking
        const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || null;
        const referrer = request.headers.get('Referer') || null;
        const userAgent = request.headers.get('User-Agent') || null;
        
        // Hash IP address for privacy (SHA-256)
        let ipHash = null;
        if (ip) {
          const encoder = new TextEncoder();
          const data = encoder.encode(ip);
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          ipHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        // Insert view event
        await env.DB.prepare(
          `INSERT INTO proof_share_events (proof_share_id, event_type, created_at, referrer, user_agent, ip_hash)
           VALUES (?, 'view', ?, ?, ?, ?)`
        ).bind(
          proofShare.id,
          new Date().toISOString(),
          referrer,
          userAgent,
          ipHash
        ).run();
      } catch (error) {
        // Silently fail - do not block proof rendering if event tracking fails
        console.error('Failed to record proof view event:', error);
      }
    };

    // Fire event tracking asynchronously (non-blocking)
    recordViewEvent();

    // Phase 2: Determine proof mode - snapshot if snapshot_clicks exists, otherwise live
    const proofMode = proofShare.snapshot_clicks !== null ? 'snapshot' : 'live';

    // Get user info for creator username
    const user = await env.DB.prepare(
      'SELECT username, display_name FROM users WHERE id = ?'
    ).bind(proofShare.user_id).first();

    // Initialize variables with snapshot values if available
    let totalClicks = proofShare.snapshot_clicks !== null ? proofShare.snapshot_clicks : 0;
    let ctr = proofShare.snapshot_ctr !== null ? proofShare.snapshot_ctr : null;
    let views = proofShare.snapshot_views !== null ? proofShare.snapshot_views : null;
    let linkCount = proofShare.snapshot_link_count !== null ? proofShare.snapshot_link_count : 0;
    let convertingPlacements = [];
    let thumbnail = proofShare.snapshot_thumbnail_url !== null ? proofShare.snapshot_thumbnail_url : null;
    let destinationUrl = proofShare.snapshot_destination_url !== null ? proofShare.snapshot_destination_url : null;
    let destinationDomain = proofShare.snapshot_destination_domain !== null ? proofShare.snapshot_destination_domain : null;

    // Parse snapshot converting placements if available
    if (proofShare.snapshot_converting_placements_json) {
      try {
        convertingPlacements = JSON.parse(proofShare.snapshot_converting_placements_json);
      } catch (error) {
        console.error('Error parsing snapshot converting placements:', error);
        convertingPlacements = [];
      }
    }

    // If snapshot mode, use only snapshot data - no live calculations
    if (proofMode === 'snapshot') {
      // All data is already initialized from snapshot fields above
      // If snapshot_converting_placements_json is missing, convertingPlacements will be empty array
      // This is the correct fallback state for snapshot mode
    } else if (proofMode === 'live') {
      // Get link info for destination
      if (!destinationUrl && proofShare.destination_url) {
        destinationUrl = proofShare.destination_url;
        try {
          const urlObj = new URL(proofShare.destination_url);
          destinationDomain = urlObj.hostname;
        } catch {
          destinationDomain = proofShare.destination_url;
        }
      } else if (!destinationUrl && proofShare.link_id) {
        // Fall back to deriving from link_id if stored value not available
        const link = await env.DB.prepare(
          'SELECT original_url FROM links WHERE id = ?'
        ).bind(proofShare.link_id).first();
        if (link && link.original_url) {
          destinationUrl = link.original_url;
          try {
            const urlObj = new URL(link.original_url);
            destinationDomain = urlObj.hostname;
          } catch {
            destinationDomain = link.original_url;
          }
        }
      }

      // Get click stats for this video using standardized logic
      const clickResult = await getVideoClickCount(proofShare.user_id, proofShare.youtube_video_id, env);
      totalClicks = clickResult.count;
      
      // Get placement breakdown using standardized logic
      const placementResult = await getVideoPlacementBreakdown(proofShare.user_id, proofShare.youtube_video_id, env);
      convertingPlacements = placementResult.breakdown.map(p => ({
        source_code: p.source || 'direct',
        click_count: p.count
      }));

      // Count link_count for this video
      const linkUsages = await env.DB.prepare(
        `SELECT COUNT(DISTINCT link_id) as count FROM link_usages 
         WHERE user_id = ? AND youtube_video_id = ? AND is_active = 1`
      ).bind(proofShare.user_id, proofShare.youtube_video_id).first();
      
      if (linkUsages && linkUsages.count > 0) {
        linkCount = linkUsages.count;
      } else {
        // Fall back to counting links by video_id
        const videoLinks = await env.DB.prepare(
          'SELECT COUNT(*) as count FROM links WHERE user_id = ? AND video_id = ? AND is_active = 1'
        ).bind(proofShare.user_id, proofShare.youtube_video_id).first();
        linkCount = videoLinks?.count || 0;
      }

      // Get YouTube video stats (thumbnail, views) for live mode
      try {
        const connection = await env.DB.prepare(
          'SELECT access_token, refresh_token FROM youtube_connections WHERE user_id = ? AND is_active = 1'
        ).bind(proofShare.user_id).first();

        if (connection) {
          let accessToken = connection.access_token;
          const refreshToken = connection.refresh_token;

          // Helper function to refresh access token
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
            ).bind(newAccessToken, tokenExpiresAt, proofShare.user_id).run();

            return newAccessToken;
          };

          let videosResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${proofShare.youtube_video_id}`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            }
          );

          // If token expired, refresh and retry
          if (videosResponse.status === 401) {
            try {
              accessToken = await refreshAccessToken();
              videosResponse = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${proofShare.youtube_video_id}`,
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
              views = parseInt(item.statistics?.viewCount || '0', 10);
              thumbnail = item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || null;
            }
          }
        }
      } catch (error) {
        console.error('Error fetching YouTube video stats:', error);
      }

      // Calculate CTR for live mode
      if (views !== null && views > 0) {
        ctr = (totalClicks / views) * 100;
      }
    }

    // Update last_viewed_at
    const now = new Date().toISOString();
    await env.DB.prepare(
      'UPDATE proof_shares SET last_viewed_at = ? WHERE public_token = ?'
    ).bind(now, token).run();

    // Return safe public data with Phase 2 proof mode
    return new Response(JSON.stringify({
      success: true,
      proof: {
        title: proofShare.snapshot_video_title || proofShare.title || null,
        thumbnail: thumbnail,
        youtube_video_id: proofShare.youtube_video_id,
        clicks: totalClicks,
        ctr: ctr !== null ? parseFloat(ctr.toFixed(2)) : null,
        views: views,
        link_count: linkCount,
        destination_domain: destinationDomain,
        destination_url: destinationUrl,
        human_insight: proofShare.human_insight || null,
        top_source_label: proofShare.snapshot_top_placement_label || proofShare.top_source_label || null,
        additional_source_labels: proofShare.additional_source_labels ? JSON.parse(proofShare.additional_source_labels) : [],
        converting_placements: convertingPlacements,
        creator_username: user?.username || null,
        creator_display_name: user?.display_name || null,
        created_at: proofShare.created_at,
        last_viewed_at: now,
        // Phase 2: Add proof mode and snapshot metadata
        proof_mode: proofMode,
        snapshot_generated_at: proofShare.snapshot_generated_at || null
      }
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching proof share:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
