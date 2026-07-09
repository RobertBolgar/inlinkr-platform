import { getAuthenticatedUser } from '../auth-helper.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const linkId = params.id;

  if (request.method === 'GET') {
    try {
      // Get authenticated user
      const user = await getAuthenticatedUser(request, env);

      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const url = new URL(request.url);
      const includeMetadata = url.searchParams.get('include_metadata') === 'true';

      const link = await env.DB.prepare(
        `SELECT l.*, u.username
         FROM links l
         JOIN users u ON l.user_id = u.id
         WHERE l.id = ?`
      ).bind(linkId).first();

      if (!link) {
        return new Response(JSON.stringify({ error: 'Link not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Verify ownership
      if (link.user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      let responseData = link;

      // Enrich with YouTube metadata if requested and link has video_id
      if (includeMetadata && link.video_id) {
        try {
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
            let videosResponse = await fetch(
              `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${link.video_id}&key=${env.GOOGLE_API_KEY}`,
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
                  `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${link.video_id}&key=${env.GOOGLE_API_KEY}`,
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
              const item = (videosData.items || [])[0];
              if (item) {
                responseData = {
                  ...link,
                  video_title: item.snippet?.title || null,
                  video_thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || null,
                };
              }
            }
          }
        } catch (metadataError) {
          console.error('Error fetching YouTube metadata for link:', metadataError);
          // Continue without metadata if fetch fails
        }
      }

      return new Response(JSON.stringify(responseData), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error fetching link:', error);
      return new Response(JSON.stringify({ error: 'Server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (request.method === 'PUT') {
    try {
      // Get authenticated user
      const user = await getAuthenticatedUser(request, env);

      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Verify ownership before update
      const link = await env.DB.prepare(
        'SELECT user_id, is_system FROM links WHERE id = ?'
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

      const { original_url, title, subtitle, slug, is_active, video_id } = await request.json();
      const now = new Date().toISOString();

      // Validate URL if being updated - only allow http:// and https://
      if (original_url !== undefined && original_url !== null) {
        const normalizedUrl = original_url.toLowerCase().trim();
        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
          return new Response(JSON.stringify({
            error: 'Invalid URL. Only http:// and https:// URLs are allowed.'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      // Build dynamic update query
      const updates = [];
      const params = [];

      if (original_url !== undefined) {
        updates.push('original_url = ?');
        params.push(original_url);
      }
      if (title !== undefined) {
        updates.push('title = ?');
        params.push(title || null);
      }
      if (subtitle !== undefined) {
        updates.push('subtitle = ?');
        params.push(subtitle || null);
      }
      if (slug !== undefined) {
        updates.push('slug = ?');
        params.push(slug);
      }
      if (is_active !== undefined) {
        updates.push('is_active = ?');
        params.push(is_active);
      }
      if (video_id !== undefined) {
        updates.push('video_id = ?');
        params.push(video_id || null);
      }

      updates.push('updated_at = ?');
      params.push(now);

      if (updates.length === 1) {
        return new Response(JSON.stringify({ error: 'No fields to update' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      params.push(linkId);

      // Allow clearing video fields on system links, but block other edits
      if (link.is_system === 1 || link.is_system === true) {
        // Check if only video fields are being updated
        const isOnlyVideoUpdate = updates.every(update =>
          update === 'video_id = ?' ||
          update === 'updated_at = ?'
        );

        if (!isOnlyVideoUpdate) {
          return new Response(JSON.stringify({
            error: 'Referral links cannot be edited or deleted.'
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      const result = await env.DB.prepare(
        `UPDATE links SET ${updates.join(', ')} WHERE id = ?`
      ).bind(...params).run();
      
      if (result.meta.changes === 0) {
        return new Response(JSON.stringify({ error: 'Link not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Link updated successfully'
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error updating link:', error);
      return new Response(JSON.stringify({ error: 'Server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (request.method === 'DELETE') {
    try {
      // Get authenticated user
      const user = await getAuthenticatedUser(request, env);

      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Verify ownership before delete
      const link = await env.DB.prepare(
        'SELECT user_id, is_system FROM links WHERE id = ?'
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

      // Prevent deleting system links
      if (link.is_system === 1 || link.is_system === true) {
        return new Response(JSON.stringify({ 
          error: 'Referral links cannot be edited or deleted.' 
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Delete the link (soft delete by setting is_active = 0)
      await env.DB.prepare(
        'UPDATE links SET is_active = 0, updated_at = ? WHERE id = ?'
      ).bind(new Date().toISOString(), linkId).run();
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Link deleted successfully'
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error deleting link:', error);
      return new Response(JSON.stringify({ error: 'Server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
}
