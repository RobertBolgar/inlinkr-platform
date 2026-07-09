import { getAuthenticatedUser } from './auth-helper.js';

/**
 * API endpoint for managing analytics video exclusions
 * Allows users to hide specific videos from Analytics without deleting links or historical data
 */
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');

    if (!userId) {
      return new Response(JSON.stringify({ error: 'user_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const user = await getAuthenticatedUser(request, env);

      if (!user || user.id !== userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const exclusions = await env.DB.prepare(
        'SELECT id, youtube_video_id, reason, created_at FROM analytics_video_exclusions WHERE user_id = ?'
      ).bind(userId).all();

      return new Response(JSON.stringify({
        success: true,
        exclusions: exclusions.results || []
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error fetching exclusions:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch exclusions' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (request.method === 'POST') {
    try {
      const user = await getAuthenticatedUser(request, env);

      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const { youtube_video_id, reason } = await request.json();

      if (!youtube_video_id) {
        return new Response(JSON.stringify({ error: 'youtube_video_id required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const now = new Date().toISOString();

      // Insert or update exclusion
      await env.DB.prepare(
        `INSERT INTO analytics_video_exclusions (user_id, youtube_video_id, reason, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, youtube_video_id) DO UPDATE SET reason = excluded.reason`
      ).bind(user.id, youtube_video_id, reason || null, now).run();

      return new Response(JSON.stringify({
        success: true,
        message: 'Video excluded from analytics'
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error creating exclusion:', error);
      return new Response(JSON.stringify({ error: 'Failed to create exclusion' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    const youtube_video_id = url.searchParams.get('youtube_video_id');

    if (!youtube_video_id) {
      return new Response(JSON.stringify({ error: 'youtube_video_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const user = await getAuthenticatedUser(request, env);

      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      await env.DB.prepare(
        'DELETE FROM analytics_video_exclusions WHERE user_id = ? AND youtube_video_id = ?'
      ).bind(user.id, youtube_video_id).run();

      return new Response(JSON.stringify({
        success: true,
        message: 'Video restored to analytics'
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error deleting exclusion:', error);
      return new Response(JSON.stringify({ error: 'Failed to delete exclusion' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
}
