/**
 * Server-side configuration module for Cloudflare Functions
 * Centralizes all environment-specific URLs and settings
 */

export interface Config {
  // Base URLs
  redirectBaseUrl: string;
  appBaseUrl: string;
  marketingBaseUrl: string;
  
  // Email configuration
  email: {
    enabled: boolean;
    fromName: string;
    fromAddress: string;
    resendApiKey?: string;
  };
  
  // Stripe configuration
  stripe: {
    enabled: boolean;
    secretKey?: string;
    publishableKey?: string;
    webhookSecret?: string;
    proPriceIdMonthly?: string;
    proPriceIdYearly?: string;
    founderPriceId?: string;
  };
  
  // Clerk configuration
  clerk: {
    secretKey: string;
    jwksUrl: string;
  };
  
  // Google OAuth
  google: {
    oauthClientId?: string;
    oauthClientSecret?: string;
    oauthRedirectUri?: string;
  };
}

export function getConfig(env: any): Config {
  return {
    // Base URLs
    redirectBaseUrl: env.REDIRECT_BASE_URL || 'https://go-dev.inlinkr.com',
    appBaseUrl: env.APP_BASE_URL || 'https://app.inlinkr.com',
    marketingBaseUrl: env.MARKETING_BASE_URL || 'https://inlinkr.com',
    
    // Email configuration
    email: {
      enabled: env.EMAIL_ENABLED === 'true',
      fromName: env.EMAIL_FROM_NAME || 'InLinkr',
      fromAddress: env.EMAIL_FROM_ADDRESS || 'notify@inlinkr.com',
      resendApiKey: env.RESEND_API_KEY,
    },
    
    // Stripe configuration
    stripe: {
      enabled: env.STRIPE_ENABLED === 'true',
      secretKey: env.STRIPE_SECRET_KEY,
      publishableKey: env.STRIPE_PUBLISHABLE_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      proPriceIdMonthly: env.PRO_PRICE_ID_MONTHLY,
      proPriceIdYearly: env.PRO_PRICE_ID_YEARLY,
      founderPriceId: env.FOUNDER_PRICE_ID,
    },
    
    // Clerk configuration
    clerk: {
      secretKey: env.CLERK_SECRET_KEY || '',
      jwksUrl: env.CLERK_JWKS_URL || '',
    },
    
    // Google OAuth
    google: {
      oauthClientId: env.GOOGLE_OAUTH_CLIENT_ID,
      oauthClientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      oauthRedirectUri: env.GOOGLE_OAUTH_REDIRECT_URI,
    },
  };
}

export default getConfig;
