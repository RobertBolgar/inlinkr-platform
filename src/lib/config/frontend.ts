/**
 * Frontend configuration module
 * Centralizes all environment-specific URLs and settings for the React frontend
 */

export const config = {
  // Base URLs
  redirectBaseUrl: import.meta.env.VITE_REDIRECT_BASE_URL || 'https://go-dev.inlinkr.com',
  appBaseUrl: import.meta.env.VITE_APP_BASE_URL || 'https://app.inlinkr.com',
  marketingBaseUrl: import.meta.env.VITE_MARKETING_BASE_URL || 'https://inlinkr.com',
  
  // Clerk configuration
  clerk: {
    publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '',
    signInUrl: import.meta.env.VITE_CLERK_SIGN_IN_URL || '/login',
    signUpUrl: import.meta.env.VITE_CLERK_SIGN_UP_URL || '/signup',
    signInFallbackRedirectUrl: import.meta.env.VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL || '/dashboard',
    signUpFallbackRedirectUrl: import.meta.env.VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL || '/dashboard',
  },
  
  // Feature flags
  features: {
    stripeEnabled: import.meta.env.VITE_STRIPE_ENABLED === 'true',
    emailEnabled: import.meta.env.VITE_EMAIL_ENABLED === 'true',
  },
} as const;

export default config;
