/**
 * Rate limiting helper for TubeLinkr API routes
 * Uses Cloudflare Workers Rate Limiting binding
 */

/**
 * Check rate limit for a given key
 * @param {object} env - Cloudflare environment with RATE_LIMITER binding
 * @param {string} key - Unique identifier for the rate limit (user ID or IP)
 * @param {object} options - Rate limit options
 * @param {number} options.limit - Number of requests allowed
 * @param {number} options.period - Time period in seconds
 * @returns {object} - Rate limit check result { success: boolean, remaining?: number }
 */
export async function checkRateLimit(env, key, { limit, period }) {
  try {
    if (!env.RATE_LIMITER) {
      // Rate limiter not configured, allow request
      return { success: true };
    }

    const limitKey = `tubelinkr:${key}`;
    
    // Check rate limit using Cloudflare Workers Rate Limiting
    const result = await env.RATE_LIMITER.limit({
      key: limitKey,
      limit: limit,
      period: period,
    });

    return {
      success: result.success,
      remaining: result.remaining,
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // On error, allow request to avoid blocking legitimate traffic
    return { success: true };
  }
}

/**
 * Get rate limit key for authenticated user
 * @param {string} userId - User ID
 * @returns {string} - Rate limit key
 */
export function getUserRateLimitKey(userId) {
  return `user:${userId}`;
}

/**
 * Get rate limit key for anonymous request (IP-based)
 * @param {object} request - Request object
 * @returns {string} - Rate limit key based on IP
 */
export function getIpRateLimitKey(request) {
  const cf = request.cf;
  const ip = cf?.colo || request.headers.get('CF-Connecting-IP') || 'unknown';
  return `ip:${ip}`;
}

/**
 * Rate limit configurations for different actions
 */
export const RATE_LIMITS = {
  CREATE_LINK: { limit: 20, period: 3600 }, // 20 per hour
  CREATE_PLACEMENT: { limit: 60, period: 3600 }, // 60 per hour
  ANONYMOUS_POST: { limit: 10, period: 600 }, // 10 per 10 minutes
  ANALYTICS: { limit: 100, period: 3600 }, // 100 per hour
};

/**
 * Create a 429 Too Many Requests response
 * @param {string} message - User-friendly error message
 * @returns {Response} - 429 response
 */
export function createRateLimitResponse(message = 'Too many requests. Please try again later.') {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
