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

export async function onRequestPut(context) {
  const { request, env } = context;

  try {
    // Verify JWT authentication first - do not trust body-provided identity
    const authenticatedUser = await getAuthenticatedUser(request, env);
    if (!authenticatedUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Extract body fields - clerk_user_id from body is optional and must match authenticated user
    const { username: rawUsername, clerk_user_id: bodyClerkUserId } = await request.json();
    const now = new Date().toISOString();

    // Use authenticated user's clerk_user_id as the source of truth
    const clerkUserId = authenticatedUser.clerk_user_id;

    // If body provides clerk_user_id, verify it matches for compatibility
    if (bodyClerkUserId && bodyClerkUserId !== clerkUserId) {
      return new Response(
        JSON.stringify({ error: 'User ID mismatch' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Normalize to lowercase
    const username = rawUsername?.toLowerCase().trim();
    
    // Validate username
    if (!username || typeof username !== 'string') {
      return new Response(JSON.stringify({ error: 'Username is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const validation = isValidUsername(username);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Get user by clerk_user_id with plan and founder access status
    const user = await env.DB.prepare(
      `SELECT 
        u.id, u.username, u.plan, u.subscription_status, 
        u.referral_reward_active, u.referral_reward_plan, u.referral_reward_expires_at,
        EXISTS(SELECT 1 FROM founder_access WHERE user_id = u.id) as has_founder_access
       FROM users u
       WHERE u.clerk_user_id = ? AND u.is_active = 1`
    ).bind(clerkUserId).first();
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if user has effective Pro access (paid Pro, referral Pro, or Founder)
    // Free users cannot change their username
    if (!hasEffectiveProAccess(user)) {
      return new Response(
        JSON.stringify({ error: 'Custom usernames are available on Pro. Upgrade to Pro to change your username.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if new username is already taken by another user
    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE username = ? AND id != ? AND is_active = 1'
    ).bind(username, user.id).first();
    
    if (existingUser) {
      return new Response(JSON.stringify({ error: 'Username is already taken' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Check if subdomain is already taken by another user
    const existingSubdomain = await env.DB.prepare(
      'SELECT id FROM users WHERE subdomain = ? AND id != ? AND is_active = 1'
    ).bind(username, user.id).first();
    
    if (existingSubdomain) {
      return new Response(JSON.stringify({ error: 'This username is not available' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Update username, subdomain (synced), and mark as confirmed by user
    await env.DB.prepare(
      'UPDATE users SET username = ?, subdomain = ?, username_confirmed_by_user = 1, updated_at = ? WHERE id = ?'
    ).bind(username, username, now, user.id).run();
    
    // Return updated user data
    const updatedUser = await env.DB.prepare(
      'SELECT id, email, username, clerk_user_id, created_at, updated_at, is_active FROM users WHERE id = ?'
    ).bind(user.id).first();
    
    return new Response(JSON.stringify({
      success: true,
      data: updatedUser
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating username:', error);
    return new Response(JSON.stringify({ error: 'Failed to update username' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestGet(context) {
  return new Response(JSON.stringify({ error: 'Use PUT method to update username' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}
