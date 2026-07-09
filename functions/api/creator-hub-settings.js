import { getAuthenticatedUser } from './auth-helper.js';
import { hasEffectiveProAccess } from './entitlement-helper.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'GET') {
    return await getSettings(context);
  } else if (request.method === 'PUT') {
    return await updateSettings(context);
  } else {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function getSettings(context) {
  const { request, env } = context;

  try {
    // Get authenticated user
    const authUser = await getAuthenticatedUser(request, env);

    if (!authUser) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check effective Pro access (paid Pro, referral Pro, or Founder)
    const userHasEffectiveProAccess = hasEffectiveProAccess(authUser);
    if (!userHasEffectiveProAccess) {
      return new Response(
        JSON.stringify({ error: 'Pro access required' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get creator hub settings for the user
    const settings = await env.DB.prepare(
      'SELECT user_id, creator_tagline, creator_bio, featured_link_id, featured_video_id, featured_title_override, featured_description_override, featured_cta_text, show_resources, show_videos, show_metrics, custom_section_title, created_at, updated_at FROM creator_hub_settings WHERE user_id = ?'
    ).bind(authUser.id).first();

    // Get active non-system links for featured link selector
    const links = await env.DB.prepare(
      'SELECT id, slug, title, subtitle, video_id FROM links WHERE user_id = ? AND is_active = 1 AND COALESCE(is_system, 0) = 0 ORDER BY created_at DESC'
    ).bind(authUser.id).all();

    // Fetch YouTube videos for the user
    let youtubeVideos = [];
    try {
      const connection = await env.DB.prepare(
        'SELECT access_token, refresh_token FROM youtube_connections WHERE user_id = ? AND is_active = 1'
      ).bind(authUser.id).first();

      if (connection) {
        youtubeVideos = await fetchYouTubeVideos(env, connection.access_token, connection.refresh_token);
      }
    } catch (error) {
      console.error('Error fetching YouTube videos:', error);
      // Continue without YouTube videos if fetch fails
    }

    return new Response(
      JSON.stringify({
        settings: settings || null,
        links: links.results || [],
        youtube_videos: youtubeVideos
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching creator hub settings:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Helper function to fetch YouTube videos (reused from /api/youtube/videos logic)
async function fetchYouTubeVideos(env, accessToken, refreshToken) {
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
      throw new Error('Token refresh failed');
    }

    const refreshData = await refreshResponse.json();
    return refreshData.access_token;
  };

  // Get channel info and uploads playlist ID
  let channelsResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&mine=true`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

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
      return [];
    }
  }

  if (!channelsResponse.ok) {
    console.error('YouTube channels API error:', channelsResponse.status);
    return [];
  }

  const channelsData = await channelsResponse.json();
  const channel = channelsData.items?.[0];

  if (!channel) {
    return [];
  }

  const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;

  // Get videos from uploads playlist
  let playlistItemsResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=10`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

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
      return [];
    }
  }

  if (!playlistItemsResponse.ok) {
    console.error('YouTube playlistItems API error:', playlistItemsResponse.status);
    return [];
  }

  const playlistItemsData = await playlistItemsResponse.json();
  const videoIds = playlistItemsData.items
    ?.map((item) => item.snippet.resourceId?.videoId)
    .filter(Boolean) || [];

  if (videoIds.length === 0) {
    return [];
  }

  // Fetch video statistics
  let videosResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds.join(',')}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

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
      return [];
    }
  }

  if (!videosResponse.ok) {
    console.error('YouTube videos API error:', videosResponse.status);
    return [];
  }

  const videosData = await videosResponse.json();

  return (videosData.items || []).map((item) => ({
    video_id: item.id,
    title: item.snippet.title,
    views: parseInt(item.statistics?.viewCount || '0', 10),
    thumbnail: item.snippet?.thumbnails?.default?.url || item.snippet?.thumbnails?.medium?.url || '',
  }));
}

async function updateSettings(context) {
  const { request, env } = context;

  try {
    // Get authenticated user
    const authUser = await getAuthenticatedUser(request, env);

    if (!authUser) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check effective Pro access (paid Pro, referral Pro, or Founder)
    const userHasEffectiveProAccess = hasEffectiveProAccess(authUser);
    if (!userHasEffectiveProAccess) {
      return new Response(
        JSON.stringify({ error: 'Pro access required' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const {
      creator_tagline,
      creator_bio,
      featured_link_id,
      featured_video_id,
      featured_title_override,
      featured_description_override,
      featured_cta_text,
      show_resources,
      show_videos,
      show_metrics,
      custom_section_title
    } = body;

    // Validate text lengths
    if (creator_tagline && creator_tagline.length > 120) {
      return new Response(
        JSON.stringify({ error: 'Creator tagline must be 120 characters or less' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (creator_bio && creator_bio.length > 240) {
      return new Response(
        JSON.stringify({ error: 'Creator bio must be 240 characters or less' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (featured_title_override && featured_title_override.length > 120) {
      return new Response(
        JSON.stringify({ error: 'Featured title override must be 120 characters or less' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (featured_description_override && featured_description_override.length > 240) {
      return new Response(
        JSON.stringify({ error: 'Featured description override must be 240 characters or less' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (featured_cta_text && featured_cta_text.length > 40) {
      return new Response(
        JSON.stringify({ error: 'Featured CTA text must be 40 characters or less' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate featured_link_id if provided
    if (featured_link_id) {
      const link = await env.DB.prepare(
        'SELECT id, user_id, is_active, is_system FROM links WHERE id = ?'
      ).bind(featured_link_id).first();

      if (!link) {
        return new Response(
          JSON.stringify({ error: 'Featured link not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (link.user_id !== authUser.id) {
        return new Response(
          JSON.stringify({ error: 'Featured link does not belong to this user' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (link.is_active !== 1 || link.is_system === 1) {
        return new Response(
          JSON.stringify({ error: 'Featured link must be active and non-system' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate featured_video_id if provided
    if (featured_video_id) {
      // Fetch user's YouTube videos to validate the video belongs to their channel
      try {
        const connection = await env.DB.prepare(
          'SELECT access_token, refresh_token FROM youtube_connections WHERE user_id = ? AND is_active = 1'
        ).bind(authUser.id).first();

        if (!connection) {
          return new Response(
            JSON.stringify({ error: 'YouTube not connected. Connect YouTube in Settings to select a featured video.' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const youtubeVideos = await fetchYouTubeVideos(env, connection.access_token, connection.refresh_token);
        const videoExists = youtubeVideos.some(v => v.video_id === featured_video_id);

        if (!videoExists) {
          return new Response(
            JSON.stringify({ error: 'Featured video not found in your channel' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } catch (error) {
        console.error('Error validating featured video:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to validate featured video' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const now = new Date().toISOString();

    // Check if settings already exist
    const existing = await env.DB.prepare(
      'SELECT user_id FROM creator_hub_settings WHERE user_id = ?'
    ).bind(authUser.id).first();

    if (existing) {
      // Update existing settings
      await env.DB.prepare(
        `UPDATE creator_hub_settings 
         SET creator_tagline = ?, creator_bio = ?, featured_link_id = ?, featured_video_id = ?,
             featured_title_override = ?, featured_description_override = ?, 
             featured_cta_text = ?, show_resources = ?, show_videos = ?, 
             show_metrics = ?, custom_section_title = ?, updated_at = ?
         WHERE user_id = ?`
      ).bind(
        creator_tagline || null,
        creator_bio || null,
        featured_link_id || null,
        featured_video_id || null,
        featured_title_override || null,
        featured_description_override || null,
        featured_cta_text || null,
        show_resources !== undefined ? (show_resources ? 1 : 0) : 1,
        show_videos !== undefined ? (show_videos ? 1 : 0) : 1,
        show_metrics !== undefined ? (show_metrics ? 1 : 0) : 1,
        custom_section_title || null,
        now,
        authUser.id
      ).run();
    } else {
      // Insert new settings
      await env.DB.prepare(
        `INSERT INTO creator_hub_settings 
         (user_id, creator_tagline, creator_bio, featured_link_id, featured_video_id,
          featured_title_override, featured_description_override, 
          featured_cta_text, show_resources, show_videos, 
          show_metrics, custom_section_title, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        authUser.id,
        creator_tagline || null,
        creator_bio || null,
        featured_link_id || null,
        featured_video_id || null,
        featured_title_override || null,
        featured_description_override || null,
        featured_cta_text || null,
        show_resources !== undefined ? (show_resources ? 1 : 0) : 1,
        show_videos !== undefined ? (show_videos ? 1 : 0) : 1,
        show_metrics !== undefined ? (show_metrics ? 1 : 0) : 1,
        custom_section_title || null,
        now,
        now
      ).run();
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error updating creator hub settings:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
