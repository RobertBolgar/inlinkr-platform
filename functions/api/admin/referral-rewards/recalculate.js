import { checkAndGrantReferralRewards } from '../../referral-helper.js';

/**
 * Admin endpoint to recalculate referral rewards for a specific user
 * 
 * USAGE (set ADMIN_TEST_KEY in your environment first):
 * 
 * # Recalculate referral rewards for user:
 * curl -X POST https://tubelinkr.com/api/admin/referral-rewards/recalculate \
 *   -H "Content-Type: application/json" \
 *   -H "x-admin-test-key: YOUR_ADMIN_TEST_KEY" \
 *   -d '{"userId": "8"}'
 */

export async function onRequest(context) {
  const { request, env } = context;

  // SAFEGUARD: Production host guard
  const host = request.headers.get('host');
  const productionHosts = ['tubelinkr.com', 'www.tubelinkr.com'];
  if (productionHosts.includes(host)) {
    console.warn(`ADMIN REWARDS RECALCULATE: Blocked on production host: ${host}`);
    return new Response(JSON.stringify({ error: 'Not allowed on production domain' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify admin test key
  const adminKey = request.headers.get('x-admin-test-key');
  if (!adminKey || adminKey !== env.ADMIN_TEST_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { userId } = body;

    if (!userId) {
      return new Response(JSON.stringify({ 
        error: 'Missing userId parameter',
        success: false 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[ADMIN REWARDS DEBUG] Recalculating rewards for user: ${userId}`);

    // Validate user exists
    const { results: userCheck } = await env.DB.prepare(`
      SELECT id, email, plan, subscription_status FROM users WHERE id = ?
    `).bind(userId).all();

    if (userCheck.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'User not found',
        success: false,
        userId 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const user = userCheck[0];
    console.log(`[ADMIN REWARDS DEBUG] Found user, plan: ${user.plan}, status: ${user.subscription_status}`);

    // Call the reward checking function
    const result = await checkAndGrantReferralRewards(env, userId);
    
    console.log(`[ADMIN REWARDS DEBUG] Recalculation result:`, result);

    return new Response(JSON.stringify({
      success: true,
      userId,
      user: {
        email: user.email,
        currentPlan: user.plan,
        subscriptionStatus: user.subscription_status
      },
      result
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ADMIN REWARDS DEBUG] Error in reward recalculation:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
