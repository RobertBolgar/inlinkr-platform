// Cloudflare Pages Function - Legacy catch-all route handler
// Hardened: All DB operations removed. Legacy routes disabled.
// Dedicated route files now handle /api/users, /api/links, /api/click-events.
// Worker handles redirects at go.tubelinkr.com.

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Legacy redirect endpoint retired - use go.tubelinkr.com
    if (path.startsWith('/api/redirect')) {
      return new Response(
        JSON.stringify({ 
          error: 'Legacy redirect endpoint retired. Use go.tubelinkr.com links.' 
        }), {
          status: 410,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // All other legacy routes now return 404
    // Dedicated route files handle:
    // - /api/users (functions/api/users.js)
    // - /api/links (functions/api/links.js)
    // - /api/click-events (functions/api/click-events.js)
    // - /api/users/username (functions/api/users/username.js)
    // - /api/users/check-username (functions/api/users/check-username.js)
    // - /api/users/sync (functions/api/users/sync.js)
    // - /api/links/[id] (functions/api/links/[id].js)
    return new Response(
      JSON.stringify({ error: 'Route not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}
