interface GetInviteUrlOptions {
  username?: string | null;
  isPro?: boolean;
  isFounder?: boolean;
  apiReferralUrl?: string | null;
}

/**
 * Returns the appropriate invite URL based on user plan
 * - Pro/Founder users: https://{username}.tubelinkr.com/invite
 * - Free users: https://go.tubelinkr.com/{username}/invite
 * - Falls back to API-provided URL for free users
 * - Returns null if username is missing
 */
export function getInviteUrl({ username, isPro, isFounder, apiReferralUrl }: GetInviteUrlOptions): string | null {
  if (!username) return null;

  // Pro and Founder users always get branded URL
  if (isPro || isFounder) {
    return `https://${username}.tubelinkr.com/invite`;
  }

  // Free users use API URL as fallback to generic invite link
  return apiReferralUrl || `https://go.tubelinkr.com/${username}/invite`;
}
