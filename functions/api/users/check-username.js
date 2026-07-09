import { getAuthenticatedUser } from '../auth-helper.js';

// Reserved subdomains that cannot be used as usernames
const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'go', 'clerk', 'support', 'accounts',
  'pro-dev', 'free-dev', 'staging', 'prod', 'admin',
  'mail', 'ftp', 'smtp', 'imap', 'pop', 'ns', 'dns'
]);

/**
 * Check if user has effective Pro access (paid Pro, referral Pro, or Founder)
 * @param {Object} user - User object from database
 * @returns {boolean} - true if user has effective Pro access
 */
function hasEffectiveProAccess(user) {
  if (!user) return false;

  // Priority 1: Founder access (highest priority, separate entitlement layer)
  if (user.has_founder_access === 1 || user.has_founder_access === true) {
    return true;
  }

  // Priority 2: Active paid subscription
  if (user.subscription_status === 'active') {
    return user.plan === 'pro_plus' || user.plan === 'pro';
  }

  // Priority 3: Active referral reward (NEVER grants Pro+, only Pro)
  if (user.referral_reward_active && user.referral_reward_expires_at) {
    const expirationDate = new Date(user.referral_reward_expires_at);
    if (expirationDate > new Date()) {
      return user.referral_reward_plan === 'pro';
    }
  }

  // Priority 4: Default to free
  return false;
}

function isValidUsername(username) {
  // Check length
  if (username.length < 3 || username.length > 30) {
    return { valid: false, error: 'Username must be 3-30 characters' };
  }
  
  // DNS-safe: lowercase letters, numbers, hyphens only
  // No underscores, no uppercase, no special chars
  if (!/^[a-z0-9-]+$/.test(username)) {
    return { valid: false, error: 'Username can only contain lowercase letters, numbers, and hyphens' };
  }
  
  // No leading or trailing hyphen
  if (username.startsWith('-') || username.endsWith('-')) {
    return { valid: false, error: 'Username cannot start or end with a hyphen' };
  }
  
  // No consecutive hyphens
  if (username.includes('--')) {
    return { valid: false, error: 'Username cannot contain consecutive hyphens' };
  }
  
  // Check reserved names
  if (RESERVED_SUBDOMAINS.has(username)) {
    return { valid: false, error: 'This username is reserved' };
  }
  
  return { valid: true };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const username = url.searchParams.get('username');

  if (!username) {
    return new Response(JSON.stringify({ 
      available: false, 
      reason: 'Username is required' 
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify JWT authentication to check plan
  const authenticatedUser = await getAuthenticatedUser(request, env);
  
  // If authenticated, check if user has Pro access
  if (authenticatedUser) {
    // Get user with plan and founder access status
    const user = await env.DB.prepare(
      `SELECT 
        u.plan, u.subscription_status, 
        u.referral_reward_active, u.referral_reward_plan, u.referral_reward_expires_at,
        EXISTS(SELECT 1 FROM founder_access WHERE user_id = u.id) as has_founder_access
       FROM users u
       WHERE u.clerk_user_id = ? AND u.is_active = 1`
    ).bind(authenticatedUser.clerk_user_id).first();

    // If user exists and is free, block username checking
    if (user && !hasEffectiveProAccess(user)) {
      return new Response(
        JSON.stringify({ 
          available: false, 
          reason: 'Custom usernames are available on Pro. Upgrade to Pro to claim a custom username.' 
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Normalize to lowercase and trim
  const normalizedUsername = username.toLowerCase().trim();

  // Validate username format
  const validation = isValidUsername(normalizedUsername);
  if (!validation.valid) {
    return new Response(JSON.stringify({ 
      available: false, 
      reason: validation.error 
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Check if username is already taken
    const existingUsername = await env.DB.prepare(
      'SELECT id FROM users WHERE username = ? AND is_active = 1'
    ).bind(normalizedUsername).first();

    if (existingUsername) {
      return new Response(JSON.stringify({ 
        available: false, 
        reason: 'Username is already taken' 
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if subdomain is already taken
    const existingSubdomain = await env.DB.prepare(
      'SELECT id FROM users WHERE subdomain = ? AND is_active = 1'
    ).bind(normalizedUsername).first();

    if (existingSubdomain) {
      return new Response(JSON.stringify({ 
        available: false, 
        reason: 'This username is not available' 
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Username is available
    return new Response(JSON.stringify({ 
      available: true 
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error checking username availability:', error);
    return new Response(JSON.stringify({ 
      available: false, 
      reason: 'Error checking username availability' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestPost(context) {
  return new Response(JSON.stringify({ error: 'Use GET method to check username availability' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}
