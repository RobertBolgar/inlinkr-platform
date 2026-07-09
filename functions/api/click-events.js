import { getAuthenticatedUser } from './auth-helper.js';
import { checkRateLimit, getIpRateLimitKey, RATE_LIMITS, createRateLimitResponse } from './rate-limit-helper.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'POST') {
    try {
      const body = await request.json();

      // Handle analytics retrieval (link_ids array)
      if (body.link_ids && Array.isArray(body.link_ids)) {
        
        // Get authenticated user
        const user = await getAuthenticatedUser(request, env);

        if (!user) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        const link_ids = body.link_ids.map(id => String(id));
        
        if (link_ids.length === 0) {
          return new Response(JSON.stringify([]), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Verify user owns all requested link_ids
        const placeholders = link_ids.map(() => '?').join(',');
        const { results } = await env.DB.prepare(
          `SELECT user_id FROM links WHERE id IN (${placeholders}) AND is_active = 1`
        ).bind(...link_ids).all();

        if (!results || results.length === 0) {
          return new Response(JSON.stringify({
            events: [],
            totalClicks: 0,
            bySource: []
          }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Check if all links belong to the user
        const allOwned = results.every(link => link.user_id === user.id);
        if (!allOwned) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        const { results: clickResults } = await env.DB.prepare(
          `SELECT id, link_id, referrer, user_agent, ip_hash, source, timestamp 
           FROM click_events WHERE link_id IN (${placeholders}) ORDER BY timestamp DESC`
        ).bind(...link_ids).all();
        
        // Add source-based analytics
        const sourceAnalytics = {};
        let totalClicks = 0;
        
        if (clickResults && clickResults.length > 0) {
          // Group by source
          clickResults.forEach(event => {
            const source = event.source || null;
            sourceAnalytics[source] = (sourceAnalytics[source] || 0) + 1;
            totalClicks++;
          });
          
          // Convert to array and sort by clicks descending
          const bySource = Object.entries(sourceAnalytics)
            .map(([source, clicks]) => ({ source, clicks }))
            .sort((a, b) => b.clicks - a.clicks);
          
          // Add source analytics to response
          const response = {
            events: clickResults,
            totalClicks,
            bySource
          };
          
          return new Response(JSON.stringify(response), {
            headers: { 'Content-Type': 'application/json' },
          });
        } else {
          // Return empty response if no results
          return new Response(JSON.stringify({
            events: [],
            totalClicks: 0,
            bySource: []
          }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      
      // Handle click recording (link_id) - this is called by the Worker, not the frontend
      // We'll skip auth for click recording since it's called by the public redirect Worker
      // But apply rate limiting to prevent click spam
      const { link_id, referrer, user_agent, ip_hash, source } = body;
      
      // Check rate limit for click recording (10 per 10 minutes per IP)
      const rateLimitKey = getIpRateLimitKey(request);
      const rateLimitResult = await checkRateLimit(env, rateLimitKey, RATE_LIMITS.ANONYMOUS_POST);
      
      if (!rateLimitResult.success) {
        return createRateLimitResponse('Too many click events. Please try again later.');
      }
      
      const now = new Date().toISOString();

      if (!link_id) {
        console.error('Missing link_id in click event');
        return new Response(JSON.stringify({ error: 'link_id required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Validate link exists and is active to prevent click pollution
      const link = await env.DB.prepare(
        'SELECT id FROM links WHERE id = ? AND is_active = 1'
      ).bind(link_id).first();

      if (!link) {
        return new Response(JSON.stringify({ error: 'Link not found or inactive' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Normalize source: lowercase, trimmed, no spaces
      const normalizedSource = source ? source.toLowerCase().trim().replace(/\s+/g, '') : 'direct';

      const result = await env.DB.prepare(
        `INSERT INTO click_events (link_id, timestamp, referrer, user_agent, ip_hash, source)
           VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(link_id, now, referrer || null, user_agent || null, ip_hash || null, normalizedSource).run();

      return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('POST click events error:', error);
      return new Response(JSON.stringify({ error: 'Server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  if (request.method === 'GET') {
    return new Response('Method not allowed. Use POST for analytics.', { status: 405 });
  }
  
  return new Response('Method not allowed', { status: 405 });
}
