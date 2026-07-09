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

    // Get YouTube connection
    const connection = await env.DB.prepare(
      'SELECT access_token, refresh_token, youtube_channel_id FROM youtube_connections WHERE user_id = ? AND is_active = 1'
    ).bind(user.id).first();

    if (!connection) {
      return new Response(JSON.stringify({ avatarUrl: null }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let accessToken = connection.access_token;
    const refreshToken = connection.refresh_token;

    // Helper function to refresh access token
    const refreshAccessToken = async () => {
      const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
      const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error('Google OAuth not configured');
      }

      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        throw new Error('Failed to refresh access token');
      }

      const refreshData = await refreshResponse.json();
      return refreshData.access_token;
    };

    // Fetch channel avatar
    let channelAvatarUrl = null;
    try {
      let channelResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${connection.youtube_channel_id}&key=${env.GOOGLE_API_KEY}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      // Try refreshing token if needed
      if (!channelResponse.ok && channelResponse.status === 401) {
        try {
          accessToken = await refreshAccessToken();
          channelResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${connection.youtube_channel_id}&key=${env.GOOGLE_API_KEY}`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            }
          );
        } catch (refreshError) {
          console.error('Token refresh error:', refreshError);
        }
      }

      if (channelResponse.ok) {
        const channelData = await channelResponse.json();
        const channel = channelData.items?.[0];
        if (channel?.snippet?.thumbnails) {
          // Prefer high quality, then medium, then default
          channelAvatarUrl = channel.snippet.thumbnails.high?.url || 
                           channel.snippet.thumbnails.medium?.url || 
                           channel.snippet.thumbnails.default?.url || 
                           null;
        }
      }
    } catch (channelError) {
      console.error('Error fetching channel avatar:', channelError);
    }

    return new Response(JSON.stringify({ avatarUrl: channelAvatarUrl }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching YouTube avatar:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch YouTube avatar' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
