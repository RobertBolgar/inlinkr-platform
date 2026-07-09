// Feature flags
export const FEATURES = {
  YOUTUBE_SINGLE: 'youtube_single',
  YOUTUBE_MULTI: 'youtube_multi',
  CUSTOM_SUBDOMAIN: 'custom_subdomain',
} as const;

export type Feature = typeof FEATURES[keyof typeof FEATURES];

// Existing function - preserved for backward compatibility
export function isProUser(user: any): boolean {
  return user?.plan === 'pro' && (user?.subscription_status === 'active' || user?.subscription_status === 'trialing');
}

// New helpers for feature-based gating
export function hasPaidAccess(user: any): boolean {
  return user?.subscription_status === 'active';
}

// Get effective plan considering paid subscription, founder access, and referral rewards
export function getEffectivePlan(user: any): 'free' | 'pro' | 'pro_plus' | 'founder' {
  if (!user) return 'free';

  // Priority 1: Founder access (highest priority, separate entitlement layer)
  // Founder access is permanent and overrides all other entitlements
  // Use boolean field from DB query (EXISTS check on founder_access table)
  if (user.has_founder_access === 1 || user.has_founder_access === true) {
    return 'founder';
  }

  // Priority 2: Active paid subscription
  if (user.subscription_status === 'active') {
    return user.plan === 'pro_plus' ? 'pro_plus' : user.plan === 'pro' ? 'pro' : 'free';
  }

  // Priority 3: Active referral reward (NEVER grants Pro+, only Pro)
  // Use truthy check (handles both 1 and true from DB/JSON)
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

// Helper for Pro feature access based on effective plan (includes referral rewards and founder)
export function hasProAccess(user: any): boolean {
  const effectivePlan = getEffectivePlan(user);
  return effectivePlan === 'pro' || effectivePlan === 'pro_plus' || effectivePlan === 'founder';
}

// Helper for Founder access check
export function hasFounderAccess(user: any): boolean {
  return getEffectivePlan(user) === 'founder';
}

// Check if user has active referral reward
export function hasActiveReferralReward(user: any): boolean {
  if (!user) return false;
  
  // Check new model only (Phase 2C-2)
  if (user.referral_reward_active && user.referral_reward_expires_at) {
    const expirationDate = new Date(user.referral_reward_expires_at);
    return expirationDate > new Date();
  }
  
  return false;
}

// Get the reward plan from new model only
export function getReferralRewardPlan(user: any): string | undefined {
  if (!user) return undefined;
  
  // Check new model only (Phase 2C-2)
  if (user.referral_reward_active && user.referral_reward_plan) {
    return user.referral_reward_plan;
  }
  
  return undefined;
}

export function isPro(user: any): boolean {
  const ep = getEffectivePlan(user);
  return ep === 'pro' || ep === 'pro_plus';
}

export function isProPlus(_user: any): boolean {
  return false; // Pro+ hidden for launch
}

export function hasFeature(user: any, feature: Feature): boolean {
  const effectivePlan = getEffectivePlan(user);
  switch (feature) {
    case FEATURES.YOUTUBE_SINGLE:
      return true; // Allow all users (Free, Pro, Pro+) to connect single YouTube channel
    case FEATURES.YOUTUBE_MULTI:
      return false; // Pro+ feature hidden for launch
    case FEATURES.CUSTOM_SUBDOMAIN:
      return effectivePlan === 'pro' || effectivePlan === 'pro_plus' || effectivePlan === 'founder';
    default:
      return false;
  }
}

export function getNextPlan(user: any) {
  if (!user) return null;

  const ep = getEffectivePlan(user);

  if (ep === "free") {
    return {
      plan: "pro",
      label: "Pro",
      cta: "Upgrade to Pro"
    };
  }

  // Pro+ is hidden from public launch UI, so no next plan for Pro users
  // Existing Pro+ users can still manage billing through Stripe
  return null;
}

// Proof limits by plan
export function getProofLimit(user: any): number | 'unlimited' {
  const effectivePlan = getEffectivePlan(user);
  
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
