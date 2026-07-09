import { tryQualifyReferral } from './referral-helper.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  
  // Expected formats for public URLs:
  // - /{userId}/{slug} (base link)
  // - /{userId}/{slug}/{publicCode} (placement link)
  if (pathParts.length < 3) {
    return new Response('Invalid redirect URL', { status: 400 });
  }
  
  const username = pathParts[1];
  const slug = pathParts[2];
  const trackingCode = pathParts[3] || null; // Optional path-based tracking code
  
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
    
    // Get source from query parameter (backward compatibility) or path-based tracking code
    let source = url.searchParams.get('source');
    if (trackingCode) {
      // Check if trackingCode is a public_code (new format) or source_code (old format)
      const placement = await env.DB.prepare(
        'SELECT id, source_code, public_code FROM placements WHERE link_id = ? AND public_code = ?'
      ).bind(link.id, trackingCode).first();
      
      if (placement) {
        // Use the source_code from the placement for tracking
        source = placement.source_code;
      } else {
        // Try looking up by source_code for backward compatibility
        const placementBySourceCode = await env.DB.prepare(
          'SELECT id, source_code, public_code FROM placements WHERE link_id = ? AND source_code = ?'
        ).bind(link.id, trackingCode).first();
        
        if (placementBySourceCode) {
          source = placementBySourceCode.source_code;
        } else {
          // Fallback to using trackingCode as source_code (backward compatibility)
          source = trackingCode;
        }
      }
    }
    const normalizedSource = source ? source.toLowerCase().trim() : 'direct';
    
    // Record click event
    const now = new Date().toISOString();
    const referrer = request.headers.get('referer') || null;
    const userAgent = request.headers.get('user-agent') || null;
    const rawIp = request.headers.get('cf-connecting-ip') || null;
    const ipHash = rawIp ? await (await import('./referral-helper.js')).hashIpAddress(rawIp) : null;
    
    try {
      await env.DB.prepare(
        `INSERT INTO click_events (link_id, timestamp, referrer, user_agent, ip_hash, source)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(link.id, now, referrer, userAgent, ipHash, normalizedSource).run();
      
      // Try to qualify referral after successful click recording
      try {
        console.log(`[REFERRAL QUALIFY DEBUG] calling tryQualifyReferral`);
        const qualifyResult = await tryQualifyReferral(env, user.id.toString());
        console.log(`[REFERRAL QUALIFY DEBUG] tryQualifyReferral result:`, qualifyResult);
      } catch (referralError) {
        console.warn('Referral qualification check failed:', referralError);
        // Continue with redirect even if referral qualification fails
      }
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
