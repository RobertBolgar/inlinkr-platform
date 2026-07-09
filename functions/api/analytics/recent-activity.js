import { getAuthenticatedUser } from '../auth-helper.js';
import { checkRateLimit, getIpRateLimitKey, RATE_LIMITS, createRateLimitResponse } from '../rate-limit-helper.js';

export async function onRequest(context) {
  const { request, env } = context;

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
    const rateLimitKey = `recent-activity:${user.id}`;
    const rateLimitResult = await checkRateLimit(env, rateLimitKey, RATE_LIMITS.ANALYTICS);
    
    if (!rateLimitResult.success) {
      return createRateLimitResponse('Too many analytics requests. Please try again later.');
    }

    // Get recent activity for the user
    const { results } = await env.DB.prepare(`
      SELECT 
        ce.timestamp as created_at,
        l.slug,
        ce.source
      FROM click_events ce
      JOIN links l ON l.id = ce.link_id
      WHERE l.user_id = ?
      ORDER BY ce.timestamp DESC
      LIMIT 10
    `).bind(user.id).all();

    const activity = results || [];

    return new Response(JSON.stringify({ activity }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Recent activity error:", error);
    return new Response(JSON.stringify({
      error: "Failed to load recent activity"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
