const PENDING_REDIRECT_KEY = 'tubelinkr_pending_auth_redirect';
const PENDING_REDIRECT_TIMESTAMP_KEY = 'tubelinkr_pending_auth_redirect_timestamp';
const REDIRECT_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

const ALLOWED_REDIRECTS = [
  '/checkout?plan=pro_yearly',
  '/checkout?plan=pro_monthly',
  '/checkout?plan=founder',
  '/dashboard',
] as const;

type AllowedRedirect = typeof ALLOWED_REDIRECTS[number];

export type CheckoutPlan = 'pro_yearly' | 'pro_monthly' | 'founder';

/**
 * Validate that a redirect path is allowed (relative, no external URLs)
 */
export function isValidRedirect(path: string): path is AllowedRedirect {
  if (!path || typeof path !== 'string') return false;
  
  // Must be relative (no protocol, no hostname)
  if (path.startsWith('http://') || path.startsWith('https://')) return false;
  
  // Must start with /
  if (!path.startsWith('/')) return false;
  
  // Must be in allowed list
  return (ALLOWED_REDIRECTS as readonly string[]).includes(path);
}

/**
 * Save pending redirect to sessionStorage with timestamp
 */
export function savePendingRedirect(path: string): void {
  if (!isValidRedirect(path)) {
    console.warn('Invalid redirect path, not saving:', path);
    return;
  }
  
  try {
    sessionStorage.setItem(PENDING_REDIRECT_KEY, path);
    sessionStorage.setItem(PENDING_REDIRECT_TIMESTAMP_KEY, Date.now().toString());
  } catch (e) {
    console.error('Failed to save pending redirect:', e);
  }
}

/**
 * Get pending redirect from sessionStorage if not expired
 */
export function getPendingRedirect(): AllowedRedirect | null {
  try {
    const stored = sessionStorage.getItem(PENDING_REDIRECT_KEY);
    const timestamp = sessionStorage.getItem(PENDING_REDIRECT_TIMESTAMP_KEY);
    
    if (stored && isValidRedirect(stored)) {
      // Check if redirect is expired
      if (timestamp) {
        const age = Date.now() - parseInt(timestamp, 10);
        if (age > REDIRECT_EXPIRY_MS) {
          // Redirect is expired, clear it
          clearPendingRedirect();
          return null;
        }
      }
      return stored;
    }
  } catch (e) {
    console.error('Failed to get pending redirect:', e);
  }
  return null;
}

/**
 * Clear pending redirect from sessionStorage
 */
export function clearPendingRedirect(): void {
  try {
    sessionStorage.removeItem(PENDING_REDIRECT_KEY);
    sessionStorage.removeItem(PENDING_REDIRECT_TIMESTAMP_KEY);
  } catch (e) {
    console.error('Failed to clear pending redirect:', e);
  }
}

/**
 * Get the appropriate checkout/signup URL for a given plan
 * Saves pending redirect if user is not signed in
 */
export function getCheckoutIntentUrl(plan: CheckoutPlan, isSignedIn: boolean): string {
  const dest = `/checkout?plan=${plan}`;
  if (!isSignedIn) {
    savePendingRedirect(dest);
  }
  return isSignedIn ? dest : `/signup?redirectUrl=${encodeURIComponent(dest)}`;
}
