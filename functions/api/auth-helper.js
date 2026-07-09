// Authentication helper for Cloudflare Pages Functions
// Verifies Clerk JWT signatures using RS256 + JWKS before trusting any claims.
//
// Required Cloudflare Pages env var:
//   CLERK_JWKS_URL — e.g. https://<your-frontend-api>/.well-known/jwks.json
//   Source: Clerk Dashboard → API Keys → Advanced → JWKS URL
//
// If CLERK_JWKS_URL is missing the function fails closed with a logged error
// and returns null (callers return 401/500 as appropriate).

/**
 * Decode a base64url-encoded string to a Uint8Array.
 */
function base64UrlDecode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/**
 * Fetch Clerk's JWKS and find the key matching the JWT's kid header.
 * Returns a CryptoKey suitable for RS256 verification, or null on failure.
 */
async function getVerificationKey(jwksUrl, kid) {
  const response = await fetch(jwksUrl, {
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!response.ok) {
    console.error('Failed to fetch JWKS:', response.status);
    return null;
  }
  const { keys } = await response.json();
  if (!Array.isArray(keys) || keys.length === 0) {
    console.error('JWKS contained no keys');
    return null;
  }
  const jwk = kid ? keys.find((k) => k.kid === kid) : keys[0];
  if (!jwk) {
    console.error('No matching JWK found for kid:', kid);
    return null;
  }
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

/**
 * Verify Clerk JWT signature and claims, then return the sub (clerkUserId).
 * Returns null on any failure — no silent fallback to decode-only.
 */
async function verifyClerkJwt(token, jwksUrl) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    console.error('Invalid JWT format');
    return null;
  }

  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
  } catch {
    console.error('JWT decode error');
    return null;
  }

  if (header.alg !== 'RS256') {
    console.error('Unexpected JWT algorithm:', header.alg);
    return null;
  }

  const key = await getVerificationKey(jwksUrl, header.kid);
  if (!key) return null;

  const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = base64UrlDecode(parts[2]);

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signature,
    signingInput
  );

  if (!valid) {
    console.error('JWT signature verification failed');
    return null;
  }

  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && now >= payload.exp) {
    console.error('JWT expired');
    return null;
  }

  if (payload.nbf && now < payload.nbf) {
    console.error('JWT not yet valid');
    return null;
  }

  if (!payload.sub) {
    console.error('JWT missing sub claim');
    return null;
  }

  return payload.sub;
}

/**
 * Verify Clerk JWT and extract user_id from database.
 * @param {Request} request - The incoming request
 * @param {Object} env - Cloudflare environment with DB binding and CLERK_JWKS_URL
 * @returns {Object|null} User object if authenticated, null otherwise
 */
export async function getAuthenticatedUser(request, env) {
  try {
    if (!env.CLERK_JWKS_URL) {
      console.error(
        'CLERK_JWKS_URL is not configured. ' +
        'Set it in Cloudflare Pages → Settings → Environment variables. ' +
        'Value: https://<your-frontend-api>/.well-known/jwks.json ' +
        '(found in Clerk Dashboard → API Keys → Advanced → JWKS URL)'
      );
      return null;
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);

    const clerkUserId = await verifyClerkJwt(token, env.CLERK_JWKS_URL);
    if (!clerkUserId) {
      return null;
    }

    const user = await env.DB.prepare(
      `SELECT 
        u.id, u.clerk_user_id, u.email, u.first_name, u.plan, u.subscription_status, 
        u.subscription_current_period_end, u.referral_reward_active, u.referral_reward_plan, 
        u.referral_reward_expires_at, u.subdomain, u.username, u.stripe_customer_id, 
        u.stripe_subscription_id,
        EXISTS(SELECT 1 FROM founder_access WHERE user_id = u.id) as has_founder_access
       FROM users u
       WHERE u.clerk_user_id = ? AND u.is_active = 1`
    ).bind(clerkUserId).first();

    if (!user) {
      console.error('User not found in database for clerk_user_id:', clerkUserId);
      return null;
    }

    return user;
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

/**
 * Verify Clerk JWT and return clerk_user_id without requiring database user.
 * Used for /api/users/sync to allow new user creation.
 * @param {Request} request - The incoming request
 * @param {Object} env - Cloudflare environment with CLERK_JWKS_URL
 * @returns {Object|null} Object with clerk_user_id if authenticated, null otherwise
 */
export async function getAuthenticatedUserForSync(request, env) {
  try {
    if (!env.CLERK_JWKS_URL) {
      console.error(
        'CLERK_JWKS_URL is not configured. ' +
        'Set it in Cloudflare Pages → Settings → Environment variables. ' +
        'Value: https://<your-frontend-api>/.well-known/jwks.json ' +
        '(found in Clerk Dashboard → API Keys → Advanced → JWKS URL)'
      );
      return null;
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);

    const clerkUserId = await verifyClerkJwt(token, env.CLERK_JWKS_URL);
    if (!clerkUserId) {
      return null;
    }

    // Return clerk_user_id without requiring database user existence
    // Allows /api/users/sync to create new users
    return { clerk_user_id: clerkUserId };
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

/**
 * Verify that a link belongs to the authenticated user
 * @param {string} linkId - The link ID to check
 * @param {number} userId - The authenticated user's ID
 * @param {Object} env - Cloudflare environment with DB binding
 * @returns {boolean} True if user owns the link, false otherwise
 */
export async function verifyLinkOwnership(linkId, userId, env) {
  try {
    const link = await env.DB.prepare(
      'SELECT user_id FROM links WHERE id = ? AND is_active = 1'
    ).bind(linkId).first();

    return link && link.user_id === userId;
  } catch (error) {
    console.error('Ownership verification error:', error);
    return false;
  }
}

/**
 * Verify that all link_ids belong to the authenticated user
 * @param {string[]} linkIds - Array of link IDs to check
 * @param {number} userId - The authenticated user's ID
 * @param {Object} env - Cloudflare environment with DB binding
 * @returns {boolean} True if user owns all links, false otherwise
 */
export async function verifyMultipleLinkOwnership(linkIds, userId, env) {
  try {
    if (!linkIds || linkIds.length === 0) {
      return true;
    }

    const placeholders = linkIds.map(() => '?').join(',');
    const { results } = await env.DB.prepare(
      `SELECT user_id FROM links WHERE id IN (${placeholders}) AND is_active = 1`
    ).bind(...linkIds).all();

    if (!results || results.length === 0) {
      return false;
    }

    // Check if all links belong to the user
    return results.every(link => link.user_id === userId);
  } catch (error) {
    console.error('Multiple ownership verification error:', error);
    return false;
  }
}
