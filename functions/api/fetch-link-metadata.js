import { getAuthenticatedUser } from './auth-helper.js';

// SSRF Protection: Validate URL and prevent internal network access
function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // Only allow http and https protocols
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return false;
    }
    
    // Reject URLs with username/password credentials
    if (urlObj.username || urlObj.password) {
      return false;
    }
    
    const hostname = urlObj.hostname.toLowerCase();
    
    // Reject localhost and loopback addresses
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return false;
    }
    
    // Reject private IP ranges (IPv4)
    const ipv4Pattern = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
    const match = hostname.match(ipv4Pattern);
    if (match) {
      const [, a, b, c, d] = match.map(Number);
      // 10.0.0.0/8
      if (a === 10) return false;
      // 172.16.0.0/12
      if (a === 172 && b >= 16 && b <= 31) return false;
      // 192.168.0.0/16
      if (a === 192 && b === 168) return false;
      // 127.0.0.0/8 (loopback)
      if (a === 127) return false;
      // 0.0.0.0
      if (a === 0 && b === 0 && c === 0 && d === 0) return false;
      // 169.254.0.0/16 (link-local)
      if (a === 169 && b === 254) return false;
    }
    
    // Reject private IP ranges (IPv6)
    if (hostname.startsWith('fc00:') || hostname.startsWith('fd00:') || // Unique local (fc00::/7)
        hostname.startsWith('fe80:') || // Link-local (fe80::/10)
        hostname.startsWith('::1') || // Loopback
        hostname.startsWith('::ffff:127.') || // IPv4-mapped loopback
        hostname.startsWith('::ffff:10.') || // IPv4-mapped 10.0.0.0/8
        hostname.startsWith('::ffff:172.16.') || // IPv4-mapped 172.16.0.0/12
        hostname.startsWith('::ffff:192.168.')) { // IPv4-mapped 192.168.0.0/16
      return false;
    }
    
    // Reject internal network keywords
    if (hostname.includes('local') || hostname.includes('internal')) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

// SSRF Protection: Revalidate redirect URLs before following
function isValidRedirectUrl(url) {
  return isValidUrl(url);
}

export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    // Require JWT authentication to prevent unauthenticated SSRF attacks
    const user = await getAuthenticatedUser(request, env);
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const { url } = await request.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // SSRF Protection: Validate URL format and block internal networks
    if (!isValidUrl(url)) {
      return new Response(
        JSON.stringify({ error: 'Invalid URL format or blocked target' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Fetch the URL with timeout, redirect control, and browser-like headers
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    let response;
    let redirectCount = 0;
    const maxRedirects = 2;
    let currentUrl = url;
    
    while (redirectCount <= maxRedirects) {
      response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual', // Manual redirect handling for SSRF protection
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; TubeLinkrBot/1.0; +https://tubelinkr.com)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9"
        }
      });
      
      // Handle redirects manually with revalidation
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('Location');
        if (!location) {
          break;
        }
        
        // Revalidate redirect URL to prevent SSRF
        const redirectUrl = new URL(location, currentUrl).toString();
        if (!isValidRedirectUrl(redirectUrl)) {
          return new Response(
            JSON.stringify({ 
              success: false,
              error: "Could not fetch link details. You can still enter them manually." 
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        currentUrl = redirectUrl;
        redirectCount++;
        
        if (redirectCount > maxRedirects) {
          break;
        }
        
        continue;
      }
      
      break;
    }
    
    clearTimeout(timeoutId);
    
    if (!response || !response.ok) {
      // Generic client-safe error messages
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Could not fetch link details. You can still enter them manually." 
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Read limited content (256KB max) - metadata is usually in the head section
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let content = '';
    let totalBytes = 0;
    const maxBytes = 262144; // 256KB
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      totalBytes += value.length;
      if (totalBytes > maxBytes) {
        // We've read enough to extract metadata, stop reading
        break;
      }
      
      content += decoder.decode(value, { stream: true });
    }
    
    reader.releaseLock();
    
    // Extract metadata with priority order
    let title = '';
    let description = '';
    
    // Try to parse HTML
    try {
      // Simple regex-based extraction (more reliable than DOM parsing in edge functions)
      const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].trim();
      }
      
      // Extract OG title
      const ogTitleMatch = content.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i);
      if (ogTitleMatch) {
        title = ogTitleMatch[1].trim();
      }
      
      // Extract Twitter title
      const twitterTitleMatch = content.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["'][^>]*>/i);
      if (twitterTitleMatch) {
        title = twitterTitleMatch[1].trim();
      }
      
      // Extract OG description
      const ogDescMatch = content.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
      if (ogDescMatch) {
        description = ogDescMatch[1].trim();
      }
      
      // Extract Twitter description
      const twitterDescMatch = content.match(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
      if (twitterDescMatch) {
        description = twitterDescMatch[1].trim();
      }
      
      // Extract meta description as fallback
      const metaDescMatch = content.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
      if (metaDescMatch && !description) {
        description = metaDescMatch[1].trim();
      }
      
    } catch (parseError) {
      console.error('Error parsing HTML:', parseError);
      // Continue with whatever we got
    }
    
    // Generate slug from title
    let slug = '';
    if (title) {
      slug = title
        .toLowerCase()
        .replace(/[^a-z0-9-\s]/g, '')
        .replace(/\s+/g, '-')
        .replace(/--+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50); // Limit length
    }
    
    // Clean up the extracted data
    title = title.substring(0, 200); // Limit title length
    description = description.substring(0, 500); // Limit description length
    
    // If no metadata found, return friendly error
    if (!title && !description) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Could not find link details. You can still enter them manually." 
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        title: title || null,
        description: description || null,
        slug: slug || null
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
        } 
      }
    );
    
  } catch (error) {
    console.error('Error fetching link metadata:', error);
    
    // Generic client-safe error message (no raw error details)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: "Could not fetch link details. You can still enter them manually." 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
