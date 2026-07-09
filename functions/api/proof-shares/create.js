import { getAuthenticatedUser } from '../auth-helper.js';
import { getProofLimit } from '../entitlement-helper.js';

/**
 * Create a public proof share link for a video's performance card
 * 
 * POST /api/proof-shares/create
 * 
 * Request body:
 * {
 *   link_id: number,
 *   youtube_video_id: string,
 *   title: string
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   public_url: string,
 *   public_token: string
 * }
 */

// Generate a cryptographically secure random token for public sharing
function generateToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  let token = '';
  for (let i = 0; i < 16; i++) {
    token += chars[array[i] % chars.length];
  }
  return token;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Require authenticated user
    const authUser = await getAuthenticatedUser(request, env);
    if (!authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch user with plan info for proof limit check
    const user = await env.DB.prepare(
      'SELECT id, plan, subscription_status, referral_reward_active, referral_reward_expires_at, referral_reward_plan, EXISTS(SELECT 1 FROM founder_access WHERE user_id = users.id) as has_founder_access FROM users WHERE id = ?'
    ).bind(authUser.id).first();

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check proof limit
    const proofLimit = getProofLimit(user);
    
    if (proofLimit !== 'unlimited') {
      // Count active proofs (is_enabled = 1 only)
      const activeProofsResult = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM proof_shares WHERE user_id = ? AND is_enabled = 1'
      ).bind(authUser.id).first();
      
      const activeProofCount = activeProofsResult?.count || 0;
      
      if (activeProofCount >= proofLimit) {
        const effectivePlan = user.has_founder_access ? 'founder' : 
                              user.subscription_status === 'active' ? user.plan : 
                              user.referral_reward_active ? 'referral' : 'free';
        
        return new Response(JSON.stringify({ 
          error: 'Active proof limit reached',
          current_usage: activeProofCount,
          limit: proofLimit,
          plan: effectivePlan,
          message: `You have reached your limit of ${proofLimit} active proofs. Disable older proofs to create new ones, or upgrade to Pro for more.`,
          can_upgrade: effectivePlan === 'free'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const { 
      link_id, 
      youtube_video_id, 
      link_usage_id, 
      title, 
      human_insight, 
      destination_url, 
      top_source_label, 
      additional_source_labels,
      snapshot_clicks, 
      snapshot_ctr, 
      snapshot_views, 
      snapshot_link_count,
      snapshot_video_title, 
      snapshot_thumbnail_url, 
      snapshot_destination_domain,
      snapshot_destination_url, 
      snapshot_top_placement_label, 
      snapshot_converting_placements_json
    } = await request.json();
    const now = new Date().toISOString();

    // Validate required fields
    if (!youtube_video_id && !link_usage_id) {
      return new Response(JSON.stringify({ error: 'youtube_video_id or link_usage_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // If link_usage_id is provided, validate it and read youtube_video_id from link_usages
    let finalYoutubeVideoId = youtube_video_id;
    if (link_usage_id) {
      const linkUsage = await env.DB.prepare(
        'SELECT id, link_id, user_id, youtube_video_id FROM link_usages WHERE id = ? AND is_active = 1'
      ).bind(link_usage_id).first();

      if (!linkUsage) {
        return new Response(JSON.stringify({ error: 'Link usage not found or inactive' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (linkUsage.user_id !== authUser.id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // If link_id is provided, validate it matches the link_usage
      if (link_id && linkUsage.link_id !== Number(link_id)) {
        return new Response(JSON.stringify({ error: 'Link usage does not belong to the specified link' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Use youtube_video_id from link_usage
      finalYoutubeVideoId = linkUsage.youtube_video_id;
    }

    // If link_id is provided, verify ownership and fetch link details
    let linkDetails = null;
    if (link_id) {
      linkDetails = await env.DB.prepare(
        'SELECT id, original_url, slug, title FROM links WHERE id = ? AND user_id = ?'
      ).bind(link_id, authUser.id).first();

      if (!linkDetails) {
        return new Response(JSON.stringify({ error: 'Link not found or unauthorized' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Compute canonical proof metrics from database
    // Override frontend-provided snapshot values with backend-computed values
    let computedClicks = null;
    let computedViews = null;
    let computedCtr = null;
    let computedDestinationUrl = destination_url || linkDetails?.original_url || null;
    let computedVideoTitle = snapshot_video_title || title || null;
    let computedThumbnailUrl = snapshot_thumbnail_url || null;
    let computedConvertingPlacements = [];

    // Compute video-specific clicks for this link
    if (link_usage_id) {
      // Modern path: count clicks from link_usage_id
      const clickCountResult = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM click_events WHERE link_usage_id = ?'
      ).bind(link_usage_id).first();
      computedClicks = clickCountResult?.count || 0;

      // Get traffic source breakdown for this link_usage
      const sourceBreakdown = await env.DB.prepare(
        'SELECT source, COUNT(*) as count FROM click_events WHERE link_usage_id = ? GROUP BY source ORDER BY count DESC'
      ).bind(link_usage_id).all();
      computedConvertingPlacements = (sourceBreakdown.results || []).map(row => ({
        source_code: row.source,
        click_count: row.count
      }));
    } else if (link_id && finalYoutubeVideoId) {
      // Legacy path: count clicks from link_usages for this link + video
      // First find link_usage_ids for this link/video combination
      const usageIdsResult = await env.DB.prepare(
        'SELECT id FROM link_usages WHERE link_id = ? AND youtube_video_id = ? AND is_active = 1'
      ).bind(link_id, finalYoutubeVideoId).all();
      const usageIds = (usageIdsResult.results || []).map(u => u.id);

      if (usageIds.length > 0) {
        const placeholders = usageIds.map(() => '?').join(',');
        const clickCountResult = await env.DB.prepare(
          `SELECT COUNT(*) as count FROM click_events WHERE link_usage_id IN (${placeholders})`
        ).bind(...usageIds).first();
        computedClicks = clickCountResult?.count || 0;

        // Get traffic source breakdown across all usages
        const sourceBreakdown = await env.DB.prepare(
          `SELECT source, COUNT(*) as count FROM click_events WHERE link_usage_id IN (${placeholders}) GROUP BY source ORDER BY count DESC`
        ).bind(...usageIds).all();
        computedConvertingPlacements = (sourceBreakdown.results || []).map(row => ({
          source_code: row.source,
          click_count: row.count
        }));
      } else {
        // No link_usages found for this link/video combination
        // Try placement mode: count clicks by link_id + source from placements
        // This handles base video attachments with placement-based tracking
        const placementsResult = await env.DB.prepare(
          `SELECT p.source_code
           FROM placements p
           WHERE p.link_id = ?
           AND (
             p.youtube_video_id = ?
             OR p.link_usage_id IN (SELECT id FROM link_usages WHERE youtube_video_id = ?)
             OR (
               p.youtube_video_id IS NULL
               AND p.link_usage_id IS NULL
               AND p.link_id IN (SELECT id FROM links WHERE video_id = ?)
             )
           )`
        ).bind(link_id, finalYoutubeVideoId, finalYoutubeVideoId, finalYoutubeVideoId).all();
        
        const sourceCodes = (placementsResult.results || []).map(p => p.source_code);
        
        if (sourceCodes.length > 0) {
          let totalClicks = 0;
          const sourceBreakdown = [];
          
          for (const sourceCode of sourceCodes) {
            const clickResult = await env.DB.prepare(
              'SELECT COUNT(*) as count FROM click_events WHERE link_id = ? AND source = ?'
            ).bind(link_id, sourceCode).first();
            const count = clickResult?.count || 0;
            totalClicks += count;
            if (count > 0) {
              sourceBreakdown.push({
                source_code: sourceCode,
                click_count: count
              });
            }
          }
          
          computedClicks = totalClicks;
          computedConvertingPlacements = sourceBreakdown.sort((a, b) => b.click_count - a.click_count);
        } else {
          // No placements found either, check for legacy base video tracking
          // This handles very old tracking before placements was introduced
          computedClicks = 0;
        }
      }
    }

    // Get video views if available
    if (finalYoutubeVideoId) {
      const videoResult = await env.DB.prepare(
        'SELECT view_count as views, title, thumbnail FROM youtube_metadata_cache WHERE video_id = ? AND expires_at > ?'
      ).bind(finalYoutubeVideoId, new Date().toISOString()).first();
      if (videoResult) {
        computedViews = videoResult.views;
        if (!computedVideoTitle) computedVideoTitle = videoResult.title;
        if (!computedThumbnailUrl) computedThumbnailUrl = videoResult.thumbnail;
      }
    }

    // Compute CTR if we have both clicks and views
    if (computedClicks !== null && computedViews !== null && computedViews > 0) {
      computedCtr = (computedClicks / computedViews) * 100;
    }

    // Use backend-computed values, falling back to frontend values if computation failed
    const finalClicks = computedClicks !== null ? computedClicks : (snapshot_clicks ?? null);
    const finalCtr = computedCtr !== null ? computedCtr : (snapshot_ctr ?? null);
    const finalViews = computedViews !== null ? computedViews : (snapshot_views ?? null);
    const finalVideoTitle = computedVideoTitle || snapshot_video_title || null;
    const finalThumbnailUrl = computedThumbnailUrl || snapshot_thumbnail_url || null;
    const finalDestinationUrl = computedDestinationUrl || snapshot_destination_url || null;
    const finalConvertingPlacementsJson = computedConvertingPlacements.length > 0 
      ? JSON.stringify(computedConvertingPlacements) 
      : snapshot_converting_placements_json;

    // Compute top placement label from converting placements
    let finalTopPlacementLabel = snapshot_top_placement_label;
    if (computedConvertingPlacements.length > 0) {
      // Use the top source from computed breakdown
      const topSource = computedConvertingPlacements[0].source_code;
      finalTopPlacementLabel = topSource;
    }

    // Generate a unique token first (needed for fallback proof_group_key)
    let publicToken;
    let tokenExists = true;
    let attempts = 0;
    const maxAttempts = 5;

    while (tokenExists && attempts < maxAttempts) {
      publicToken = generateToken();
      const existing = await env.DB.prepare(
        'SELECT id FROM proof_shares WHERE public_token = ?'
      ).bind(publicToken).first();
      tokenExists = !!existing;
      attempts++;
    }

    if (tokenExists) {
      return new Response(JSON.stringify({ error: 'Failed to generate unique token' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Compute deterministic proof_group_key
    let proofGroupKey;
    if (link_id && finalYoutubeVideoId) {
      // Prefer: user_id + youtube_video_id + link_id
      proofGroupKey = `${authUser.id}::${finalYoutubeVideoId}::link:${link_id}`;
    } else if (finalYoutubeVideoId && snapshot_destination_domain) {
      // If link_id missing: user_id + youtube_video_id + normalized destination domain
      const normalizedDomain = snapshot_destination_domain.toLowerCase().replace(/^www\./, '');
      proofGroupKey = `${authUser.id}::${finalYoutubeVideoId}::domain:${normalizedDomain}`;
    } else if (finalYoutubeVideoId) {
      // Fallback: user_id + youtube_video_id
      proofGroupKey = `${authUser.id}::${finalYoutubeVideoId}`;
    } else {
      // Edge case: unique per-proof key using public_token to prevent unrelated grouping
      proofGroupKey = `${authUser.id}::token:${publicToken}`;
    }

    // Insert proof share record with Phase 1 snapshot fields
    const result = await env.DB.prepare(
      `INSERT INTO proof_shares (
         public_token, user_id, link_id, youtube_video_id, link_usage_id, title,
         human_insight, destination_url, top_source_label, additional_source_labels,
         snapshot_clicks, snapshot_ctr, snapshot_views, snapshot_link_count,
         snapshot_video_title, snapshot_thumbnail_url, snapshot_destination_domain,
         snapshot_destination_url, snapshot_top_placement_label, snapshot_generated_at,
         snapshot_converting_placements_json,
         proof_group_key,
         is_enabled, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      publicToken,
      authUser.id,
      link_id || null,
      finalYoutubeVideoId,
      link_usage_id || null,
      title || null,
      human_insight || null,
      finalDestinationUrl || null,
      finalTopPlacementLabel || null,
      additional_source_labels || null,
      // Phase 1: Snapshot values (nullable for backward compatibility)
      // Use backend-computed values, falling back to frontend values
      finalClicks,
      finalCtr,
      finalViews,
      snapshot_link_count ?? null,
      finalVideoTitle,
      finalThumbnailUrl,
      snapshot_destination_domain || null,
      finalDestinationUrl,
      finalTopPlacementLabel,
      now, // snapshot_generated_at
      finalConvertingPlacementsJson,
      proofGroupKey,
      1, // is_enabled
      now
    ).run();

    // Construct public URL
    const publicUrl = `${new URL(request.url).origin}/proof/${publicToken}`;

    return new Response(JSON.stringify({
      success: true,
      public_url: publicUrl,
      public_token: publicToken
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating proof share:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
