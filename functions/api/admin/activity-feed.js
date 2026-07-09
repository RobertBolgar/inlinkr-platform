/**
 * Admin endpoint for activity feed
 * 
 * SECURITY REQUIREMENTS (ALL must pass for production access):
 * 1. Authenticated user with valid Clerk JWT
 * 2. User email must match ADMIN_EMAIL_ALLOWLIST
 * 3. Valid ADMIN_TEST_KEY header
 * 
 * USAGE (set ADMIN_EMAIL_ALLOWLIST and ADMIN_TEST_KEY in your environment):
 * 
 * # Get activity feed:
 * curl -X GET https://tubelinkr.com/api/admin/activity-feed \
 *   -H "Authorization: Bearer YOUR_CLERK_JWT" \
 *   -H "x-admin-test-key: YOUR_ADMIN_TEST_KEY"
 */

import { getAuthenticatedUser } from '../auth-helper.js';

export async function onRequest(context) {
  const { request, env } = context;

  // SAFEGUARD A: Verify authenticated user
  const user = await getAuthenticatedUser(request, env);
  if (!user) {
    console.warn('ADMIN ACTIVITY-FEED: Unauthorized - no valid authenticated user');
    return new Response(JSON.stringify({ error: 'Unauthorized - authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // SAFEGUARD B: Verify admin email allowlist
  if (!env.ADMIN_EMAIL_ALLOWLIST) {
    console.error('ADMIN ACTIVITY-FEED: ADMIN_EMAIL_ALLOWLIST not configured');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const allowedEmails = env.ADMIN_EMAIL_ALLOWLIST.split(',').map(e => e.trim().toLowerCase());
  if (!allowedEmails.includes(user.email.toLowerCase())) {
    console.warn(`ADMIN ACTIVITY-FEED: Forbidden - user email ${user.email} not in allowlist`);
    return new Response(JSON.stringify({ error: 'Forbidden - admin access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // SAFEGUARD C: Verify admin test key
  const adminKey = request.headers.get('x-admin-test-key');
  if (!adminKey || adminKey !== env.ADMIN_TEST_KEY) {
    console.warn(`ADMIN ACTIVITY-FEED: Unauthorized - invalid admin key from user ${user.email}`);
    return new Response(JSON.stringify({ error: 'Unauthorized - invalid admin key' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Log authorized access
  console.log(`ADMIN ACTIVITY-FEED: Authorized access by ${user.email}`);

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Fetch recent activity events with safe error handling
    // This prevents the endpoint from crashing if activity_events table doesn't exist
    let events = [];
    try {
      const result = await env.DB.prepare(`
        SELECT id, event_type, target_user_id, event_title, event_description, metadata_json, severity, visibility_scope, created_at
        FROM activity_events
        ORDER BY created_at DESC
        LIMIT 25
      `).all();
      
      events = result.results || [];
    } catch (error) {
      console.warn('ADMIN ACTIVITY-FEED: activity_events table does not exist yet:', error);
      // Return empty events array if table doesn't exist
      events = [];
    }

    return new Response(JSON.stringify({
      success: true,
      events
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('ADMIN ACTIVITY-FEED error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
