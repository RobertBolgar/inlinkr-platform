// Referral parameter capture and storage utilities

const REFERRAL_STORAGE_KEY = 'tubelinkr_referral_code';

/**
 * Validate referral code format
 * @param code - The referral code to validate
 * @returns boolean - True if valid
 */
export function isValidReferralCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  
  const trimmedCode = code.trim();
  
  // Validation rules: non-empty, max 64 chars, only letters, numbers, dash, underscore
  return (
    trimmedCode.length > 0 &&
    trimmedCode.length <= 64 &&
    /^[a-zA-Z0-9_-]+$/.test(trimmedCode)
  );
}

/**
 * Capture referral code from URL and store it
 * Should be called on app initialization
 */
export function captureReferralFromUrl(): void {
  if (typeof window === 'undefined') return;
  
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    
    if (refCode && isValidReferralCode(refCode)) {
      // Only store if not already stored or if current stored is invalid
      const existingCode = getStoredReferralCode();
      if (!existingCode || !isValidReferralCode(existingCode)) {
        localStorage.setItem(REFERRAL_STORAGE_KEY, refCode.trim());
      }
    }
  } catch (error) {
    console.error('Error capturing referral code:', error);
    // Don't throw - referral capture should never break the app
  }
}

/**
 * Get stored referral code
 * @returns string | null - The stored referral code or null
 */
export function getStoredReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(REFERRAL_STORAGE_KEY);
    const result = stored && isValidReferralCode(stored) ? stored.trim() : null;
    return result;
  } catch (error) {
    console.error('Error getting stored referral code:', error);
    return null;
  }
}

/**
 * Clear stored referral code
 * Should be called after successful user sync/create
 */
export function clearStoredReferralCode(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing stored referral code:', error);
    // Don't throw - cleanup should never break the app
  }
}
