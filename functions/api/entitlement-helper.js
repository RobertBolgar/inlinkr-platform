/**
 * Backend Entitlement Helper
 * 
 * Provides consistent entitlement checks across all backend endpoints.
 * Mirrors the frontend getEffectivePlan logic from src/lib/plan.ts.
 * 
 * Priority order (matches frontend):
 * 1. Founder access (highest priority, separate entitlement layer)
 * 2. Active paid subscription
 * 3. Active referral reward
 * 4. Default to free
 */

/**
 * Check if user has effective Pro access (paid Pro, referral Pro, or Founder)
 * @param {Object} user - User object from database
 * @returns {boolean} - true if user has effective Pro access
 */
export function hasEffectiveProAccess(user) {
  if (!user) return false;

  // Priority 1: Founder access (highest priority, separate entitlement layer)
  // Founder access is permanent and overrides all other entitlements
  // Use boolean field from DB query (EXISTS check on founder_access table)
  if (user.has_founder_access === 1 || user.has_founder_access === true) {
    return true;
  }

  // Priority 2: Active paid subscription
  if (user.subscription_status === 'active') {
    return user.plan === 'pro_plus' || user.plan === 'pro';
  }

  // Priority 3: Active referral reward (NEVER grants Pro+, only Pro)
  // Use truthy check (handles both 1 and true from DB/JSON)
  if (user.referral_reward_active && user.referral_reward_expires_at) {
    const expirationDate = new Date(user.referral_reward_expires_at);
    if (expirationDate > new Date()) {
      // Referral rewards only grant Pro, never Pro+
      return user.referral_reward_plan === 'pro';
    }
  }

  // Priority 4: Default to free
  return false;
}

/**
 * Check if user has Founder access
 * @param {Object} user - User object from database
 * @returns {boolean} - true if user has Founder access
 */
export function hasFounderAccess(user) {
  if (!user) return false;
  return user.has_founder_access === 1 || user.has_founder_access === true;
}

/**
 * Get user's effective plan (matches frontend getEffectivePlan)
 * @param {Object} user - User object from database
 * @returns {string} - 'free', 'pro', 'pro_plus', or 'founder'
 */
export function getEffectiveBackendPlan(user) {
  if (!user) return 'free';

  // Priority 1: Founder access (highest priority, separate entitlement layer)
  if (user.has_founder_access === 1 || user.has_founder_access === true) {
    return 'founder';
  }

  // Priority 2: Active paid subscription
  if (user.subscription_status === 'active') {
    return user.plan === 'pro_plus' ? 'pro_plus' : user.plan === 'pro' ? 'pro' : 'free';
  }

  // Priority 3: Active referral reward (NEVER grants Pro+, only Pro)
  if (user.referral_reward_active && user.referral_reward_expires_at) {
    const expirationDate = new Date(user.referral_reward_expires_at);
    if (expirationDate > new Date()) {
      // Referral rewards only grant Pro, never Pro+
      return user.referral_reward_plan === 'pro' ? 'pro' : 'free';
    }
  }

  // Priority 4: Default to free
  return 'free';
}

/**
 * Get proof limit for user based on effective plan
 * @param {Object} user - User object from database
 * @returns {number|string} - Number limit or 'unlimited' for Founder
 */
export function getProofLimit(user) {
  const effectivePlan = getEffectiveBackendPlan(user);
  
  switch (effectivePlan) {
    case 'founder':
      return 'unlimited';
    case 'pro':
    case 'pro_plus':
      return 100;
    case 'free':
    default:
      return 10;
  }
}
