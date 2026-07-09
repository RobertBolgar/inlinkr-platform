/**
 * Feature flags management endpoint
 * 
 * SECURITY REQUIREMENTS (ALL must pass for production access):
 * 1. Authenticated user with valid Clerk JWT
 * 2. User email must match ADMIN_EMAIL_ALLOWLIST
 * 3. Valid ADMIN_TEST_KEY header
 * 
 * USAGE (set ADMIN_EMAIL_ALLOWLIST and ADMIN_TEST_KEY in your environment):
 * 
 * # Get current referral feature flags:
 * curl -X GET https://tubelinkr.com/api/admin/feature-flags \
 *   -H "Authorization: Bearer YOUR_CLERK_JWT" \
 *   -H "x-admin-test-key: YOUR_ADMIN_TEST_KEY"
 * 
 * # Update referral feature flag:
 * curl -X POST https://tubelinkr.com/api/admin/feature-flags \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_CLERK_JWT" \
 *   -H "x-admin-test-key: YOUR_ADMIN_TEST_KEY" \
 *   -d '{"key": "referrals_enabled", "enabled": true}'
 */

import { getAuthenticatedUser } from '../auth-helper.js';

export async function onRequest(context) {
  const { request, env } = context;

  // SAFEGUARD A: Verify authenticated user
  const user = await getAuthenticatedUser(request, env);
  if (!user) {
    console.warn('ADMIN FEATURE-FLAGS: Unauthorized - no valid authenticated user');
    return new Response(JSON.stringify({ error: 'Unauthorized - authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // SAFEGUARD B: Verify admin email allowlist
  if (!env.ADMIN_EMAIL_ALLOWLIST) {
    console.error('ADMIN FEATURE-FLAGS: ADMIN_EMAIL_ALLOWLIST not configured');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const allowedEmails = env.ADMIN_EMAIL_ALLOWLIST.split(',').map(e => e.trim().toLowerCase());
  if (!allowedEmails.includes(user.email.toLowerCase())) {
    console.warn(`ADMIN FEATURE-FLAGS: Forbidden - user email ${user.email} not in allowlist`);
    return new Response(JSON.stringify({ error: 'Forbidden - admin access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // SAFEGUARD C: Verify admin test key
  const adminKey = request.headers.get('x-admin-test-key');
  if (!adminKey || adminKey !== env.ADMIN_TEST_KEY) {
    console.warn(`ADMIN FEATURE-FLAGS: Unauthorized - invalid admin key from user ${user.email}`);
    return new Response(JSON.stringify({ error: 'Unauthorized - invalid admin key' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Log authorized access
  console.log(`ADMIN FEATURE-FLAGS: Authorized access by ${user.email}`);

  // Allowed feature flag keys
  const allowedKeys = ['referrals_enabled', 'referrals_ip_check_enabled', 'referrals_rewards_enabled'];

  try {
    if (request.method === 'GET') {
      // Get current values for referral feature flags
      const { results } = await env.DB.prepare(`
        SELECT key, enabled FROM feature_flags WHERE key IN (?, ?, ?)
      `).bind(...allowedKeys).all();

      const flags = {};
      
      // Initialize all flags to false (default)
      allowedKeys.forEach(key => {
        flags[key] = false;
      });

      // Set actual values from database
      results.forEach(row => {
        flags[row.key] = row.enabled === 1;
      });

      return new Response(JSON.stringify({
        success: true,
        flags
      }), {
        headers: { 'Content-Type': 'application/json' },
      });

    } else if (request.method === 'POST') {
      // Update feature flag
      const { key, enabled } = await request.json();

      if (!key || !allowedKeys.includes(key)) {
        return new Response(JSON.stringify({ 
          error: `Invalid key. Allowed keys: ${allowedKeys.join(', ')}` 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (typeof enabled !== 'boolean') {
        return new Response(JSON.stringify({ error: 'enabled must be a boolean' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const now = new Date().toISOString();
      const enabledValue = enabled ? 1 : 0;

      // Update or insert the feature flag
      await env.DB.prepare(`
        INSERT INTO feature_flags (key, enabled, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          enabled = excluded.enabled,
          updated_at = excluded.updated_at
      `).bind(key, enabledValue, now).run();

      return new Response(JSON.stringify({
        success: true,
        key,
        enabled,
        updated_at: now
      }), {
        headers: { 'Content-Type': 'application/json' },
      });

    } else {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Admin feature-flags error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
