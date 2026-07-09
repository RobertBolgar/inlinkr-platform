import { getAuthenticatedUser } from '../auth-helper.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const user = await getAuthenticatedUser(request, env);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const connection = await env.DB.prepare(
      'SELECT id FROM youtube_connections WHERE user_id = ? AND is_active = 1'
    ).bind(user.id).first();

    return new Response(JSON.stringify({ connected: !!connection }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to check YouTube connection status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
