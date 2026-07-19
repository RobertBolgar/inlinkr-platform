import { config } from './config/frontend';

interface GetInviteUrlOptions {
  username?: string | null;
  isPro?: boolean;
  isFounder?: boolean;
  apiReferralUrl?: string | null;
}

/**
 * Returns the appropriate invite URL based on user plan
 * - Pro/Founder users: https://{username}.tubelinkr.com/invite (TubeLinkr workspace)
 * - Free users: https://go-dev.inlinkr.com/{username}/invite (InLinkr development)
 * - Falls back to API-provided URL for free users
 * - Returns null if username is missing
 */
export function getInviteUrl({ username, isPro, isFounder, apiReferralUrl }: GetInviteUrlOptions): string | null {
  if (!username) return null;

  // Pro and Founder users always get branded URL (TubeLinkr workspace)
  if (isPro || isFounder) {
    return `https://${username}.tubelinkr.com/invite`;
  }

  // Free users use API URL as fallback to generic invite link (InLinkr development)
  return apiReferralUrl || `${config.redirectBaseUrl}/${username}/invite`;
}
