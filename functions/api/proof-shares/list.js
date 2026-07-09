import { getAuthenticatedUser } from '../auth-helper.js';

/**
 * Get all proof shares for the authenticated user
 * 
 * GET /api/proof-shares/list
 * 
 * Returns:
 * {
 *   success: true,
 *   proofs: [
 *     {
 *       public_token: string,
 *       proof_mode: "snapshot" | "live",
 *       title: string,
 *       thumbnail: string,
 *       destination_domain: string,
 *       clicks: number,
 *       generated_at: string,
 *       snapshot_generated_at: string | null,
 *       created_at: string,
 *       is_enabled: number,
 *       view_count: number,
 *       last_viewed_at: string | null,
 *       youtube_video_id: string | null
 *     }
 *   ]
 * }
 */

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'GET') {
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

    // Parse query params
    const url = new URL(request.url);
    const includeDisabled = url.searchParams.get('include_disabled') === 'true';

    // Build query based on include_disabled param
    let query = `
      SELECT
         ps.id,
         ps.public_token,
         ps.youtube_video_id,
         ps.title,
         ps.snapshot_video_title,
         ps.snapshot_thumbnail_url,
         ps.snapshot_destination_domain,
         ps.snapshot_clicks,
         ps.snapshot_generated_at,
         ps.created_at,
         ps.is_enabled,
         ps.proof_group_key,
         ps.link_id,
         l.title as link_title,
         l.slug as link_slug,
         (SELECT COUNT(*) FROM proof_share_events pse WHERE pse.proof_share_id = ps.id AND pse.event_type = 'view') as view_count,
         (SELECT MAX(created_at) FROM proof_share_events pse WHERE pse.proof_share_id = ps.id AND pse.event_type = 'view') as last_viewed_at
       FROM proof_shares ps
       LEFT JOIN links l ON ps.link_id = l.id
       WHERE ps.user_id = ?
    `;

    if (!includeDisabled) {
      query += ` AND ps.is_enabled = 1`;
    }

    query += ` ORDER BY ps.created_at DESC LIMIT 25`;

    // Fetch proof shares
    const proofShares = await env.DB.prepare(query).bind(authUser.id).all();

    if (!proofShares.results) {
      return new Response(JSON.stringify({
        success: true,
        proofs: []
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Process each proof share with snapshot-first logic
    const proofs = proofShares.results.map(proof => {
      // Determine proof mode - snapshot if snapshot_clicks exists
      const proofMode = proof.snapshot_clicks !== null ? 'snapshot' : 'live';

      // Prefer snapshot values, fall back to legacy fields
      const title = proof.snapshot_video_title || proof.title || null;
      const thumbnail = proof.snapshot_thumbnail_url || null;
      const destinationDomain = proof.snapshot_destination_domain || null;
      const clicks = proof.snapshot_clicks !== null ? proof.snapshot_clicks : 0;
      const generatedAt = proof.snapshot_generated_at || proof.created_at;

      return {
        public_token: proof.public_token,
        proof_mode: proofMode,
        title: title,
        thumbnail: thumbnail,
        destination_domain: destinationDomain,
        clicks: clicks,
        generated_at: generatedAt,
        snapshot_generated_at: proof.snapshot_generated_at || null,
        created_at: proof.created_at,
        is_enabled: proof.is_enabled,
        proof_group_key: proof.proof_group_key || null,
        view_count: proof.view_count || 0,
        last_viewed_at: proof.last_viewed_at || null,
        youtube_video_id: proof.youtube_video_id || null,
        link_id: proof.link_id || null,
        link_title: proof.link_title || null,
        link_slug: proof.link_slug || null
      };
    });

    return new Response(JSON.stringify({
      success: true,
      proofs: proofs
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching proof shares:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
