import { getAuthenticatedUser } from './auth-helper.js';

/**
 * Link Usages API
 *
 * Manages link_usages records for reusable links
 * Users can only manage usages for their own links
 */

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const linkId = url.searchParams.get('link_id');
    const includeMetadata = url.searchParams.get('include_metadata') === 'true';

    try {
      // Get authenticated user
      const user = await getAuthenticatedUser(request, env);

      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      let query = `
        SELECT
          id, link_id, user_id, youtube_video_id, placement_type, placement_name,
          public_code, source_code, destination_url_snapshot, title_snapshot,
          is_active, created_at, updated_at
        FROM link_usages
        WHERE user_id = ?
      `;
      let params = [user.id];

      // If link_id is specified, filter by link_id and verify ownership
      if (linkId) {
        // Verify ownership of the link first
        const link = await env.DB.prepare(
          'SELECT user_id FROM links WHERE id = ?'
        ).bind(linkId).first();

        if (!link) {
          return new Response(JSON.stringify({ error: 'Link not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (link.user_id !== user.id) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        query = `
          SELECT
            id, link_id, user_id, youtube_video_id, placement_type, placement_name,
            public_code, source_code, destination_url_snapshot, title_snapshot,
            is_active, created_at, updated_at
          FROM link_usages
          WHERE user_id = ? AND link_id = ?
        `;
        params = [user.id, linkId];
      }

      query += ` ORDER BY created_at DESC`;

      const { results } = await env.DB.prepare(query).bind(...params).all();

      let usages = results || [];

      // Enrich with YouTube metadata if requested
      if (includeMetadata && usages.length > 0) {
        try {
          // Collect all unique youtube_video_ids
          const videoIds = new Set();
          usages.forEach(usage => {
            if (usage.youtube_video_id) {
              videoIds.add(usage.youtube_video_id);
            }
          });

          if (videoIds.size > 0) {
            // Check for YouTube connection
            const connection = await env.DB.prepare(
              'SELECT access_token, refresh_token FROM youtube_connections WHERE user_id = ? AND is_active = 1'
            ).bind(user.id).first();

            if (connection) {
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

              // Fetch YouTube video metadata
              const videoIdList = Array.from(videoIds).join(',');
              let videosResponse = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoIdList}&key=${env.GOOGLE_API_KEY}`,
                {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                  },
                }
              );

              // Try refreshing token if needed
              if (!videosResponse.ok && videosResponse.status === 401) {
                try {
                  accessToken = await refreshAccessToken();
                  videosResponse = await fetch(
                    `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoIdList}&key=${env.GOOGLE_API_KEY}`,
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

              if (videosResponse.ok) {
                const videosData = await videosResponse.json();
                const videoTitleMap = new Map();
                const videoThumbnailMap = new Map();
                (videosData.items || []).forEach(item => {
                  videoTitleMap.set(item.id, item.snippet?.title || '');
                  const thumbnail = item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || null;
                  videoThumbnailMap.set(item.id, thumbnail);
                });

                // Add metadata to usages
                usages = usages.map(usage => {
                  if (usage.youtube_video_id) {
                    return {
                      ...usage,
                      title: videoTitleMap.get(usage.youtube_video_id) || usage.title_snapshot || null,
                      thumbnail: videoThumbnailMap.get(usage.youtube_video_id) || null,
                    };
                  }
                  return usage;
                });
              }
            }
          }
        } catch (metadataError) {
          console.error('Error fetching YouTube metadata for link usages:', metadataError);
          // Continue without metadata if fetch fails
        }
      }

      return new Response(JSON.stringify({
        success: true,
        usages: usages
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error fetching link usages:', error);
      return new Response(JSON.stringify({ error: 'Server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (request.method === 'POST') {
    try {
      // Get authenticated user
      const user = await getAuthenticatedUser(request, env);

      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const { link_id, youtube_video_id, placement_type, placement_name, public_code, source_code } = await request.json();
      const now = new Date().toISOString();

      // Validate required field
      if (!link_id) {
        return new Response(JSON.stringify({ error: 'link_id is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Verify ownership of the link
      const link = await env.DB.prepare(
        'SELECT user_id, original_url, title FROM links WHERE id = ?'
      ).bind(link_id).first();

      if (!link) {
        return new Response(JSON.stringify({ error: 'Link not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (link.user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Snapshot destination_url and title from the current links row
      const destination_url_snapshot = link.original_url;
      const title_snapshot = link.title;

      // Create link_usage
      const result = await env.DB.prepare(
        `INSERT INTO link_usages 
         (link_id, user_id, youtube_video_id, placement_type, placement_name, 
          public_code, source_code, destination_url_snapshot, title_snapshot, 
          is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        link_id,
        user.id,
        youtube_video_id || null,
        placement_type || null,
        placement_name || null,
        public_code || null,
        source_code || null,
        destination_url_snapshot,
        title_snapshot,
        1, // is_active
        now,
        now
      ).run();

      const newUsage = {
        id: result.meta.last_row_id,
        link_id,
        user_id: user.id,
        youtube_video_id: youtube_video_id || null,
        placement_type: placement_type || null,
        placement_name: placement_name || null,
        public_code: public_code || null,
        source_code: source_code || null,
        destination_url_snapshot,
        title_snapshot,
        is_active: 1,
        created_at: now,
        updated_at: now
      };

      return new Response(JSON.stringify({
        success: true,
        data: newUsage
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error creating link usage:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (request.method === 'PUT' || request.method === 'PATCH') {
    try {
      // Get authenticated user
      const user = await getAuthenticatedUser(request, env);

      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const { id, youtube_video_id, placement_type, placement_name, public_code, source_code, is_active } = await request.json();
      const now = new Date().toISOString();

      // Validate required field
      if (!id) {
        return new Response(JSON.stringify({ error: 'id is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Get the usage to verify ownership
      const usage = await env.DB.prepare(
        'SELECT link_id FROM link_usages WHERE id = ?'
      ).bind(id).first();

      if (!usage) {
        return new Response(JSON.stringify({ error: 'Link usage not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Verify ownership of the link
      const link = await env.DB.prepare(
        'SELECT user_id FROM links WHERE id = ?'
      ).bind(usage.link_id).first();

      if (!link) {
        return new Response(JSON.stringify({ error: 'Link not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (link.user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Build dynamic update query
      const updates = [];
      const params = [];

      if (youtube_video_id !== undefined) {
        updates.push('youtube_video_id = ?');
        params.push(youtube_video_id || null);
      }
      if (placement_type !== undefined) {
        updates.push('placement_type = ?');
        params.push(placement_type || null);
      }
      if (placement_name !== undefined) {
        updates.push('placement_name = ?');
        params.push(placement_name || null);
      }
      if (public_code !== undefined) {
        updates.push('public_code = ?');
        params.push(public_code || null);
      }
      if (source_code !== undefined) {
        updates.push('source_code = ?');
        params.push(source_code || null);
      }
      if (is_active !== undefined) {
        updates.push('is_active = ?');
        params.push(is_active);
      }

      updates.push('updated_at = ?');
      params.push(now);

      if (updates.length === 1) {
        return new Response(JSON.stringify({ error: 'No fields to update' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      params.push(id);

      const result = await env.DB.prepare(
        `UPDATE link_usages SET ${updates.join(', ')} WHERE id = ?`
      ).bind(...params).run();

      if (result.meta.changes === 0) {
        return new Response(JSON.stringify({ error: 'Link usage not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Link usage updated successfully'
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error updating link usage:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    const usageId = url.searchParams.get('id');

    if (!usageId) {
      return new Response(JSON.stringify({ error: 'id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      // Get authenticated user
      const user = await getAuthenticatedUser(request, env);

      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Get the usage to verify ownership
      const usage = await env.DB.prepare(
        'SELECT link_id FROM link_usages WHERE id = ?'
      ).bind(usageId).first();

      if (!usage) {
        return new Response(JSON.stringify({ error: 'Link usage not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Verify ownership of the link
      const link = await env.DB.prepare(
        'SELECT user_id FROM links WHERE id = ?'
      ).bind(usage.link_id).first();

      if (!link) {
        return new Response(JSON.stringify({ error: 'Link not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (link.user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Soft delete by setting is_active = 0
      const now = new Date().toISOString();
      await env.DB.prepare(
        'UPDATE link_usages SET is_active = 0, updated_at = ? WHERE id = ?'
      ).bind(now, usageId).run();

      return new Response(JSON.stringify({
        success: true,
        message: 'Link usage deactivated successfully'
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error deactivating link usage:', error);
      return new Response(JSON.stringify({ error: 'Server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
}
