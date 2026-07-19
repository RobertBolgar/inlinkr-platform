import config from './config/frontend';

/**
 * Reserved subdomains that should never be treated as creator/branded hubs.
 * These hostnames use the normal application router instead of the public hub.
 */
export const RESERVED_SUBDOMAINS: readonly string[] = [
  'app',
  'www',
  'go',
  'go-dev',
  'api',
  'pro-dev',
  'free-dev',
  'dev',
  'staging',
  'preview',
  'test',
  'localhost',
  'docs',
  'status',
  'support',
  'accounts',
  'clerk',
  'marketing',
];

export function getMarketingRootDomain(): string {
  try {
    return new URL(config.marketingBaseUrl).hostname;
  } catch {
    return 'inlinkr.com';
  }
}

function getCurrentHostname(): string | null {
  return typeof window === 'undefined' ? null : window.location.hostname;
}

/**
 * Extract a creator/branded subdomain from the current hostname.
 * Returns null for apex domains, reserved subdomains, and unknown hosts.
 */
export function getSubdomainFromHostname(): string | null {
  const hostname = getCurrentHostname();
  if (!hostname) return null;

  // TubeLinkr custom subdomains host public creator hubs.
  // InLinkr subdomains (e.g. username.inlinkr.com) are Smart Links, not hubs,
  // so they must not be classified as branded hubs in the React app.
  if (hostname.endsWith('.tubelinkr.com') && hostname !== 'tubelinkr.com') {
    const parts = hostname.split('.');
    const subdomain = parts[0];
    if (RESERVED_SUBDOMAINS.includes(subdomain)) return null;
    return subdomain;
  }

  return null;
}

/**
 * Whether the current hostname is a creator/branded subdomain that should
 * render the public link hub instead of the normal application router.
 */
export function isBrandedSubdomain(): boolean {
  return getSubdomainFromHostname() !== null;
}
