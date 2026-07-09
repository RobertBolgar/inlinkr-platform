import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useUser as useClerkUser, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { User } from '../lib/cloudflare';
import { hasProAccess } from '../lib/plan';
import { getStoredReferralCode, clearStoredReferralCode } from '../lib/referral';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isPro: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user: clerkUser, isLoaded: clerkLoaded } = useClerkUser();
  const { getToken } = useClerkAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const syncUserToBackend = async (clerkUserId: string, email: string) => {
    try {
      const token = await getToken();
      let referralCode = getStoredReferralCode();
      
      // Fallback: check URL directly in case of timing issues or localStorage loss
      if (!referralCode && typeof window !== 'undefined') {
        const urlRef = new URL(window.location.href).searchParams.get('ref');
        if (urlRef) {
          // Validate the URL referral code
          const { isValidReferralCode } = await import('../lib/referral');
          if (isValidReferralCode(urlRef)) {
            referralCode = urlRef.trim();
            
            // Store it for future use
            localStorage.setItem('tubelinkr_referral_code', referralCode);
            
            // Clear from URL to prevent repeated processing
            const url = new URL(window.location.href);
            url.searchParams.delete('ref');
            window.history.replaceState({}, '', url.toString());
          }
        }
      }
      
      const requestBody: any = { clerk_user_id: clerkUserId, email };
      
      // Include referral code if present
      if (referralCode) {
        requestBody.referralCode = referralCode;
      }

      const response = await fetch('/api/users/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Failed to sync user');
      }

      const result = await response.json();
      
      // Clear stored referral code after successful sync if it was sent
      if (referralCode && result.data) {
        clearStoredReferralCode();
      }
      
      return result.data;
    } catch (error) {
      console.error('Error syncing user:', error);
      return null;
    }
  };

  const refreshUser = async () => {
    if (!clerkUser) {
      setUser(null);
      return;
    }

    const syncedUser = await syncUserToBackend(clerkUser.id, clerkUser.emailAddresses[0]?.emailAddress || '');
    
    if (syncedUser) {
      const userWithProAccess = {
        id: syncedUser.id.toString(),
        email: syncedUser.email,
        username: syncedUser.username,
        display_name: syncedUser.display_name,
        clerk_user_id: syncedUser.clerk_user_id,
        first_name: syncedUser.first_name,
        subdomain: syncedUser.subdomain,
        created_at: syncedUser.created_at,
        updated_at: syncedUser.updated_at,
        is_active: syncedUser.is_active,
        username_confirmed_by_user: syncedUser.username_confirmed_by_user,
        plan: syncedUser.plan,
        subscription_status: syncedUser.subscription_status,
        subscription_current_period_end: syncedUser.subscription_current_period_end,
        stripe_customer_id: syncedUser.stripe_customer_id,
        referral_reward_active: syncedUser.referral_reward_active,
        referral_reward_plan: syncedUser.referral_reward_plan,
        referral_reward_expires_at: syncedUser.referral_reward_expires_at,
        has_founder_access: syncedUser.has_founder_access,
        youtube_avatar_url: null as string | null,
      };

      // Fetch YouTube avatar for all users with connected YouTube
      try {
        const token = await getToken();
        const avatarResponse = await fetch('/api/youtube/avatar', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (avatarResponse.ok) {
          const avatarData = await avatarResponse.json();
          userWithProAccess.youtube_avatar_url = avatarData.avatarUrl;
        }
      } catch (error) {
        console.error('Error fetching YouTube avatar:', error);
      }

      setUser(userWithProAccess);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      if (!clerkLoaded) {
        return;
      }

      if (clerkUser) {
        const syncedUser = await syncUserToBackend(clerkUser.id, clerkUser.emailAddresses[0]?.emailAddress || '');
        
        if (syncedUser) {
          const userWithProAccess = {
            id: syncedUser.id.toString(),
            email: syncedUser.email,
            username: syncedUser.username,
            display_name: syncedUser.display_name,
            clerk_user_id: syncedUser.clerk_user_id,
            first_name: syncedUser.first_name,
            subdomain: syncedUser.subdomain,
            created_at: syncedUser.created_at,
            updated_at: syncedUser.updated_at,
            is_active: syncedUser.is_active,
            username_confirmed_by_user: syncedUser.username_confirmed_by_user,
            plan: syncedUser.plan,
            subscription_status: syncedUser.subscription_status,
            subscription_current_period_end: syncedUser.subscription_current_period_end,
            stripe_customer_id: syncedUser.stripe_customer_id,
            referral_reward_active: syncedUser.referral_reward_active,
            referral_reward_plan: syncedUser.referral_reward_plan,
            referral_reward_expires_at: syncedUser.referral_reward_expires_at,
            has_founder_access: syncedUser.has_founder_access,
            youtube_avatar_url: null as string | null,
          };

          // Fetch YouTube avatar for all users with connected YouTube
          try {
            const token = await getToken();
            const avatarResponse = await fetch('/api/youtube/avatar', {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            if (avatarResponse.ok) {
              const avatarData = await avatarResponse.json();
              userWithProAccess.youtube_avatar_url = avatarData.avatarUrl;
            }
          } catch (error) {
            console.error('Error fetching YouTube avatar:', error);
          }

          setUser(userWithProAccess);
        }
      } else {
        setUser(null);
      }

      setLoading(false);
    };

    initAuth();
  }, [clerkUser, clerkLoaded]);

  const signOut = async () => {
    setUser(null);
  };

  const isPro = useMemo(() => hasProAccess(user), [user]);

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshUser, isPro }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
