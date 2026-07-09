import { User } from '../cloudflare';

export const isDevAuthEnabled = import.meta.env.VITE_DEV_AUTH === 'true';
export const DEV_AUTH_TOKEN = import.meta.env.VITE_DEV_AUTH_TOKEN || 'dev-token';
export const DEV_USER_ID = 'dev-user';
export const DEV_EMAIL = 'admin@inlinkr.com';

export const DEV_USER: User = {
  id: DEV_USER_ID,
  email: DEV_EMAIL,
  username: 'dev-user',
  display_name: 'Dev Admin',
  clerk_user_id: DEV_USER_ID,
  first_name: 'Dev',
  subdomain: 'dev-user',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_active: true,
  username_confirmed_by_user: true,
  plan: 'pro',
  subscription_status: 'active',
  subscription_current_period_end: '2099-12-31T23:59:59Z',
  stripe_customer_id: 'dev-customer',
  referral_reward_active: false,
  referral_reward_plan: null,
  referral_reward_expires_at: null,
  has_founder_access: false,
  youtube_avatar_url: null,
  isAdmin: true,
  role: 'admin',
};

export const DEV_CLERK_USER = {
  id: DEV_USER_ID,
  firstName: 'Dev',
  lastName: 'Admin',
  fullName: 'Dev Admin',
  username: 'dev-user',
  imageUrl: null,
  emailAddresses: [
    {
      id: 'dev-email',
      emailAddress: DEV_EMAIL,
      verification: { status: 'verified' },
    },
  ],
  primaryEmailAddress: {
    id: 'dev-email',
    emailAddress: DEV_EMAIL,
    verification: { status: 'verified' },
  },
  phoneNumbers: [],
  primaryPhoneNumber: null,
};

export function initializeDevAuth() {
  if (isDevAuthEnabled) {
    (window as any).Clerk = {
      loaded: true,
      session: {
        getToken: () => Promise.resolve(DEV_AUTH_TOKEN),
      },
      user: DEV_CLERK_USER,
    };
  }
}
