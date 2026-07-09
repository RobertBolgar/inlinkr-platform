/**
 * Helper functions for referral reward countdown and status
 */

export interface RewardTimeRemaining {
  isActive: boolean;
  daysLeft: number;
  hoursLeft: number;
  label: string;
  isExpiringSoon: boolean;
}

/**
 * Calculate time remaining for a referral reward
 * @param referralRewardExpiresAt - The expiration date from referral_reward_expires_at (new model only)
 * @returns Object with time remaining information
 */
export function getRewardTimeRemaining(referralRewardExpiresAt?: string): RewardTimeRemaining {
  // Use new model only (Phase 2C-2)
  const expirationDate = referralRewardExpiresAt;
  
  if (!expirationDate) {
    return {
      isActive: false,
      daysLeft: 0,
      hoursLeft: 0,
      label: 'No reward active',
      isExpiringSoon: false
    };
  }

  const now = new Date();
  const expiration = new Date(expirationDate);
  
  // If already expired
  if (expiration < now) {
    return {
      isActive: false,
      daysLeft: 0,
      hoursLeft: 0,
      label: 'Expired',
      isExpiringSoon: false
    };
  }

  // Calculate time difference
  const diffMs = expiration.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  // Generate label
  let label: string;
  if (diffDays >= 7) {
    label = `${diffDays} days left`;
  } else if (diffDays >= 2) {
    label = `${diffDays} days left`;
  } else if (diffDays === 1) {
    label = diffHours > 0 ? '1 day left' : 'Expires today';
  } else if (diffHours > 1) {
    label = `${diffHours} hours left`;
  } else if (diffHours === 1) {
    label = '1 hour left';
  } else {
    label = 'Expires today';
  }

  return {
    isActive: true,
    daysLeft: diffDays,
    hoursLeft: diffHours,
    label,
    isExpiringSoon: diffDays <= 1
  };
}

/**
 * Check if user has an active referral reward
 * @param user - User object with both old and new referral reward fields
 * @returns True if user has active referral reward
 */
export function hasActiveReferralReward(user?: any): boolean {
  if (!user) return false;
  
  // Check new model only (Phase 2C-2)
  if (user.referral_reward_active && user.referral_reward_expires_at) {
    const expirationDate = new Date(user.referral_reward_expires_at);
    return expirationDate > new Date();
  }
  
  return false;
}

/**
 * Get the reward plan from either old or new model
 * @param user - User object with both old and new referral reward fields
 * @returns The reward plan ('pro', 'pro_plus', or undefined)
 */
export function getRewardPlan(user?: any): string | undefined {
  if (!user) return undefined;
  
  // Check new model only (Phase 2C-2)
  if (user.referral_reward_active && user.referral_reward_plan) {
    // Pro+ referral rewards are not granted during launch
    if (user.referral_reward_plan === 'pro_plus') return undefined;
    return user.referral_reward_plan;
  }
  
  return undefined;
}

/**
 * Get plan display name
 * @param plan - User's plan
 * @returns Display name for the plan
 */
export function getPlanDisplayName(plan?: string): string {
  switch (plan) {
    case 'pro':
      return 'Pro';
    case 'free':
    default:
      return 'Free';
  }
}
