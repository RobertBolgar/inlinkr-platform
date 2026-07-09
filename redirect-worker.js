/**
 * Cloudflare Worker for handling clean public redirect URLs
 * 
 * This Worker handles:
 * - /{username}/{slug} (base link)
 * - /{username}/{slug}/{public_code} (placement link)
 * 
 * Deployed to: go.tubelinkr.com
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    
    // Expected formats:
    // - /{username}/{slug} (base link)
    // - /{username}/{slug}/{public_code} (placement link)
    if (pathParts.length < 3) {
      return new Response('Invalid redirect URL', { status: 400 });
    }
    
    const username = pathParts[1];
    const slug = pathParts[2];
    const public_code = pathParts[3] || null; // Optional path-based tracking code
    
    try {
      
      // First, find the user by username to get the numeric user_id
      const user = await env.DB.prepare(
        'SELECT id FROM users WHERE username = ? AND is_active = 1'
      ).bind(username).first();
      
      if (!user) {
        return new Response('User not found', { status: 404 });
      }
      
      
      // Find the link by numeric user_id and slug
      const link = await env.DB.prepare(
        'SELECT id, original_url FROM links WHERE user_id = ? AND slug = ? AND is_active = 1'
      ).bind(user.id, slug).first();
      
      if (!link) {
        return new Response('Link not found', { status: 404 });
      }
      
      // Validate redirect URL - only allow http:// and https://
      const normalizedUrl = link.original_url.toLowerCase().trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        return new Response('Invalid redirect URL', { status: 400 });
      }
      
      // Get source from query parameter (backward compatibility) or path-based tracking code
      let source = url.searchParams.get('source');
      
      if (public_code) {
        
        // Check if public_code is a public_code (new format) or source_code (old format)
        const placement = await env.DB.prepare(
          'SELECT id, source_code, public_code, link_usage_id FROM placements WHERE link_id = ? AND public_code = ?'
        ).bind(link.id, public_code).first();
        
        if (placement) {
          // Use the source_code from the placement for tracking
          source = placement.source_code;
        } else {
          // Try looking up by source_code for backward compatibility
          
          const placementBySourceCode = await env.DB.prepare(
            'SELECT id, source_code, public_code FROM placements WHERE link_id = ? AND source_code = ?'
          ).bind(link.id, public_code).first();
          
          if (placementBySourceCode) {
            source = placementBySourceCode.source_code;
          } else {
            // Fallback to using public_code as source_code (backward compatibility)
            source = public_code;
          }
        }
      }
      
      const normalizedSource = source ? source.toLowerCase().trim().replace(/\s+/g, '') : 'direct';
      
      // Record click event
      const now = new Date().toISOString();
      const referrer = request.headers.get('referer') || null;
      const userAgent = request.headers.get('user-agent') || null;
      const ipHash = request.headers.get('cf-connecting-ip') || null;
      const linkUsageId = placement?.link_usage_id || null;

      try {
        await env.DB.prepare(
          `INSERT INTO click_events (link_id, link_usage_id, timestamp, referrer, user_agent, ip_hash, source)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(link.id, linkUsageId, now, referrer, userAgent, ipHash, normalizedSource).run();
      } catch (clickError) {
        console.error('Failed to record click:', clickError);
        // Continue with redirect even if click recording fails
      }
      
      // Redirect to original URL
      return Response.redirect(link.original_url, 302);
      
    } catch (error) {
      console.error('Redirect error:', error);
      return new Response('Internal server error: ' + error.message, { status: 500 });
    }
  }
};
