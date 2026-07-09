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

    // All authenticated users can now connect YouTube (Free, Pro, Pro+)
    const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
    const redirectUri = env.GOOGLE_OAUTH_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return new Response(JSON.stringify({ error: 'Google OAuth not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const scope = 'https://www.googleapis.com/auth/youtube.readonly';
    const state = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Store state in database
    await env.DB.prepare(
      `INSERT INTO youtube_oauth_states (state, user_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`
    ).bind(state, user.id, createdAt, expiresAt).run();

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', state);

    return new Response(JSON.stringify({ auth_url: authUrl.toString(), state }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('OAuth start error:', error);
    return new Response(JSON.stringify({ error: 'Failed to start OAuth flow' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
