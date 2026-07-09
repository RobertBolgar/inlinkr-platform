import { checkRateLimit, getUserRateLimitKey, getIpRateLimitKey, RATE_LIMITS, createRateLimitResponse } from './rate-limit-helper.js';
import { getAuthenticatedUser } from './auth-helper.js';
import { hasEffectiveProAccess } from './entitlement-helper.js';
import { getLinkUsageClickCounts, getVideoClickCount, getVideoPlacementBreakdown } from './analytics-helper.js';

// Generate a unique 6-character alphanumeric public_code
function generatePublicCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Generate a unique public_code with collision detection
async function generateUniquePublicCode(env) {
  let publicCode = null;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    publicCode = generatePublicCode();
    const existing = await env.DB.prepare(
      'SELECT id FROM links WHERE public_code = ?'
    ).bind(publicCode).first();

    if (!existing) break;
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique public code');
  }

  return publicCode;
}

export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method === 'GET') {
    const startTime = performance.now();
    const timingHeaders = {};
    try {
      // Require authenticated user
      const authUser = await getAuthenticatedUser(request, env);
      if (!authUser) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const userId = authUser.id;
      timingHeaders['X-Auth-Time'] = `${(performance.now() - startTime).toFixed(2)}ms`;
      console.log(`[PERF] Auth check: ${(performance.now() - startTime).toFixed(2)}ms`);

      // Check if request includes inactive links
      const url = new URL(request.url);
      const includeInactive = url.searchParams.get('include_inactive') === 'true';

      // Build query condition based on include_inactive parameter
      const whereClause = includeInactive 
        ? 'WHERE user_id = ?' 
        : 'WHERE user_id = ? AND is_active = 1';

      const dbLinksStart = performance.now();
      const { results } = await env.DB.prepare(
        `SELECT id, user_id, slug, original_url, title, subtitle, created_at, updated_at, is_active, placement_count, video_id, public_code
         FROM links ${whereClause} ORDER BY created_at DESC`
      ).bind(userId).all();
      timingHeaders['X-Links-Query-Time'] = `${(performance.now() - dbLinksStart).toFixed(2)}ms`;
      console.log(`[PERF] Links DB query: ${(performance.now() - dbLinksStart).toFixed(2)}ms`);

      // Get click counts for each link
      const linkIds = results.map(l => l.id);
      let linkClicks = {};

      if (linkIds.length > 0) {
        const dbClicksStart = performance.now();
        const placeholders = linkIds.map(() => '?').join(',');
        const clickResults = await env.DB.prepare(
          `SELECT link_id, COUNT(*) as click_count FROM click_events WHERE link_id IN (${placeholders}) GROUP BY link_id`
        ).bind(...linkIds).all();
        timingHeaders['X-Clicks-Query-Time'] = `${(performance.now() - dbClicksStart).toFixed(2)}ms`;
        console.log(`[PERF] Click counts DB query: ${(performance.now() - dbClicksStart).toFixed(2)}ms`);

        linkClicks = Object.fromEntries(
          clickResults.results.map(r => [r.link_id, r.click_count])
        );
      }

      // Attach click counts to links
      const linksWithClicks = results.map(link => ({
        ...link,
        clicks: linkClicks[link.id] || 0
      }));

      // Fetch link_usages for all user links in a single query (avoid N+1)
      // Only include usages that have active placements (to avoid showing stale historical data)
      const dbUsagesStart = performance.now();
      let linkUsagesMap = new Map();
      if (linkIds.length > 0) {
        const placeholders = linkIds.map(() => '?').join(',');
        const usagesResults = await env.DB.prepare(
          `SELECT lu.id, lu.link_id, lu.user_id, lu.youtube_video_id, lu.placement_type, lu.placement_name, 
                  lu.public_code, lu.source_code, lu.destination_url_snapshot, lu.title_snapshot, 
                  lu.is_active, lu.created_at, lu.updated_at
           FROM link_usages lu
           WHERE lu.link_id IN (${placeholders})
           AND EXISTS (
             SELECT 1 FROM placements p 
             WHERE p.link_usage_id = lu.id
           )`
        ).bind(...linkIds).all();
        timingHeaders['X-Usages-Query-Time'] = `${(performance.now() - dbUsagesStart).toFixed(2)}ms`;
        console.log(`[PERF] Link usages DB query: ${(performance.now() - dbUsagesStart).toFixed(2)}ms`);

        // Group usages by link_id
        usagesResults.results?.forEach(usage => {
          if (!linkUsagesMap.has(usage.link_id)) {
            linkUsagesMap.set(usage.link_id, []);
          }
          linkUsagesMap.get(usage.link_id).push(usage);
        });
      }

      // Fetch ALL link_usages (including historical) for videoStats generation
      // This ensures Analytics shows all tracked videos even if placements were deleted
      const dbHistoricalUsagesStart = performance.now();
      let historicalUsagesMap = new Map();
      if (linkIds.length > 0) {
        const placeholders = linkIds.map(() => '?').join(',');
        const historicalUsagesResults = await env.DB.prepare(
          `SELECT id, link_id, youtube_video_id, is_active
           FROM link_usages
           WHERE link_id IN (${placeholders})`
        ).bind(...linkIds).all();
        timingHeaders['X-Historical-Usages-Query-Time'] = `${(performance.now() - dbHistoricalUsagesStart).toFixed(2)}ms`;
        console.log(`[PERF] Historical link usages DB query: ${(performance.now() - dbHistoricalUsagesStart).toFixed(2)}ms`);

        // Group historical usages by link_id
        historicalUsagesResults.results?.forEach(usage => {
          if (!historicalUsagesMap.has(usage.link_id)) {
            historicalUsagesMap.set(usage.link_id, []);
          }
          historicalUsagesMap.get(usage.link_id).push(usage);
        });
      }

      // Batch fetch all placements for all links to avoid N+1 queries
      const videoIdsForPlacements = new Set();
      linksWithClicks.forEach(link => {
        if (link.video_id) {
          videoIdsForPlacements.add(link.video_id);
        }
      });

      const dbPlacementsStart = performance.now();
      let allPlacements = [];
      if (linkIds.length > 0 && videoIdsForPlacements.size > 0) {
        const linkPlaceholders = linkIds.map(() => '?').join(',');
        const videoPlaceholders = Array.from(videoIdsForPlacements).map(() => '?').join(',');
        
        const placementsResult = await env.DB.prepare(
          `SELECT p.link_id, p.name, p.type, p.source_code, p.youtube_video_id, p.link_usage_id
           FROM placements p
           WHERE p.link_id IN (${linkPlaceholders})
           AND (
             p.youtube_video_id IN (${videoPlaceholders})
             OR p.link_usage_id IN (SELECT id FROM link_usages WHERE youtube_video_id IN (${videoPlaceholders}))
             OR (
               p.youtube_video_id IS NULL
               AND p.link_usage_id IS NULL
               AND p.link_id IN (SELECT id FROM links WHERE video_id IN (${videoPlaceholders}))
             )
           )`
        ).bind(...linkIds, ...Array.from(videoIdsForPlacements), ...Array.from(videoIdsForPlacements), ...Array.from(videoIdsForPlacements)).all();
        
        allPlacements = placementsResult.results || [];
      }
      timingHeaders['X-Placements-Query-Time'] = `${(performance.now() - dbPlacementsStart).toFixed(2)}ms`;
      console.log(`[PERF] Placements DB query: ${(performance.now() - dbPlacementsStart).toFixed(2)}ms`);

      // Group placements by link_id and video_id for efficient lookup
      const placementsByLinkAndVideo = new Map();
      allPlacements.forEach(p => {
        const key = `${p.link_id}_${p.youtube_video_id || 'null'}`;
        if (!placementsByLinkAndVideo.has(key)) {
          placementsByLinkAndVideo.set(key, []);
        }
        placementsByLinkAndVideo.get(key).push({
          name: p.name,
          type: p.type,
          source_code: p.source_code
        });
      });

      // Attach link_usages to each link with per-usage click counts and proof eligibility
      const usageClicksStart = performance.now();
      const linksWithUsages = await Promise.all(
        linksWithClicks.map(async (link) => {
          const usages = linkUsagesMap.get(link.id) || [];
          
          // Get click counts for this link's usages
          const usageClickCounts = await getLinkUsageClickCounts(link.id, env);
          
          // Attach clicks and proof eligibility to each usage
          const usagesWithClicks = usages.map(usage => {
            // Usage rows have modern tracking if they have source_code
            const hasModernTracking = usage.source_code !== null && usage.source_code !== undefined;
            return {
              ...usage,
              clicks: usageClickCounts[usage.id] || 0,
              proof_available: hasModernTracking,
              proof_context_type: hasModernTracking ? 'usage' : 'legacy'
            };
          });
          
          // Fetch placement data for base video attachment from batched results
          let baseVideoPlacements = [];
          let baseVideoProofAvailable = false;
          let baseVideoProofContextType = 'legacy';
          
          if (link.video_id) {
            const key = `${link.id}_${link.video_id}`;
            baseVideoPlacements = placementsByLinkAndVideo.get(key) || [];
            
            // Base video has modern tracking if it has placements with source_code
            const hasPlacements = baseVideoPlacements.length > 0;
            const hasSourceCodes = baseVideoPlacements.some(p => p.source_code);
            baseVideoProofAvailable = hasSourceCodes;
            baseVideoProofContextType = hasSourceCodes ? 'placement' : 'legacy';
          }
          
          return {
            ...link,
            link_usages: usagesWithClicks,
            base_video_placements: baseVideoPlacements,
            base_video_proof_available: baseVideoProofAvailable,
            base_video_proof_context_type: baseVideoProofContextType
          };
        })
      );
      timingHeaders['X-Usage-Clicks-Time'] = `${(performance.now() - usageClicksStart).toFixed(2)}ms`;
      console.log(`[PERF] Usage click counts (getLinkUsageClickCounts): ${(performance.now() - usageClicksStart).toFixed(2)}ms`);

      // Aggregate video stats using standardized click counting
      const videoStatsMap = new Map();

      // Collect all unique video_ids from historical link_usages and links
      // This ensures Analytics shows all tracked videos even if placements were deleted
      const videoIds = new Set();
      for (const link of linksWithUsages) {
        // Add all historical usage video_ids (including those without active placements)
        const historicalUsages = historicalUsagesMap.get(link.id) || [];
        historicalUsages.forEach(usage => {
          if (usage.youtube_video_id) {
            videoIds.add(usage.youtube_video_id);
          }
        });
      }

      // Fetch excluded video IDs for this user
      const excludedVideoIds = new Set();
      try {
        const exclusionsResult = await env.DB.prepare(
          'SELECT youtube_video_id FROM analytics_video_exclusions WHERE user_id = ?'
        ).bind(userId).all();
        (exclusionsResult.results || []).forEach(row => {
          excludedVideoIds.add(row.youtube_video_id);
        });
      } catch (error) {
        // If the exclusions table doesn't exist (migration not applied), log warning and continue
        console.warn('[WARN] analytics_video_exclusions table not found, skipping exclusions filter:', error);
      }

      // Filter out excluded videos
      const filteredVideoIds = Array.from(videoIds).filter(id => !excludedVideoIds.has(id));

      // Use standardized click counting for each video (batched for performance)
      const videoStatsStart = performance.now();
      const videoStatsPromises = filteredVideoIds.map(async (videoId) => {
        const [clickResult, placementBreakdownResult] = await Promise.all([
          getVideoClickCount(userId, videoId, env),
          getVideoPlacementBreakdown(userId, videoId, env)
        ]);

        // Count link_count for this video using historical usages
        let linkCount = 0;
        for (const link of linksWithUsages) {
          const historicalUsages = historicalUsagesMap.get(link.id) || [];
          if (historicalUsages.some(usage => usage.youtube_video_id === videoId)) {
            linkCount += 1;
          } else if (link.video_id === videoId) {
            linkCount += 1;
          }
        }

        return {
          video_id: videoId,
          total_clicks: clickResult.count,
          link_count: linkCount,
          placement_breakdown: placementBreakdownResult.breakdown,
          attribution_mode: placementBreakdownResult.attributionMode
        };
      });

      const videoStatsResults = await Promise.all(videoStatsPromises);
      videoStatsResults.forEach(stat => {
        videoStatsMap.set(stat.video_id, stat);
      });
      timingHeaders['X-Video-Stats-Time'] = `${(performance.now() - videoStatsStart).toFixed(2)}ms`;
      console.log(`[PERF] Video stats aggregation (batched getVideoClickCount + getVideoPlacementBreakdown): ${(performance.now() - videoStatsStart).toFixed(2)}ms`);

      const videoStats = Array.from(videoStatsMap.values());

      // Collect all unique youtube_video_ids from link_usages for YouTube metadata fetch
      const usageVideoIds = new Set();
      linksWithUsages.forEach(link => {
        if (link.link_usages && link.link_usages.length > 0) {
          link.link_usages.forEach(usage => {
            if (usage.youtube_video_id) {
              usageVideoIds.add(usage.youtube_video_id);
            }
          });
        }
      });

      // Fetch YouTube video stats if there are videos (either from links.video_id or link_usages)
      const allVideoIds = new Set([
        ...videoStats.map(v => v.video_id),
        ...usageVideoIds
      ]);

      if (allVideoIds.size > 0) {
        const youtubeStart = performance.now();
        try {
          const connection = await env.DB.prepare(
            'SELECT access_token, refresh_token FROM youtube_connections WHERE user_id = ? AND is_active = 1'
          ).bind(userId).first();

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
              ).bind(newAccessToken, tokenExpiresAt, userId).run();

              return newAccessToken;
            };

            const videoIds = Array.from(allVideoIds);
            const now = new Date();
            
            // Check cache for all videos in a single batch query
            const cacheCheckStart = performance.now();
            const uncachedVideoIds = [];
            const cachedMetadata = new Map();

            if (videoIds.length > 0) {
              const placeholders = videoIds.map(() => '?').join(',');
              const cacheResults = await env.DB.prepare(
                `SELECT video_id, title, thumbnail, view_count FROM youtube_metadata_cache WHERE video_id IN (${placeholders}) AND expires_at > ?`
              ).bind(...videoIds, now.toISOString()).all();

              const cachedIds = new Set();
              (cacheResults.results || []).forEach(row => {
                cachedMetadata.set(row.video_id, {
                  title: row.title,
                  thumbnail: row.thumbnail,
                  view_count: row.view_count
                });
                cachedIds.add(row.video_id);
              });

              uncachedVideoIds.push(...videoIds.filter(id => !cachedIds.has(id)));
            }
            timingHeaders['X-YouTube-Cache-Check-Time'] = `${(performance.now() - cacheCheckStart).toFixed(2)}ms`;
            timingHeaders['X-YouTube-Cache-Hits'] = `${cachedMetadata.size}`;
            timingHeaders['X-YouTube-Cache-Misses'] = `${uncachedVideoIds.length}`;
            console.log(`[PERF] YouTube cache check (batched): ${(performance.now() - cacheCheckStart).toFixed(2)}ms, cached: ${cachedMetadata.size}, uncached: ${uncachedVideoIds.length}`);

            // Fetch uncached videos from YouTube API
            const youtubeApiStart = performance.now();
            let fetchedMetadata = new Map();
            if (uncachedVideoIds.length > 0) {
              let videosResponse = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${uncachedVideoIds.join(',')}`,
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
                    `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${uncachedVideoIds.join(',')}`,
                    {
                      headers: {
                        'Authorization': `Bearer ${accessToken}`,
                      },
                    }
                  );
                } catch (refreshError) {
                  console.error('Token refresh error:', refreshError);
                  // Continue without video stats if refresh fails
                }
              }

              if (videosResponse.ok) {
                const videosData = await videosResponse.json();
                const cacheExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour TTL
                
                (videosData.items || []).forEach(item => {
                  const viewCount = parseInt(item.statistics?.viewCount || '0', 10);
                  const title = item.snippet?.title || '';
                  const thumbnail = item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || null;
                  
                  fetchedMetadata.set(item.id, {
                    title,
                    thumbnail,
                    view_count: viewCount
                  });
                  
                  // Store in cache
                  env.DB.prepare(
                    'INSERT OR REPLACE INTO youtube_metadata_cache (video_id, title, thumbnail, view_count, cached_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
                  ).bind(item.id, title, thumbnail, viewCount, now.toISOString(), cacheExpiry).run();
                });
              }
            }
            timingHeaders['X-YouTube-API-Fetch-Time'] = `${(performance.now() - youtubeApiStart).toFixed(2)}ms`;
            console.log(`[PERF] YouTube API fetch: ${(performance.now() - youtubeApiStart).toFixed(2)}ms`);

            // Merge cached and fetched metadata
            const videoViewsMap = new Map();
            const videoTitleMap = new Map();
            const videoThumbnailMap = new Map();
            
            videoIds.forEach(videoId => {
              const meta = cachedMetadata.get(videoId) || fetchedMetadata.get(videoId);
              if (meta) {
                videoViewsMap.set(videoId, meta.view_count);
                videoTitleMap.set(videoId, meta.title);
                videoThumbnailMap.set(videoId, meta.thumbnail);
              }
            });

            // Add views, title, conversion rate, and thumbnail to videoStats
            videoStats.forEach(stat => {
              const views = videoViewsMap.get(stat.video_id) || 0;
              stat.views = views;
              stat.title = videoTitleMap.get(stat.video_id) || null;
              stat.conversion_rate = views > 0 ? (stat.total_clicks / views) * 100 : null;
              stat.thumbnail = videoThumbnailMap.get(stat.video_id) || null;
            });

            // Add YouTube metadata to link_usages entries and base link objects
            linksWithUsages.forEach(link => {
              // Add metadata to base link if it has a video_id
              if (link.video_id) {
                link.video_title = videoTitleMap.get(link.video_id) || null;
                link.video_thumbnail = videoThumbnailMap.get(link.video_id) || null;
              }

              // Add metadata to link_usages entries
              if (link.link_usages && link.link_usages.length > 0) {
                link.link_usages.forEach(usage => {
                  if (usage.youtube_video_id) {
                    const views = videoViewsMap.get(usage.youtube_video_id) || 0;
                    usage.views = views;
                    usage.title = videoTitleMap.get(usage.youtube_video_id) || usage.title_snapshot || null;
                    usage.conversion_rate = views > 0 ? (usage.clicks / views) * 100 : null;
                    usage.thumbnail = videoThumbnailMap.get(usage.youtube_video_id) || null;
                  }
                });
              }
            });
          }
        } catch (error) {
          console.error('Error fetching YouTube video stats:', error);
          // Continue without video stats if fetch fails
          videoStats.forEach(stat => {
            stat.views = null;
            stat.title = null;
            stat.conversion_rate = null;
            stat.thumbnail = null;
          });
        }
        timingHeaders['X-YouTube-Total-Time'] = `${(performance.now() - youtubeStart).toFixed(2)}ms`;
        console.log(`[PERF] Total YouTube metadata time: ${(performance.now() - youtubeStart).toFixed(2)}ms`);
      } else {
        // Add null values if no videos
        videoStats.forEach(stat => {
          stat.views = null;
          stat.title = null;
          stat.conversion_rate = null;
          stat.thumbnail = null;
        });
      }

      timingHeaders['X-Total-Time'] = `${(performance.now() - startTime).toFixed(2)}ms`;
      console.log(`[PERF] TOTAL /api/links time: ${(performance.now() - startTime).toFixed(2)}ms`);
      return new Response(JSON.stringify({
        links: linksWithUsages,
        videoStats
      }), {
        headers: { 
          'Content-Type': 'application/json',
          ...timingHeaders
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  if (request.method === 'POST') {
    try {
      // Require authenticated user
      const authUser = await getAuthenticatedUser(request, env);
      if (!authUser) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Check rate limit for create link (20 per hour per user)
      const rateLimitKey = getUserRateLimitKey(authUser.id);
      const rateLimitResult = await checkRateLimit(env, rateLimitKey, RATE_LIMITS.CREATE_LINK);

      if (!rateLimitResult.success) {
        return createRateLimitResponse('Too many link creations. Please try again later.');
      }

      const { slug, original_url, title, subtitle, video_id } = await request.json();
      const now = new Date().toISOString();

      // Check if user has Pro-level access for slug handling
      const userHasEffectiveProAccess = hasEffectiveProAccess(authUser);

      // Generate unique public_code for the link
      const publicCode = await generateUniquePublicCode(env);

      // Determine final slug based on plan
      let finalSlug = slug;
      if (!userHasEffectiveProAccess) {
        // Free users: use internal slug based on public_code (guaranteed unique)
        // This satisfies the NOT NULL constraint and UNIQUE(user_id, slug) without user friction
        finalSlug = `link-${publicCode}`;
      } else {
        // Pro/Founder users: use their chosen slug for branded URLs
        // Slug uniqueness will be enforced by the database constraint
        if (!finalSlug) {
          return new Response(JSON.stringify({
            error: 'Slug is required for Pro/Founder users'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      // Validate URL - only allow http:// and https://
      if (!original_url) {
        return new Response(JSON.stringify({
          error: 'URL is required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const normalizedUrl = original_url.toLowerCase().trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        return new Response(JSON.stringify({
          error: 'Invalid URL. Only http:// and https:// URLs are allowed.'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Check link limit for Free users (exclude system links)
      // Use effective access logic: only cap users who don't have Pro access (including Founder)
      // userHasEffectiveProAccess is already computed above

      if (!userHasEffectiveProAccess) {
        const existingLinksCount = await env.DB.prepare(
          'SELECT COUNT(*) as count FROM links WHERE user_id = ? AND is_system = 0 AND is_active = 1 AND slug NOT IN (?, ?)'
        ).bind(authUser.id, 'invite', 'my-invite').first();

        if (existingLinksCount.count >= 5) {
          return new Response(JSON.stringify({
            error: 'Ready for more? Upgrade to Pro for unlimited links.'
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      const result = await env.DB.prepare(
        `INSERT INTO links (user_id, slug, original_url, title, subtitle, video_id, public_code, created_at, updated_at, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(authUser.id, finalSlug, original_url, title || null, subtitle || null, video_id || null, publicCode, now, now, 1).run();

      return new Response(JSON.stringify({
        success: true,
        data: { id: result.meta.last_row_id, user_id: authUser.id, slug: finalSlug, original_url, title, video_id, public_code: publicCode, is_active: 1, placement_count: 0 }
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error creating link:', error);

      // Check for unique constraint violation (duplicate slug)
      // Only return slug-specific error for Pro/Founder users who control their slug
      if (error.message && error.message.includes('UNIQUE constraint failed: links.user_id, links.slug')) {
        if (userHasEffectiveProAccess) {
          return new Response(JSON.stringify({
            error: 'This link slug is already in use. Please choose a different slug.'
          }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          });
        } else {
          // Free users should not see slug errors since we auto-generate internal slugs
          // This is a fallback error if something unexpected happens
          return new Response(JSON.stringify({
            error: 'Failed to create link. Please try again.'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  if (request.method === 'PUT') {
    try {
      // Get authenticated user
      const authUser = await getAuthenticatedUser(request, env);
      if (!authUser) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      const url = new URL(request.url);
      const id = url.pathname.split('/').pop();
      const { original_url, title, subtitle, slug, is_active, video_id } = await request.json();
      const now = new Date().toISOString();
      
      // Validate URL if being updated - only allow http:// and https://
      if (original_url !== undefined && original_url !== null) {
        const normalizedUrl = original_url.toLowerCase().trim();
        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
          return new Response(JSON.stringify({ 
            error: 'Invalid URL. Only http:// and https:// URLs are allowed.' 
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      
      // Build dynamic update query
      const updates = [];
      const params = [];

      if (original_url !== undefined) {
        updates.push('original_url = ?');
        params.push(original_url);
      }
      if (title !== undefined) {
        updates.push('title = ?');
        params.push(title || null);
      }
      if (subtitle !== undefined) {
        updates.push('subtitle = ?');
        params.push(subtitle || null);
      }
      if (slug !== undefined) {
        updates.push('slug = ?');
        params.push(slug);
      }
      if (is_active !== undefined) {
        updates.push('is_active = ?');
        params.push(is_active);
      }
      if (video_id !== undefined) {
        updates.push('video_id = ?');
        params.push(video_id || null);
      }

      updates.push('updated_at = ?');
      params.push(now);

      if (updates.length === 1) {
        return new Response(JSON.stringify({ error: 'No fields to update' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      params.push(id);
      params.push(authUser.id);

      // Check if link is a system link before updating
      const link = await env.DB.prepare(
        'SELECT id, is_system FROM links WHERE id = ? AND user_id = ?'
      ).bind(id, authUser.id).first();

      if (!link) {
        return new Response(JSON.stringify({ error: 'Link not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Allow clearing video fields on system links, but block other edits
      if (link.is_system === 1 || link.is_system === true) {
        // Check if only video fields are being updated
        const isOnlyVideoUpdate = updates.every(update =>
          update === 'video_id = ?' ||
          update === 'updated_at = ?'
        );

        if (!isOnlyVideoUpdate) {
          return new Response(JSON.stringify({
            error: 'Referral links cannot be edited or deleted.'
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      const result = await env.DB.prepare(
        `UPDATE links SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
      ).bind(...params).run();
      
      if (result.meta.changes === 0) {
        return new Response(JSON.stringify({ error: 'Link not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Link updated successfully'
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error updating link:', error);
      console.error('Link ID:', id, 'User ID:', authUser?.id);
      return new Response(JSON.stringify({ error: 'Failed to update link' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  return new Response('Method not allowed', { status: 405 });
}
