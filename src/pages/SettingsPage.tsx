import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { SubscriptionHubModal } from '../components/SubscriptionHubModal';
import { useAuth } from '../contexts/AuthContext';
import { useAuth as useClerkAuth, useUser as useClerkUser } from '../lib/auth/clerk';
import { analytics } from '../lib/analytics';
import { getEffectivePlan, hasActiveReferralReward, hasProAccess } from '../lib/plan';
import { getDisplayAvatar } from '../lib/avatar';
import { Avatar } from '../components/Avatar';
import { CreatorImpactCard } from '../components/CreatorImpactCard';

export function SettingsPage() {
  const { user, refreshUser, signOut } = useAuth();
  const { user: clerkUser } = useClerkUser();
  const { getToken } = useClerkAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState(user?.username || '');
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Get display avatar using centralized logic
  const displayAvatarUrl = getDisplayAvatar(user, clerkUser?.imageUrl);
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [showSubscriptionHub, setShowSubscriptionHub] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [creatorImpactData, setCreatorImpactData] = useState(null);
  const [creatorImpactLoading, setCreatorImpactLoading] = useState(false);
  const [creatorImpactError, setCreatorImpactError] = useState(null);
  
  // Billing state variables for proper UI logic
  const effectivePlan = useMemo(() => getEffectivePlan(user), [user]);
  const hasStripeCustomer = Boolean(user?.stripe_customer_id);
  const isPro = effectivePlan === "pro";
  const isProPlus = effectivePlan === "pro_plus";
  const isFounder = effectivePlan === "founder";
  const userHasProAccess = useMemo(() => hasProAccess(user), [user]);
  // isPaidPro: true only for users with an active paid Stripe subscription
  // Referral Pro users (effectivePlan === 'pro' via referral reward) must NOT qualify
  // Founder users (effectivePlan === 'founder') must NOT qualify
  const isPaidPro = user?.subscription_status === 'active' && hasStripeCustomer && (user?.plan === 'pro' || user?.plan === 'pro_plus');
  const isReferralPro = useMemo(() => hasActiveReferralReward(user) && !isPaidPro && !isFounder, [user, isPaidPro, isFounder]);

  // Format plan name for display
  const formatPlanName = (plan: string | undefined): string => {
    switch (plan) {
      case 'founder':
        return 'Founder Access';
      case 'pro':
      case 'pro_plus':
        return 'Pro';
      case 'free':
        return 'Free';
      default:
        return 'Free';
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This will:\n\n' +
      '• Disable your InLinkr account\n' +
      '• Deactivate all your links\n' +
      '• This action cannot be undone\n\n' +
      'Do you want to proceed?'
    );

    if (!confirmed) return;

    setDeleteLoading(true);
    setError('');

    try {
      // Get Clerk token for authentication
      const token = await getToken();

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/user/delete-account', {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete account');
      }

      // Sign out user after successful deletion
      await signOut();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
    } finally {
      setDeleteLoading(false);
    }
  };

  useEffect(() => {
    const fetchYouTubeStatus = async () => {
      if (!user) return;

      try {
        const clerk = (window as any).Clerk;
        let headers: HeadersInit = { 'Content-Type': 'application/json' };

        if (clerk && clerk.session) {
          const token = await clerk.session.getToken();
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        }

        const response = await fetch('/api/youtube/status', {
          method: 'GET',
          headers,
        });

        if (response.ok) {
          const data = await response.json();
          setYoutubeConnected(data.connected || false);
        }
      } catch (err) {
        console.error('Failed to fetch YouTube status:', err);
      }
    };

    fetchYouTubeStatus();
  }, [user]);

  useEffect(() => {
    const fetchCreatorImpact = async () => {
      if (!user) return;

      setCreatorImpactLoading(true);
      setCreatorImpactError(null);

      try {
        const clerk = (window as any).Clerk;
        let headers: HeadersInit = { 'Content-Type': 'application/json' };

        if (clerk && clerk.session) {
          const token = await clerk.session.getToken();
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        }

        const response = await fetch('/api/creator-impact/status', {
          method: 'GET',
          headers,
        });

        if (response.ok) {
          const data = await response.json();
          setCreatorImpactData(data.data);
        } else {
          console.error('Failed to fetch Creator Impact status:', response.statusText);
          setCreatorImpactError('Failed to load Creator Impact data');
        }
      } catch (err) {
        console.error('Failed to fetch Creator Impact status:', err);
        setCreatorImpactError('Failed to load Creator Impact data');
      } finally {
        setCreatorImpactLoading(false);
      }
    };

    fetchCreatorImpact();
  }, [user]);

  
  
  const handleSaveProfile = async () => {
    setError('');
    setSuccess(false);
    setInfo('');
    setLoading(true);

    try {
      // Check if anything changed
      const usernameChanged = username !== (user?.username || '');
      const displayNameChanged = displayName !== (user?.display_name || '');
      
      if (!usernameChanged && !displayNameChanged) {
        setInfo('No changes to save.');
        return;
      }

      const clerk = (window as any).Clerk;
      let headers: HeadersInit = { 'Content-Type': 'application/json' };

      if (clerk && clerk.session) {
        const token = await clerk.session.getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      // Update username if changed
      if (usernameChanged) {
        const usernameResponse = await fetch('/api/users/username', {
          method: 'PUT',
          headers,
          body: JSON.stringify({ username, clerk_user_id: clerkUser?.id }),
        });

        if (!usernameResponse.ok) {
          const data = await usernameResponse.json();
          throw new Error(data.error || 'Failed to update username');
        }
      }

      // Update display name if changed
      if (displayNameChanged) {
        const displayNameResponse = await fetch('/api/users/display-name', {
          method: 'PUT',
          headers,
          body: JSON.stringify({ display_name: displayName || null }),
        });

        if (!displayNameResponse.ok) {
          const data = await displayNameResponse.json();
          throw new Error(data.error || 'Failed to update display name');
        }
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      
      // Refresh user data once after both updates
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectYouTube = async () => {
    setYoutubeLoading(true);
    setError('');

    try {
      const clerk = (window as any).Clerk;
      let headers: HeadersInit = { 'Content-Type': 'application/json' };

      if (clerk && clerk.session) {
        const token = await clerk.session.getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch('/api/youtube/oauth-start', {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start OAuth flow');
      }

      const data = await response.json();
      window.location.href = data.auth_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect YouTube');
    } finally {
      setYoutubeLoading(false);
    }
  };

  const handleDisconnectYouTube = async () => {
    setYoutubeLoading(true);
    setError('');

    try {
      const clerk = (window as any).Clerk;
      let headers: HeadersInit = { 'Content-Type': 'application/json' };

      if (clerk && clerk.session) {
        const token = await clerk.session.getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch('/api/youtube/disconnect', {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disconnect YouTube');
      }

      setYoutubeConnected(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect YouTube');
    } finally {
      setYoutubeLoading(false);
    }
  };

  const handleManageBilling = async () => {
    if (!user?.id) {
      alert('You must be logged in to manage billing');
      return;
    }

    // Guard: referral-only Pro users must not reach the Stripe billing portal
    const hasPaidSubscription = user?.subscription_status === 'active' && user?.stripe_customer_id;
    if (!hasPaidSubscription) {
      navigate('/upgrade');
      return;
    }

    analytics.trackPortalOpened('settings_page');
    setBillingLoading(true);
    setError('');

    try {
      const token = await getToken();
      if (!token) {
        setError('Authentication failed. Please log in again.');
        return;
      }

      const response = await fetch('/api/stripe/create-billing-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create billing portal session');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No billing portal URL returned');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal. Please try again.');
    } finally {
      setBillingLoading(false);
    }
  };

  const handleUpgradeToProPlus = () => {
    analytics.trackUpgradeStarted('pro_plus', 'settings_page');
    setShowSubscriptionHub(false);
    navigate('/upgrade');
  };

  const handleUpgradeToPro = () => {
    analytics.trackUpgradeStarted('pro', 'settings_page');
    setShowSubscriptionHub(false);
    navigate('/upgrade');
  };

  const handleOpenSubscriptionHub = () => {
    setShowSubscriptionHub(true);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6 sm:px-6 lg:px-8 overflow-x-hidden space-y-3">

        {/* Page header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Your Profile</h1>
          <p className="text-gray-500 mt-0.5 text-sm">Manage your creator profile, channel connection, and account access.</p>
        </div>

        {/* ── CARD: Account Overview ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Account Overview</div>
          <div className="flex items-center gap-4 mb-3">
            <Avatar
              user={{
                avatarUrl: displayAvatarUrl || undefined,
                firstName: clerkUser?.firstName || undefined,
                lastName: clerkUser?.lastName || undefined,
                username: user?.username,
                displayName: user?.display_name,
                email: user?.email
              }}
              size="xl"
            />
            <div className="min-w-0">
              <div className="text-base font-bold text-white truncate">{user?.display_name || user?.username}</div>
              <div className="text-sm text-gray-500 truncate">@{user?.username}</div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="bg-gray-800/50 border border-gray-700/40 rounded-xl px-3 py-2">
              <div className="text-xs text-gray-500 mb-0.5">Plan</div>
              <div className={`text-sm font-semibold ${isFounder ? 'text-amber-300' : isProPlus ? 'text-purple-300' : isPro ? 'text-blue-300' : 'text-gray-300'}`}>
                {formatPlanName(effectivePlan)}
              </div>
            </div>
            <div className="bg-gray-800/50 border border-gray-700/40 rounded-xl px-3 py-2">
              <div className="text-xs text-gray-500 mb-0.5">Status</div>
              {isFounder ? (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                  <span className="text-sm font-semibold text-amber-300">Lifetime Founder</span>
                </div>
              ) : user?.subscription_status === 'active' ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                  <span className="text-sm font-semibold text-green-400">Active</span>
                </div>
              ) : hasActiveReferralReward(user) ? (
                (() => {
                  const expiresAt = user?.referral_reward_expires_at;
                  const now = new Date();
                  const expiryDate = new Date(expiresAt || '');
                  const hoursLeft = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60));
                  const daysLeft = Math.floor(hoursLeft / 24);
                  const urgencyClass = hoursLeft <= 24 ? 'text-red-400' : daysLeft <= 3 ? 'text-yellow-400' : 'text-blue-400';
                  const dotClass = hoursLeft <= 24 ? 'bg-red-400' : daysLeft <= 3 ? 'bg-yellow-400' : 'bg-blue-400';
                  const timeText = hoursLeft <= 24 ? `${hoursLeft}h left` : `${daysLeft}d left`;
                  return (
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                      <span className={`text-sm font-semibold ${urgencyClass}`}>Pro access via referrals • {timeText}</span>
                    </div>
                  );
                })()
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-gray-500 rounded-full" />
                  <span className="text-sm font-semibold text-gray-400">Free</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── CARD: Profile Settings ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Profile Settings</div>

          <div className="space-y-3">
            <div>
              <label htmlFor="username" className="block text-xs text-gray-500 mb-1.5">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading || !userHasProAccess}
                className="w-full px-4 py-2.5 bg-gray-950 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary disabled:opacity-50 text-sm transition-all"
                placeholder="Enter new username"
              />
              {!userHasProAccess && (
                <p className="mt-1.5 text-xs text-blue-400">Custom usernames are available on Pro. Upgrade to Pro to change your username.</p>
              )}
              {userHasProAccess && (
                <p className="mt-1 text-xs text-gray-600">3–30 characters, letters, numbers, underscores, and hyphens</p>
              )}
            </div>

            <div>
              <label htmlFor="displayName" className="block text-xs text-gray-500 mb-1.5">Display Name</label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-950 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary text-sm transition-all"
                placeholder="Your name or brand"
              />
              <p className="mt-1 text-xs text-gray-600">Leave empty to use your username</p>
            </div>

            {error && (
              <div className="px-4 py-2.5 bg-red-900/20 border border-red-800/50 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
            {info && (
              <div className="px-4 py-2.5 bg-blue-900/20 border border-blue-800/50 rounded-lg">
                <p className="text-sm text-blue-400">{info}</p>
              </div>
            )}
            {success && (
              <div className="px-4 py-2.5 bg-green-900/20 border border-green-800/50 rounded-lg">
                <p className="text-sm text-green-400">Profile updated successfully!</p>
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={loading}
              className="w-full py-3 bg-primary hover:bg-primary disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {loading ? 'Saving...' : 'Save profile'}
            </button>
          </div>

          <div className="mt-2 pt-2 border-t border-gray-800">
            <div className="bg-yellow-900/15 border border-yellow-700/30 rounded-xl px-3 py-2">
              <p className="text-xs text-yellow-300 leading-relaxed">
                <strong>⚠️ Important:</strong> Your username is used for your Creator Hub and branded URLs like rob.inlinkr.com. Changing it may affect public creator links.
              </p>
            </div>
          </div>
        </div>

        {/* ── CARD: YouTube Connections ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Channel Connection</div>
          <p className="text-xs text-gray-600 mb-2">Connect your YouTube channel to track video performance and click attribution.</p>

          {youtubeConnected ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-green-900/10 border border-green-700/30 rounded-xl">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0"></span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-green-400">Channel Connected</p>
                  <p className="text-xs text-green-500 mt-0.5">Video tracking active</p>
                </div>
              </div>
              <button
                onClick={handleDisconnectYouTube}
                disabled={youtubeLoading}
                className="w-full py-2.5 px-4 bg-gray-800 hover:bg-red-900/40 border border-gray-700 hover:border-red-700/50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 hover:text-red-400 text-sm font-medium rounded-xl transition-colors"
              >
                {youtubeLoading ? 'Disconnecting...' : 'Disconnect channel'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/40 border border-gray-700/40 rounded-xl">
                <span className="w-2 h-2 bg-gray-600 rounded-full flex-shrink-0"></span>
                <p className="text-xs text-gray-500">No channel connected</p>
              </div>
              <button
                onClick={handleConnectYouTube}
                disabled={youtubeLoading}
                className="w-full py-2.5 px-4 bg-primary hover:bg-primary disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {youtubeLoading ? 'Connecting...' : 'Connect channel'}
              </button>
            </div>
          )}
        </div>

        {/* ── CARD: Creator Hub ── */}
        {userHasProAccess && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Creator Hub</div>
            <p className="text-xs text-gray-600 mb-3">Customize your public creator hub, featured content, resources, and jump links.</p>
            <button
              onClick={() => navigate('/settings/hub')}
              className="w-full py-3 bg-primary hover:bg-primary text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Manage Creator Hub
            </button>
          </div>
        )}

        {/* ── CARD: Creator Impact ── */}
        <CreatorImpactCard
          data={creatorImpactData}
          loading={creatorImpactLoading}
          error={creatorImpactError}
        />

        {/* ── CARD: Subscription & Billing ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Subscription & Billing</div>

          <div className="space-y-3">
            {/* REFERRAL PRO - PRIMARY STATE when user has referral access */}
            {isReferralPro && (() => {
              const expiresAt = user?.referral_reward_expires_at;
              const now = new Date();
              const expiryDate = new Date(expiresAt || '');
              const hoursLeft = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60));
              const daysLeft = Math.floor(hoursLeft / 24);
              const borderClass = hoursLeft <= 24 ? 'border-red-700/30' : daysLeft <= 3 ? 'border-yellow-700/30' : 'border-blue-700/30';
              const bgClass = hoursLeft <= 24 ? 'bg-red-900/15' : daysLeft <= 3 ? 'bg-yellow-900/15' : 'bg-blue-900/15';
              const headClass = hoursLeft <= 24 ? 'text-red-400' : daysLeft <= 3 ? 'text-yellow-400' : 'text-blue-400';
              const dotClass = hoursLeft <= 24 ? 'bg-red-400' : daysLeft <= 3 ? 'bg-yellow-400' : 'bg-blue-400';
              const timeText = hoursLeft <= 24 ? `${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}` : `${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
              return (
                <div className={`px-4 py-3 ${bgClass} border ${borderClass} rounded-xl space-y-2`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                    <p className={`text-sm font-semibold ${headClass}`}>You still have Pro access</p>
                  </div>
                  <p className="text-xs text-gray-400">
                    Free Pro access through referrals for <span className={`font-semibold ${headClass}`}>{timeText}</span> more.
                  </p>
                  <button
                    onClick={() => navigate('/upgrade')}
                    className="w-full py-2.5 bg-primary hover:bg-primary text-white text-sm font-semibold rounded-xl transition-colors mt-1"
                  >
                    Upgrade to keep Pro active
                  </button>
                </div>
              );
            })()}

            {/* CANCELED - SECONDARY STATE (visually lighter, lower priority) */}
            {!isFounder && user?.subscription_status === 'canceled' && (
              <div className="px-4 py-3 bg-gray-800/30 border border-gray-700/30 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-gray-500 rounded-full" />
                  <p className="text-sm font-semibold text-gray-400">Paid subscription ended</p>
                </div>
                <p className="text-xs text-gray-500">Your previous paid subscription is no longer active.</p>
              </div>
            )}

            {/* PAST DUE */}
            {user?.subscription_status === 'past_due' && hasStripeCustomer && (
              <div className="px-4 py-3 bg-yellow-900/15 border border-yellow-700/30 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
                  <p className="text-sm font-semibold text-yellow-400">Payment Issue</p>
                </div>
                <p className="text-xs text-yellow-300/80">Update your billing details to restore access.</p>
                <button
                  onClick={handleOpenSubscriptionHub}
                  disabled={billingLoading}
                  className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors mt-1"
                >
                  {billingLoading ? 'Opening...' : 'Update billing details'}
                </button>
              </div>
            )}

            {/* PRO+ ACTIVE — legacy paid Pro+ users: show as Pro with manage billing */}
            {isProPlus && (
              <div className="px-4 py-3 bg-blue-900/15 border border-blue-700/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                    <p className="text-sm font-semibold text-blue-300">Pro Plan</p>
                  </div>
                  <span className="text-xs bg-blue-800/40 text-blue-400 border border-blue-700/30 px-2 py-0.5 rounded-full font-medium">Active</span>
                </div>
                <p className="text-xs text-gray-500">Branded links and hub access included.</p>
                <button
                  onClick={handleOpenSubscriptionHub}
                  disabled={billingLoading}
                  className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 text-sm font-medium rounded-xl transition-colors mt-1"
                >
                  {billingLoading ? 'Opening...' : 'Manage billing'}
                </button>
              </div>
            )}

            {/* PRO PAID ACTIVE */}
            {isPaidPro && (
              <div className="px-4 py-3 bg-blue-900/15 border border-blue-700/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                    <p className="text-sm font-semibold text-blue-300">Pro Plan</p>
                  </div>
                  <span className="text-xs bg-blue-800/40 text-blue-400 border border-blue-700/30 px-2 py-0.5 rounded-full font-medium">Active</span>
                </div>
                <p className="text-xs text-gray-500">Branded links and hub access included.</p>
                <button
                  onClick={handleOpenSubscriptionHub}
                  disabled={billingLoading}
                  className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 text-sm font-medium rounded-xl transition-colors mt-1"
                >
                  {billingLoading ? 'Opening...' : 'Change plan or cancel'}
                </button>
              </div>
            )}

            {/* FOUNDER ACCESS */}
            {isFounder && (
              <div className="px-3 py-2 bg-amber-900/15 border border-amber-700/30 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                    <p className="text-sm font-semibold text-amber-300">Founder Access</p>
                  </div>
                  <span className="text-xs bg-amber-800/40 text-amber-400 border border-amber-700/30 px-2 py-0.5 rounded-full font-medium">Lifetime</span>
                </div>
                <p className="text-xs text-gray-500">Full access to all Pro features, including branded subdomain and creator hub.</p>
              </div>
            )}

            {/* FREE */}
            {effectivePlan === 'free' && (
              <div className="px-4 py-3 bg-gray-800/40 border border-gray-700/40 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-gray-500 rounded-full" />
                  <p className="text-sm font-semibold text-gray-300">Free Plan</p>
                </div>
                <p className="text-xs text-gray-500">Get unlimited links, branded subdomain, creator hub, and deeper traffic insights with Pro.</p>
                <button
                  onClick={() => navigate('/upgrade')}
                  className="w-full py-2.5 bg-primary hover:bg-primary text-white text-sm font-semibold rounded-xl transition-colors mt-1"
                >
                  Upgrade to Pro
                </button>
              </div>
            )}

          </div>
        </div>

        {/* ── CARD: Support ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Support</div>
          <p className="text-xs text-gray-600 mb-3">Questions, bug reports, feature requests, or account issues?</p>

          <div className="space-y-2">
            <a
              href="mailto:support@inlinkr.com?subject=InLinkr%20Support%20Request"
              className="block w-full py-3 bg-primary hover:bg-primary text-white text-sm font-semibold rounded-xl transition-colors text-center"
            >
              Contact Support
            </a>
            <a
              href="mailto:support@inlinkr.com?subject=InLinkr%20Bug%20Report"
              className="block w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-xl transition-colors text-center"
            >
              Report a Bug
            </a>
            <a
              href="mailto:support@inlinkr.com?subject=InLinkr%20Feature%20Request"
              className="block w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-xl transition-colors text-center"
            >
              Request a Feature
            </a>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-800">
            <a
              href="mailto:support@inlinkr.com"
              className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
            >
              support@inlinkr.com
            </a>
          </div>
        </div>

        {/* ── CARD: Delete Account ── */}
        <div className="bg-gray-900 border border-red-900/40 rounded-xl p-4 sm:p-5">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Danger Zone</div>
          <p className="text-xs text-gray-600 mb-3">
            Disable your InLinkr account and deactivate your links.
          </p>

          {(() => {
            const isPaid = user?.subscription_status === 'active';
            const hasReferralReward = hasActiveReferralReward(user);
            const hasEffectiveFreeAccess = !isPaid && !hasReferralReward;
            const isEligible = hasEffectiveFreeAccess;

            if (!isEligible) {
              return (
                <div className="px-3 py-2 bg-gray-800/40 border border-gray-700/30 rounded-xl">
                  <p className="text-xs text-gray-500">
                    {isPaid ? 'Please cancel your paid subscription before deleting your account.' : 'Please wait for your referral reward access to expire before deleting your account.'}
                  </p>
                </div>
              );
            }

            return (
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                className="py-2.5 px-5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {deleteLoading ? 'Deleting...' : 'Delete my account'}
              </button>
            );
          })()}
        </div>

      </div>

      <SubscriptionHubModal
        isOpen={showSubscriptionHub}
        onClose={() => setShowSubscriptionHub(false)}
        plan={getEffectivePlan(user)}
        user={user}
        onUpgradeToPro={handleUpgradeToPro}
        onUpgradeToProPlus={handleUpgradeToProPlus}
        onManageBilling={handleManageBilling}
      />
    </Layout>
  );
}
