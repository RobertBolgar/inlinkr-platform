import { getAuthenticatedUser } from '../auth-helper.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
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

    // Deactivate YouTube connection for this user
    await env.DB.prepare(
      'UPDATE youtube_connections SET is_active = 0 WHERE user_id = ?'
    ).bind(user.id).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to disconnect YouTube account' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
