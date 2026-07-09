export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code) {
      return new Response(JSON.stringify({ error: 'Missing authorization code' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!state) {
      return new Response(JSON.stringify({ error: 'Missing state parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Look up state in database
    const stateRecord = await env.DB.prepare(
      'SELECT user_id, expires_at FROM youtube_oauth_states WHERE state = ?'
    ).bind(state).first();

    if (!stateRecord) {
      return new Response(JSON.stringify({ error: 'Invalid or expired state' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if state is expired
    const now = new Date();
    const stateExpiresAt = new Date(stateRecord.expires_at);
    if (now > stateExpiresAt) {
      // Delete expired state
      await env.DB.prepare('DELETE FROM youtube_oauth_states WHERE state = ?').bind(state).run();
      return new Response(JSON.stringify({ error: 'State expired' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = stateRecord.user_id;

    const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirectUri = env.GOOGLE_OAUTH_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return new Response(JSON.stringify({ error: 'Google OAuth not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return new Response(JSON.stringify({ error: 'Failed to exchange authorization code' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in;

    if (!refreshToken) {
      return new Response(JSON.stringify({ error: 'No refresh token returned. Please revoke access and try again.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const connectedAt = new Date().toISOString();

    // Fetch channel info to get channel ID and title
    let channelId = null;
    let channelTitle = null;
    try {
      const channelResponse = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (channelResponse.ok) {
        const channelData = await channelResponse.json();
        const channel = channelData.items?.[0];
        if (channel) {
          channelId = channel.id;
          channelTitle = channel.snippet?.title;
        }
      }
    } catch (error) {
      // If channel fetch fails, continue without channel info
      console.error('Failed to fetch channel info:', error);
    }

    // Store in database
    const existingConnection = await env.DB.prepare(
      'SELECT id FROM youtube_connections WHERE user_id = ? AND is_active = 1'
    ).bind(userId).first();

    if (existingConnection) {
      // Update existing connection
      await env.DB.prepare(
        `UPDATE youtube_connections
         SET access_token = ?, refresh_token = ?, token_expires_at = ?, connected_at = ?, youtube_channel_id = ?, youtube_channel_title = ?, is_active = 1
         WHERE user_id = ?`
      ).bind(accessToken, refreshToken, expiresAt, connectedAt, channelId, channelTitle, userId).run();
    } else {
      // Create new connection
      await env.DB.prepare(
        `INSERT INTO youtube_connections (user_id, youtube_channel_id, youtube_channel_title, access_token, refresh_token, token_expires_at, connected_at, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
      ).bind(userId, channelId, channelTitle, accessToken, refreshToken, expiresAt, connectedAt).run();
    }

    // Delete used state
    await env.DB.prepare('DELETE FROM youtube_oauth_states WHERE state = ?').bind(state).run();

    // Derive app origin from redirect URI
    const appOrigin = new URL(redirectUri).origin;
    
    // Redirect to settings page on app domain
    return Response.redirect(`${appOrigin}/settings`, 302);
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to complete OAuth callback' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
