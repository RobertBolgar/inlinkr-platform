import { getAuthenticatedUser } from '../auth-helper.js';
import { getConfig } from '../../lib/config.js';

// Validate and sanitize Origin header to prevent open redirect attacks
// Only allow known TubeLinkr domains for Stripe return URLs
function getAllowedAppOrigin(request, env) {
  const rawOrigin = request.headers.get('origin');
  const config = getConfig(env);
  
  // Allowed origins for Stripe return URLs
  const allowedOrigins = new Set([
    config.appBaseUrl,
    'https://tubelinkr.com',
    'https://www.tubelinkr.com',
    'https://pro-dev.tubelinkr.com',
    'https://free-dev.tubelinkr.com',
  ]);
  
  // Only use Origin if it matches the allowlist
  if (rawOrigin && allowedOrigins.has(rawOrigin)) {
    return rawOrigin;
  }
  
  // Fallback to configured app base URL
  return config.appBaseUrl;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const config = getConfig(env);

  // Check if Stripe is enabled
  if (!config.stripe.enabled) {
    return new Response(
      JSON.stringify({ error: 'Stripe payments are disabled in this environment' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const user = await getAuthenticatedUser(request, env);
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { plan, billingInterval } = body;

    if (!plan) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: plan' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!config.stripe.secretKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe secret key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate plan: 'pro' and 'founder' allowed publicly (pro_plus blocked for launch)
    if (plan !== 'pro' && plan !== 'founder') {
      return new Response(
        JSON.stringify({ error: 'Invalid plan' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Handle founder plan (one-time payment with cap enforcement)
    if (plan === 'founder') {
      const founderPriceId = env.FOUNDER_PRICE_ID;
      if (!founderPriceId) {
        return new Response(
          JSON.stringify({ error: 'Founder price ID not configured' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Enforce first-50 paid founder cap by counting non-comped founder access rows
      const founderCountResult = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM founder_access WHERE is_comped = 0'
      ).first();
      const founderCount = founderCountResult?.count || 0;

      if (founderCount >= 50) {
        return new Response(
          JSON.stringify({ error: 'Founder Access is sold out. Only the first 50 paid founders are accepted.' }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Use sanitized origin for return URLs
      const origin = getAllowedAppOrigin(request);

      // Create checkout session using Stripe API directly (one-time payment)
      const params = new URLSearchParams();
      params.append('mode', 'payment');
      params.append('line_items[0][price]', founderPriceId);
      params.append('line_items[0][quantity]', '1');
      params.append('customer_email', user.email);
      params.append('metadata[userId]', user.id.toString());
      params.append('metadata[plan]', 'founder');
      params.append('success_url', `${origin}/success`);
      params.append('cancel_url', `${origin}/upgrade`);

      const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      const session = await response.json();

      if (!response.ok) {
        throw new Error(session.error?.message || 'Failed to create checkout session');
      }

      return new Response(
        JSON.stringify({ 
          url: session.url,
          mode: 'checkout'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate and default billing interval for pro plan
    const validIntervals = ['monthly', 'yearly'];
    const interval = billingInterval && validIntervals.includes(billingInterval) ? billingInterval : 'monthly';

    // Select price ID based on plan (pro only) and billing interval
    let priceId;
    if (interval === 'monthly') {
      priceId = env.PRO_PRICE_ID_MONTHLY;
    } else {
      priceId = env.PRO_PRICE_ID_YEARLY;
    }

    if (!priceId) {
      return new Response(
        JSON.stringify({ error: `Price ID not configured for plan: ${plan} with billing interval: ${interval}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // If user has existing active paid subscription, update it directly
    if (user.subscription_status === 'active' && user.stripe_subscription_id && user.stripe_customer_id) {
      console.log(`Updating existing subscription ${user.stripe_subscription_id} for user ${user.id}`);

      try {
        // Retrieve existing subscription from Stripe
        const subscriptionResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${user.stripe_subscription_id}`, {
          headers: {
            'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
          },
        });

        if (!subscriptionResponse.ok) {
          const subscriptionError = await subscriptionResponse.json();
          
          // If subscription doesn't exist, clear DB and fall back to checkout
          if (subscriptionError.type === 'invalid_request_error' &&
              (subscriptionError.code === 'resource_missing' ||
               subscriptionError.message?.includes('No such subscription'))) {
            console.log(`Subscription ${user.stripe_subscription_id} not found in Stripe, clearing DB reference`);
            await env.DB.prepare(
              'UPDATE users SET stripe_subscription_id = NULL WHERE id = ?'
            ).bind(user.id).run();
            // Continue to normal checkout flow below
          } else {
            console.error('Failed to retrieve subscription:', subscriptionError);
            return new Response(
              JSON.stringify({ error: 'Failed to retrieve existing subscription. Please manage billing or try again.' }),
              { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
          }
        } else {
          const subscription = await subscriptionResponse.json();
          
          // Get subscription item ID
          const subscriptionItemId = subscription.items.data[0]?.id;
          if (!subscriptionItemId) {
            console.error('No subscription item found');
            return new Response(
              JSON.stringify({ error: 'No subscription item found. Please manage billing or try again.' }),
              { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
          }

          // Update the existing subscription
          const updateParams = new URLSearchParams();
          updateParams.append('items[0][id]', subscriptionItemId);
          updateParams.append('items[0][price]', priceId);
          updateParams.append('proration_behavior', 'always_invoice');
          updateParams.append('cancel_at_period_end', 'false');
          updateParams.append('metadata[plan]', plan);
          updateParams.append('metadata[billingInterval]', interval);
          updateParams.append('metadata[userId]', user.id.toString());

          const updateResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${user.stripe_subscription_id}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: updateParams,
          });

          if (!updateResponse.ok) {
            const updateError = await updateResponse.json();
            console.error('Failed to update subscription:', updateError);
            return new Response(
              JSON.stringify({ error: updateError.error?.message || 'Failed to update subscription. Please manage billing or try again.' }),
              { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
          }

          const updatedSubscription = await updateResponse.json();

          console.log(`Updated subscription to plan ${plan} for user - webhook will update billing state`);

          // Use sanitized origin for return URL
          const origin = getAllowedAppOrigin(request);

          return new Response(
            JSON.stringify({ 
              success: true,
              mode: 'subscription_update',
              url: `${origin}/success`
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } catch (error) {
        console.error('Error updating subscription:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to update subscription. Please manage billing or try again.' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Use sanitized origin for return URLs
    const origin = getAllowedAppOrigin(request);

    // Create checkout session using Stripe API directly
    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('customer_email', user.email);
    params.append('metadata[userId]', user.id.toString());
    params.append('metadata[plan]', plan);
    params.append('metadata[billingInterval]', interval);
    params.append('success_url', `${origin}/success`);
    params.append('cancel_url', `${origin}/upgrade`);

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const session = await response.json();

    if (!response.ok) {
      throw new Error(session.error?.message || 'Failed to create checkout session');
    }

    return new Response(
      JSON.stringify({ 
        url: session.url,
        mode: 'checkout'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to create checkout session' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
