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
];

function getMarketingRootDomain(): string {
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

  const marketingRoot = getMarketingRootDomain();

  // Current platform root domain (e.g. *.inlinkr.com)
  if (hostname === marketingRoot) return null;
  if (hostname.endsWith(`.${marketingRoot}`)) {
    const parts = hostname.split('.');
    const subdomain = parts[0];
    if (RESERVED_SUBDOMAINS.includes(subdomain)) return null;
    return subdomain;
  }

  // Legacy TubeLinkr branded subdomains (e.g. *.tubelinkr.com)
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
