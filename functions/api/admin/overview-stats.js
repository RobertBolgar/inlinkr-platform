/**
 * Admin endpoint for platform overview statistics
 * 
 * SECURITY REQUIREMENTS (ALL must pass for production access):
 * 1. Authenticated user with valid Clerk JWT
 * 2. User email must match ADMIN_EMAIL_ALLOWLIST
 * 3. Valid ADMIN_TEST_KEY header
 * 
 * USAGE (set ADMIN_EMAIL_ALLOWLIST and ADMIN_TEST_KEY in your environment):
 * 
 * # Get overview stats:
 * curl -X GET https://tubelinkr.com/api/admin/overview-stats \
 *   -H "Authorization: Bearer YOUR_CLERK_JWT" \
 *   -H "x-admin-test-key: YOUR_ADMIN_TEST_KEY"
 */

import { getAuthenticatedUser } from '../auth-helper.js';

export async function onRequest(context) {
  const { request, env } = context;

  // SAFEGUARD A: Verify authenticated user
  const user = await getAuthenticatedUser(request, env);
  if (!user) {
    console.warn('ADMIN OVERVIEW-STATS: Unauthorized - no valid authenticated user');
    return new Response(JSON.stringify({ error: 'Unauthorized - authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // SAFEGUARD B: Verify admin email allowlist
  if (!env.ADMIN_EMAIL_ALLOWLIST) {
    console.error('ADMIN OVERVIEW-STATS: ADMIN_EMAIL_ALLOWLIST not configured');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const allowedEmails = env.ADMIN_EMAIL_ALLOWLIST.split(',').map(e => e.trim().toLowerCase());
  if (!allowedEmails.includes(user.email.toLowerCase())) {
    console.warn(`ADMIN OVERVIEW-STATS: Forbidden - user email ${user.email} not in allowlist`);
    return new Response(JSON.stringify({ error: 'Forbidden - admin access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // SAFEGUARD C: Verify admin test key
  const adminKey = request.headers.get('x-admin-test-key');
  if (!adminKey || adminKey !== env.ADMIN_TEST_KEY) {
    console.warn(`ADMIN OVERVIEW-STATS: Unauthorized - invalid admin key from user ${user.email}`);
    return new Response(JSON.stringify({ error: 'Unauthorized - invalid admin key' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Log authorized access
  console.log(`ADMIN OVERVIEW-STATS: Authorized access by ${user.email}`);

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Fetch stats with individual error handling for optional tables
    // This prevents the entire endpoint from crashing if tables don't exist in preview/pro-dev
    const getSafeCount = async (query, ...bindParams) => {
      try {
        const stmt = env.DB.prepare(query);
        const result = bindParams.length > 0 ? stmt.bind(...bindParams).first() : stmt.first();
        return result;
      } catch (error) {
        console.warn(`Admin overview-stats: Query failed for "${query}":`, error);
        return null;
      }
    };

    const [
      totalUsersResult,
      freeUsersResult,
      proUsersResult,
      founderUsersResult,
      activeCreatorHubsResult,
      totalSmartLinksResult,
      totalTrackedClicksResult,
      totalProofsGeneratedResult,
    ] = await Promise.all([
      // Total active users
      getSafeCount('SELECT COUNT(*) as count FROM users WHERE is_active = 1'),
      
      // Free users (plan is NULL or 'free')
      getSafeCount('SELECT COUNT(*) as count FROM users WHERE is_active = 1 AND (plan IS NULL OR plan = ?)', 'free'),
      
      // Pro users (plan is 'pro' or 'pro_plus')
      getSafeCount('SELECT COUNT(*) as count FROM users WHERE is_active = 1 AND plan IN (?, ?)', 'pro', 'pro_plus'),
      
      // Founder users
      getSafeCount('SELECT COUNT(*) as count FROM founder_access'),
      
      // Active creator hubs (optional table - may not exist in preview)
      getSafeCount('SELECT COUNT(*) as count FROM creator_hub_settings'),
      
      // Total smart links (active)
      getSafeCount('SELECT COUNT(*) as count FROM links WHERE is_active = 1'),
      
      // Total tracked clicks
      getSafeCount('SELECT COUNT(*) as count FROM click_events'),
      
      // Total proofs generated (optional table - may not exist in preview)
      getSafeCount('SELECT COUNT(*) as count FROM proof_shares'),
    ]);

    const stats = {
      totalUsers: totalUsersResult?.count || 0,
      freeUsers: freeUsersResult?.count || 0,
      proUsers: proUsersResult?.count || 0,
      founderUsers: founderUsersResult?.count || 0,
      activeCreatorHubs: activeCreatorHubsResult?.count || 0,
      totalSmartLinks: totalSmartLinksResult?.count || 0,
      totalTrackedClicks: totalTrackedClicksResult?.count || 0,
      totalProofsGenerated: totalProofsGeneratedResult?.count || 0,
    };

    return new Response(JSON.stringify({
      success: true,
      stats
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Admin overview-stats error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
