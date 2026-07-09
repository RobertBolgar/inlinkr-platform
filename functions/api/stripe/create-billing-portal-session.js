import { getAuthenticatedUser } from '../auth-helper.js';

// Validate and sanitize Origin header to prevent open redirect attacks
// Only allow known TubeLinkr domains for Stripe return URLs
function getAllowedAppOrigin(request) {
  const rawOrigin = request.headers.get('origin');
  
  // Allowed origins for Stripe return URLs
  const allowedOrigins = new Set([
    'https://tubelinkr.com',
    'https://www.tubelinkr.com',
    'https://pro-dev.tubelinkr.com',
    'https://free-dev.tubelinkr.com',
  ]);
  
  // Only use Origin if it matches the allowlist
  if (rawOrigin && allowedOrigins.has(rawOrigin)) {
    return rawOrigin;
  }
  
  // Fallback to production origin
  return 'https://tubelinkr.com';
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const user = await getAuthenticatedUser(request, env);
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!env.STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: 'Stripe secret key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!user.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: 'Billing portal is only available for paid subscriptions.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Referral-only Pro users must not access billing portal
    // Only users with an active paid Stripe subscription may proceed
    const isActivePaidSubscription = user.subscription_status === 'active' &&
      (user.plan === 'pro' || user.plan === 'pro_plus');

    if (!isActivePaidSubscription) {
      return new Response(
        JSON.stringify({ error: 'Billing portal is only available for paid subscriptions.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Use sanitized origin for return URL
    const origin = getAllowedAppOrigin(request);

    // Create billing portal session using Stripe API directly
    const params = new URLSearchParams();
    params.append('customer', user.stripe_customer_id);
    params.append('return_url', `${origin}/upgrade`);

    const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const portalSession = await response.json();

    if (!response.ok) {
      throw new Error(portalSession.error?.message || 'Failed to create billing portal session');
    }

    return new Response(
      JSON.stringify({ url: portalSession.url }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating billing portal session:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create billing portal session' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
