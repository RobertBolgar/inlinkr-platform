/**
 * DEV/ADMIN TESTING HELPER - NOT FOR PRODUCTION BILLING
 * 
 * ⚠️  WARNING: This endpoint bypasses Stripe billing authority
 * It is ONLY for dev/admin testing on non-production domains
 * 
 * REAL BILLING FLOW: Checkout → Stripe → Webhook → Database
 * This helper should NEVER be used in production billing
 * 
 * USAGE (requires ALL safeguards to be satisfied):
 * 
 * # Enable in environment:
 * ALLOW_ADMIN_SET_PRO=true
 * ADMIN_TEST_KEY=your-secret-key
 * 
 * # Set Pro (dev only):
 * curl -X POST https://pro-dev.tubelinkr.com/api/admin/set-pro \
 *   -H "Content-Type: application/json" \
 *   -H "x-admin-test-key: YOUR_ADMIN_TEST_KEY" \
 *   -d '{"email": "user@example.com", "plan": "pro"}'
 */

export async function onRequest(context) {
  const { request, env } = context;

  // SAFEGUARD A: Environment kill switch (disabled by default)
  if (env.ALLOW_ADMIN_SET_PRO !== "true") {
    console.warn('ADMIN SET-PRO: Endpoint disabled - ALLOW_ADMIN_SET_PRO not set to "true"');
    return new Response(JSON.stringify({ error: 'Endpoint disabled' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // SAFEGUARD B: Admin secret verification
  const adminKey = request.headers.get('x-admin-test-key');
  if (!adminKey || adminKey !== env.ADMIN_TEST_KEY) {
    console.warn('ADMIN SET-PRO: Unauthorized - invalid or missing admin key');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // SAFEGUARD C: Non-production host guard
  const host = request.headers.get('host');
  const productionHosts = ['tubelinkr.com', 'www.tubelinkr.com'];
  if (productionHosts.includes(host)) {
    console.warn(`ADMIN SET-PRO: Blocked on production host: ${host}`);
    return new Response(JSON.stringify({ error: 'Not allowed on production domain' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // SAFEGUARD D: Clear audit logging (before any processing)
  console.log(`ADMIN SET-PRO: Endpoint accessed - host: ${host}, method: ${request.method}`);

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { email, plan } = await request.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!plan || !['free', 'pro', 'pro_plus'].includes(plan)) {
      return new Response(JSON.stringify({ error: 'plan must be "free", "pro", or "pro_plus"' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toISOString();
    let subscription_status;

    if (plan === 'free') {
      // Set to free
      subscription_status = 'canceled';
    } else {
      // Set to Pro or Pro+
      subscription_status = 'active';
    }

    // SAFEGUARD D: Detailed audit logging for plan changes
    console.log(`ADMIN SET-PRO: Setting user plan - email: ${email}, plan: ${plan}, subscription_status: ${subscription_status}`);

    // Update user plan (bypasses Stripe webhook - dev testing only)
    await env.DB.prepare(
      `UPDATE users 
       SET plan = ?, 
           subscription_status = ?, 
           subscription_current_period_end = NULL,
           updated_at = ? 
       WHERE email = ?`
    ).bind(plan, subscription_status, now, email).run();

    // SAFEGUARD D: Success audit logging
    console.log(`ADMIN SET-PRO: Successfully updated user - new plan: ${plan}, status: ${subscription_status}`);

    return new Response(JSON.stringify({
      success: true,
      email,
      plan,
      subscription_status,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Admin set-pro error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
