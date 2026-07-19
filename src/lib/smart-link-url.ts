/**
 * Centralized Smart Link URL builder
 * Generates all Smart Link URLs with environment-aware routing
 */

import { config } from './config/frontend';
import { getMarketingRootDomain } from './hostname';
import { User, Link as LinkType } from './cloudflare';
import { hasFeature, FEATURES } from './plan';

export interface SmartLinkUrlOptions {
  /** Link slug */
  slug: string;
  /** Optional public code for short links */
  publicCode?: string | null;
  /** Optional username for username-based URLs */
  username?: string | null;
  /** Optional placement code for placement tracking URLs */
  placementCode?: string | null;
  /** Force use of redirect base URL regardless of account tier */
  forceRedirectBase?: boolean;
}

/**
 * Environment flag to control custom subdomain behavior
 * In InLinkr development, custom subdomains are disabled
 * In TubeLinkr production, custom subdomains are enabled for Pro/Founder
 */
const ENABLE_CUSTOM_SUBDOMAINS = import.meta.env.VITE_ENABLE_CUSTOM_SUBDOMAINS === 'true';

/**
 * Generate a Smart Link URL based on environment configuration and user tier
 * 
 * In InLinkr development (ENABLE_CUSTOM_SUBDOMAINS=false):
 * - All URLs use redirect base URL (go-dev.inlinkr.com)
 * - Format: {redirectBaseUrl}/{publicCode} or {redirectBaseUrl}/{username}/{slug}
 * 
 * In TubeLinkr production (ENABLE_CUSTOM_SUBDOMAINS=true):
 * - Pro/Founder with CUSTOM_SUBDOMAIN feature: {subdomain}.tubelinkr.com/{slug}
 * - Free users: {redirectBaseUrl}/{publicCode} or {redirectBaseUrl}/{username}/{slug}
 */
export function buildSmartLinkUrl(options: SmartLinkUrlOptions, user?: User | null): string {
  const { forceRedirectBase } = options;

  // In development or when forced, always use redirect base URL
  if (!ENABLE_CUSTOM_SUBDOMAINS || forceRedirectBase) {
    return buildRedirectBaseUrl(options);
  }
  
  // In production with custom subdomains enabled, check user tier
  if (user && hasFeature(user, FEATURES.CUSTOM_SUBDOMAIN) && !forceRedirectBase) {
    return buildCustomSubdomainUrl(options, user);
  }
  
  // Default to redirect base URL
  return buildRedirectBaseUrl(options);
}

/**
 * Build URL using redirect base URL (go-dev.inlinkr.com or go.tubelinkr.com)
 */
function buildRedirectBaseUrl(options: SmartLinkUrlOptions): string {
  const { slug, publicCode, username, placementCode } = options;
  
  // Placement tracking URL: {baseUrl}/{publicCode}/{placementCode}
  if (placementCode && publicCode) {
    return `${config.redirectBaseUrl}/${publicCode}/${placementCode}`;
  }
  
  // Placement tracking URL with username: {baseUrl}/{username}/{slug}/{placementCode}
  if (placementCode && username) {
    return `${config.redirectBaseUrl}/${username}/${slug}/${placementCode}`;
  }
  
  // Short link with public code: {baseUrl}/{publicCode}
  if (publicCode) {
    return `${config.redirectBaseUrl}/${publicCode}`;
  }
  
  // Username-based link: {baseUrl}/{username}/{slug}
  if (username) {
    return `${config.redirectBaseUrl}/${username}/${slug}`;
  }
  
  // Fallback to slug only: {baseUrl}/{slug}
  return `${config.redirectBaseUrl}/${slug}`;
}

/**
 * Build custom subdomain URL for Pro/Founder users (InLinkr production)
 * Format: {subdomain}.inlinkr.com/{slug}
 */
function buildCustomSubdomainUrl(options: SmartLinkUrlOptions, user: User): string {
  const subdomain = user.subdomain || user.username || '';
  return `https://${subdomain}.${getMarketingRootDomain()}/${options.slug}`;
}

/**
 * Generate invite/referral URL
 */
export function buildInviteUrl(username: string | null, user?: User | null): string | null {
  if (!username) return null;
  
  // In development, use redirect base URL
  if (!ENABLE_CUSTOM_SUBDOMAINS) {
    return `${config.redirectBaseUrl}/${username}/invite`;
  }
  
  // In production, Pro/Founder users get branded URLs
  if (user && hasFeature(user, FEATURES.CUSTOM_SUBDOMAIN)) {
    return `https://${user.subdomain || user.username}.${getMarketingRootDomain()}/invite`;
  }
  
  // Free users use redirect base URL
  return `${config.redirectBaseUrl}/${username}/invite`;
}

/**
 * Generate placement URL
 */
export function buildPlacementUrl(
  link: LinkType,
  placement: { public_code: string },
  username: string | null,
  user?: User | null
): string {
  return buildSmartLinkUrl({
    slug: link.slug,
    publicCode: link.public_code,
    username,
    placementCode: placement.public_code,
  }, user);
}

/**
 * Generate QR code URL
 */
export function buildQrUrl(
  link: LinkType,
  placement: { public_code: string },
  username: string | null,
  user?: User | null
): string {
  return buildPlacementUrl(link, placement, username, user);
}
