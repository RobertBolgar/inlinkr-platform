import { getAuthenticatedUser } from '../auth-helper.js';
import { checkRateLimit, RATE_LIMITS, createRateLimitResponse } from '../rate-limit-helper.js';

export async function onRequest(context) {
  const { request, env } = context;

  try {
    // Get authenticated user
    const user = await getAuthenticatedUser(request, env);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check rate limit using simple string key like recent-activity
    const rateLimitKey = `daily-click-summary:${user.id}`;
    const rateLimitResult = await checkRateLimit(env, rateLimitKey, RATE_LIMITS.ANALYTICS);
    
    if (!rateLimitResult.success) {
      return createRateLimitResponse('Too many analytics requests. Please try again later.');
    }

    // Calculate time windows for today and yesterday in UTC
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));

    // Helper function to count clicks in a time range
    const countClicksInRange = async (startTime, endTime) => {
      const { results } = await env.DB.prepare(`
        SELECT COUNT(*) as count
        FROM click_events ce
        JOIN links l ON l.id = ce.link_id
        WHERE l.user_id = ?
        AND ce.timestamp >= ?
        AND ce.timestamp < ?
      `).bind(user.id, startTime.toISOString(), endTime.toISOString()).all();
      
      return results[0]?.count || 0;
    };

    // Get today's and yesterday's click counts
    const todayCount = await countClicksInRange(today, tomorrow);
    const yesterdayCount = await countClicksInRange(yesterday, today);

    return new Response(JSON.stringify({
      today: todayCount,
      yesterday: yesterdayCount
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Daily click summary error:", error);
    return new Response(JSON.stringify({
      error: "Failed to load daily click summary"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
