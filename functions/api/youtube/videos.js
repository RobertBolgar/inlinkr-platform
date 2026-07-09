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
      'SELECT access_token, refresh_token FROM youtube_connections WHERE user_id = ? AND is_active = 1'
    ).bind(user.id).first();

    if (!connection) {
      return new Response(JSON.stringify({ error: 'YouTube not connected' }), {
        status: 400,
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
        const errorBody = await refreshResponse.text();
        console.error('Token refresh failed:', refreshResponse.status, errorBody);
        throw new Error('Token refresh failed');
      }

      const refreshData = await refreshResponse.json();
      const newAccessToken = refreshData.access_token;
      const expiresIn = refreshData.expires_in || 3600;
      const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      // Update database with new token
      await env.DB.prepare(
        'UPDATE youtube_connections SET access_token = ?, token_expires_at = ? WHERE user_id = ? AND is_active = 1'
      ).bind(newAccessToken, tokenExpiresAt, user.id).run();

      return newAccessToken;
    };

    // Step 1: Get channel info and uploads playlist ID
    let channelsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&mine=true`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    // If token expired, refresh and retry
    if (channelsResponse.status === 401) {
      try {
        accessToken = await refreshAccessToken();
        channelsResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&mine=true`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );
      } catch (refreshError) {
        console.error('Token refresh error:', refreshError);
        return new Response(JSON.stringify({ 
          error: 'YouTube access expired. Please reconnect in Settings.', 
          needsReconnect: true,
          step: 'channels',
          status: 401
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (!channelsResponse.ok) {
      const errorBody = await channelsResponse.text();
      console.error('YouTube channels API error:', channelsResponse.status, errorBody);
      
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch channel info', 
        step: 'channels',
        status: channelsResponse.status,
        details: errorBody.substring(0, 200)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const channelsData = await channelsResponse.json();
    const channel = channelsData.items?.[0];

    if (!channel) {
      return new Response(JSON.stringify({ error: 'No channel found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const channelTitle = channel.snippet.title;
    const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;

    // Step 2: Get videos from uploads playlist
    let playlistItemsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=10`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    // If token expired, refresh and retry
    if (playlistItemsResponse.status === 401) {
      try {
        accessToken = await refreshAccessToken();
        playlistItemsResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=10`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );
      } catch (refreshError) {
        console.error('Token refresh error:', refreshError);
        return new Response(JSON.stringify({ 
          error: 'YouTube access expired. Please reconnect in Settings.', 
          needsReconnect: true,
          step: 'playlistItems',
          status: 401
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (!playlistItemsResponse.ok) {
      const errorBody = await playlistItemsResponse.text();
      console.error('YouTube playlistItems API error:', playlistItemsResponse.status, errorBody);
      
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch playlist items', 
        step: 'playlistItems',
        status: playlistItemsResponse.status,
        details: errorBody.substring(0, 200)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const playlistItemsData = await playlistItemsResponse.json();
    const videoIds = playlistItemsData.items
      ?.map((item) => item.snippet.resourceId?.videoId)
      .filter(Boolean) || [];

    if (videoIds.length === 0) {
      return new Response(JSON.stringify({
        channel: { title: channelTitle },
        videos: []
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Step 3: Fetch video statistics
    let videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds.join(',')}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    // If token expired, refresh and retry
    if (videosResponse.status === 401) {
      try {
        accessToken = await refreshAccessToken();
        videosResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds.join(',')}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );
      } catch (refreshError) {
        console.error('Token refresh error:', refreshError);
        return new Response(JSON.stringify({ 
          error: 'YouTube access expired. Please reconnect in Settings.', 
          needsReconnect: true,
          step: 'videos',
          status: 401
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (!videosResponse.ok) {
      const errorBody = await videosResponse.text();
      console.error('YouTube videos API error:', videosResponse.status, errorBody);
      
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch video details', 
        step: 'videos',
        status: videosResponse.status,
        details: errorBody.substring(0, 200)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const videosData = await videosResponse.json();

    const videos = (videosData.items || []).map((item) => ({
      video_id: item.id,
      title: item.snippet.title,
      views: parseInt(item.statistics?.viewCount || '0', 10),
      thumbnail: item.snippet?.thumbnails?.default?.url || item.snippet?.thumbnails?.medium?.url || '',
    }));

    return new Response(JSON.stringify({
      channel: { title: channelTitle },
      videos
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('YouTube videos error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch videos', 
      step: 'general'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
