import { buildInviteUrl } from './smart-link-url';
import { User } from './cloudflare';

interface GetInviteUrlOptions {
  username?: string | null;
  apiReferralUrl?: string | null;
  user?: User | null;
}

/**
 * Returns the appropriate invite URL based on user plan
 * - Pro/Founder users: https://{username}.tubelinkr.com/invite (TubeLinkr workspace, when enabled)
 * - Free users: https://go-dev.inlinkr.com/{username}/invite (InLinkr development)
 * - Falls back to API-provided URL for free users
 * - Returns null if username is missing
 */
export function getInviteUrl({ username, apiReferralUrl, user }: GetInviteUrlOptions): string | null {
  if (!username) return null;

  // Use centralized URL builder
  const centralizedUrl = buildInviteUrl(username, user);
  if (centralizedUrl) {
    return centralizedUrl;
  }

  // Fallback to API URL
  return apiReferralUrl || null;
}
