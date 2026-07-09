import { getAuthenticatedUser } from './auth-helper.js';
import { getPlacementClickCounts } from './analytics-helper.js';
import { checkRateLimit, getUserRateLimitKey, getIpRateLimitKey, RATE_LIMITS, createRateLimitResponse } from './rate-limit-helper.js';

export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const linkId = url.searchParams.get('link_id');
    const linkIds = url.searchParams.get('link_ids');
    
    // Bulk fetch for multiple link IDs
    if (linkIds) {
      try {
        const user = await getAuthenticatedUser(request, env);

        if (!user) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const ids = linkIds.split(',').map(id => id.trim()).filter(id => id);
        
        if (ids.length === 0) {
          return new Response(JSON.stringify({ error: 'No valid link_ids provided' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Verify ownership of all links
        const placeholders = ids.map(() => '?').join(',');
        const links = await env.DB.prepare(
          `SELECT id FROM links WHERE id IN (${placeholders}) AND user_id = ? AND is_active = 1`
        ).bind(...ids, user.id).all();

        const validLinkIds = (links.results || []).map(l => l.id);
        
        if (validLinkIds.length === 0) {
          return new Response(JSON.stringify({ placements_by_link: {} }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Fetch all placements for valid links
        const linkPlaceholders = validLinkIds.map(() => '?').join(',');
        const placementsResult = await env.DB.prepare(
          `SELECT id, link_id, name, type, source_code, public_code, link_usage_id, youtube_video_id, created_at, updated_at 
           FROM placements WHERE link_id IN (${linkPlaceholders}) ORDER BY created_at DESC`
        ).bind(...validLinkIds).all();

        const placements = placementsResult.results || [];

        // Get click counts for all placements in batch
        const placementIds = placements.map(p => p.id);
        let placementClickMap = {};
        
        if (placementIds.length > 0) {
          const idPlaceholders = placementIds.map(() => '?').join(',');
          const clickResults = await env.DB.prepare(
            `SELECT p.id, COUNT(c.id) as click_count 
             FROM placements p
             LEFT JOIN click_events c ON c.link_id = p.link_id AND c.source = p.source_code
             WHERE p.id IN (${idPlaceholders})
             GROUP BY p.id`
          ).bind(...placementIds).all();

          placementClickMap = Object.fromEntries(
            (clickResults.results || []).map(r => [r.id, r.click_count || 0])
          );
        }

        // Group placements by link_id
        const placementsByLink = {};
        placements.forEach(p => {
          if (!placementsByLink[p.link_id]) {
            placementsByLink[p.link_id] = [];
          }
          placementsByLink[p.link_id].push({
            ...p,
            clicks: placementClickMap[p.id] || 0
          });
        });

        return new Response(JSON.stringify({ placements_by_link: placementsByLink }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('Error fetching bulk placements:', error);
        return new Response(JSON.stringify({ error: 'Server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Single link fetch (existing behavior)
    if (!linkId) {
      return new Response(JSON.stringify({ error: 'link_id required' }), {
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

      // Verify ownership of the link
      const link = await env.DB.prepare(
        'SELECT user_id FROM links WHERE id = ? AND is_active = 1'
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

      // Use shared utility for consistent click counting across all pages
      const placementsWithClicks = await getPlacementClickCounts(linkId, env);
      
      return new Response(JSON.stringify(placementsWithClicks), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error fetching placements:', error);
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

      // Check rate limit for create placement (60 per hour per user)
      const rateLimitKey = getUserRateLimitKey(user.id);
      const rateLimitResult = await checkRateLimit(env, rateLimitKey, RATE_LIMITS.CREATE_PLACEMENT);
      
      if (!rateLimitResult.success) {
        return createRateLimitResponse('Too many placement creations. Please try again later.');
      }

      const { link_id, name, type, source_code, link_usage_id, youtube_video_id } = await request.json();
      const now = new Date().toISOString();
      
      // Generate source_code for custom placements if not provided
      let normalizedSourceCode;
      if (type === 'other' && !source_code) {
        // Generate sequential custom code (c1, c2, c3...) unique per link
        let customCounter = 1;
        while (true) {
          const candidateCode = `c${customCounter}`;
          const existing = await env.DB.prepare(
            'SELECT id FROM placements WHERE link_id = ? AND source_code = ?'
          ).bind(link_id, candidateCode).first();
          
          if (!existing) {
            normalizedSourceCode = candidateCode;
            break;
          }
          customCounter++;
        }
      } else if (source_code) {
        // Normalize provided source_code: lowercase, trimmed, no spaces
        normalizedSourceCode = source_code.toLowerCase().trim().replace(/\s+/g, '');
      } else {
        // For standard types, generate sequential codes (d, d2, d3..., p, p2, p3..., etc.)
        const typeToCode = {
          'description': 'd',
          'pinned': 'p',
          'bio': 'b',
          'short': 's',
          'video': 'v',
          'qr_code': 'q'
        };
        const baseCode = typeToCode[type] || 'c1';
        
        // First try the base code (d, p, b, s, v)
        let existing = await env.DB.prepare(
          'SELECT id FROM placements WHERE link_id = ? AND source_code = ?'
        ).bind(link_id, baseCode).first();
        
        if (!existing) {
          normalizedSourceCode = baseCode;
        } else {
          // If base code is taken, try sequential increments (d2, d3, d4...)
          let counter = 2;
          while (true) {
            const candidateCode = `${baseCode}${counter}`;
            existing = await env.DB.prepare(
              'SELECT id FROM placements WHERE link_id = ? AND source_code = ?'
            ).bind(link_id, candidateCode).first();
            
            if (!existing) {
              normalizedSourceCode = candidateCode;
              break;
            }
            counter++;
          }
        }
      }
      
      if (!link_id || !name || !type || !normalizedSourceCode) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Verify ownership of the link
      const link = await env.DB.prepare(
        'SELECT user_id FROM links WHERE id = ? AND is_active = 1'
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
      
      // Validate type
      const validTypes = ['description', 'pinned', 'bio', 'short', 'video', 'other', 'qr_code'];
      if (!validTypes.includes(type)) {
        return new Response(JSON.stringify({ error: 'Invalid type' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Check if source_code is unique within the same link
      const existing = await env.DB.prepare(
        'SELECT id FROM placements WHERE link_id = ? AND source_code = ?'
      ).bind(link_id, normalizedSourceCode).first();
      
      if (existing) {
        return new Response(JSON.stringify({ error: 'Source code already in use for this link' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Set public_code to the same value as source_code for all placement types
      // This ensures repeated same-type placements (d, d2, d3...) generate distinct URLs
      const public_code = normalizedSourceCode;
      
      // Create placement
      const result = await env.DB.prepare(
        `INSERT INTO placements (link_id, name, type, source_code, public_code, link_usage_id, youtube_video_id, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(link_id, name, type, normalizedSourceCode, public_code, link_usage_id || null, youtube_video_id || null, now, now).run();
      
      // Update link placement_count
      await env.DB.prepare(
        `UPDATE links SET placement_count = placement_count + 1 WHERE id = ?`
      ).bind(link_id).run();
      
      const newPlacement = {
        id: result.meta.last_row_id,
        link_id,
        name,
        type,
        source_code: normalizedSourceCode,
        public_code: public_code,
        link_usage_id: link_usage_id || null,
        youtube_video_id: youtube_video_id || null,
        created_at: now,
        updated_at: now,
        clicks: 0
      };
      
      return new Response(JSON.stringify({
        success: true,
        data: newPlacement
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error creating placement:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  if (request.method === 'PUT') {
    const url = new URL(request.url);
    const placementId = url.searchParams.get('id');
    
    if (!placementId) {
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

      const { youtube_video_id, link_usage_id } = await request.json();
      const now = new Date().toISOString();

      // Get placement info
      const placement = await env.DB.prepare(
        'SELECT link_id FROM placements WHERE id = ?'
      ).bind(placementId).first();
      
      if (!placement) {
        return new Response(JSON.stringify({ error: 'Placement not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Verify ownership of the link
      const link = await env.DB.prepare(
        'SELECT user_id FROM links WHERE id = ? AND is_active = 1'
      ).bind(placement.link_id).first();

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
      
      // Update placement
      await env.DB.prepare(
        `UPDATE placements SET youtube_video_id = ?, link_usage_id = ?, updated_at = ? WHERE id = ?`
      ).bind(youtube_video_id || null, link_usage_id || null, now, placementId).run();
      
      return new Response(JSON.stringify({
        success: true
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error updating placement:', error);
      return new Response(JSON.stringify({ error: 'Server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    const placementId = url.searchParams.get('id');
    
    if (!placementId) {
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

      // Get placement info before deletion
      const placement = await env.DB.prepare(
        'SELECT link_id, link_usage_id, youtube_video_id FROM placements WHERE id = ?'
      ).bind(placementId).first();
      
      if (!placement) {
        return new Response(JSON.stringify({ error: 'Placement not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Verify ownership of the link
      const link = await env.DB.prepare(
        'SELECT user_id FROM links WHERE id = ? AND is_active = 1'
      ).bind(placement.link_id).first();

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
      
      // Delete placement
      await env.DB.prepare(
        'DELETE FROM placements WHERE id = ?'
      ).bind(placementId).run();

      // If placement had a youtube_video_id, check if other placements on this link reference it
      if (placement.youtube_video_id) {
        const otherPlacementsWithVideo = await env.DB.prepare(
          'SELECT id FROM placements WHERE link_id = ? AND youtube_video_id = ?'
        ).bind(placement.link_id, placement.youtube_video_id).first();

        // If no other placements on this link use this video, check if it matches the link's base video
        if (!otherPlacementsWithVideo) {
          const link = await env.DB.prepare(
            'SELECT video_id FROM links WHERE id = ?'
          ).bind(placement.link_id).first();

          // If the link's base video matches the deleted placement's video, clear it
          if (link && link.video_id === placement.youtube_video_id) {
            await env.DB.prepare(
              'UPDATE links SET video_id = NULL, video_title = NULL, video_thumbnail = NULL WHERE id = ?'
            ).bind(placement.link_id).run();
          }
        }
      }

      // Update link placement_count
      await env.DB.prepare(
        `UPDATE links SET placement_count = placement_count - 1 WHERE id = ?`
      ).bind(placement.link_id).run();
      
      return new Response(JSON.stringify({
        success: true
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error deleting placement:', error);
      return new Response(JSON.stringify({ error: 'Server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  return new Response('Method not allowed', { status: 405 });
}
