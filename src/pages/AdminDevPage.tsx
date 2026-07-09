import { useState, useEffect } from 'react';

function StatCard({ label, value, valueColor = 'text-white' }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${valueColor}`}>{value}</div>
    </div>
  );
}

// Human-friendly event label mapping
function getEventLabel(eventType: string): string {
  const labelMap: Record<string, string> = {
    user_signed_up: 'New User',
    pro_upgraded: 'Pro Upgrade',
    founder_purchased: 'Founder Purchase',
  };
  return labelMap[eventType] || 'Activity';
}

// Event badge color mapping (based on friendly label)
function getEventBadgeColor(eventType: string): string {
  const colorMap: Record<string, string> = {
    user_signed_up: 'bg-green-900/30 text-green-400',
    pro_upgraded: 'bg-blue-900/30 text-blue-400',
    founder_purchased: 'bg-purple-900/30 text-purple-400',
  };
  return colorMap[eventType] || 'bg-gray-800 text-gray-400';
}

// Relative time formatter
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 172800) return 'Yesterday';
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export function AdminDevPage() {
  const [adminKey, setAdminKey] = useState('');
  const [founderEmail, setFounderEmail] = useState('');
  const [founderResult, setFounderResult] = useState<{ success: boolean; message: string; founderAccess?: any } | null>(null);
  const [founderLoading, setFounderLoading] = useState(false);
  
  // Referral feature flags state
  const [featureFlags, setFeatureFlags] = useState({
    referrals_enabled: false,
    referrals_ip_check_enabled: false,
    referrals_rewards_enabled: false,
  });
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [flagResult, setFlagResult] = useState<{ success: boolean; message: string } | null>(null);

  // Overview stats state
  const [overviewStats, setOverviewStats] = useState<{
    totalUsers: number;
    freeUsers: number;
    proUsers: number;
    founderUsers: number;
    activeCreatorHubs: number;
    totalSmartLinks: number;
    totalTrackedClicks: number;
    totalProofsGenerated: number;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Activity feed state
  const [activityEvents, setActivityEvents] = useState<Array<{
    id: string;
    event_type: string;
    target_user_id: number | null;
    event_title: string;
    event_description: string;
    metadata_json: string | null;
    severity: string;
    visibility_scope: string;
    created_at: string;
  }>>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Load feature flags, overview stats, and activity feed on component mount
  useEffect(() => {
    if (adminKey) {
      loadFeatureFlags();
      loadOverviewStats();
      loadActivityFeed();
    }
  }, [adminKey]);

  const loadFeatureFlags = async () => {
    if (!adminKey) return;
    
    setFlagsLoading(true);
    try {
      // Get Clerk token for authentication
      const clerk = (window as any).Clerk;
      let token = null;
      if (clerk && clerk.session) {
        token = await clerk.session.getToken();
      }

      const headers: Record<string, string> = {
        'x-admin-test-key': adminKey,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/admin/feature-flags', {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        setFeatureFlags(data.flags);
      }
    } catch (error) {
      console.error('Failed to load feature flags:', error);
    } finally {
      setFlagsLoading(false);
    }
  };

  const handleToggleFeatureFlag = async (key: string) => {
    if (!adminKey) {
      setFlagResult({
        success: false,
        message: 'Please enter Admin Test Key first',
      });
      return;
    }

    setFlagsLoading(true);
    setFlagResult(null);

    try {
      // Get Clerk token for authentication
      const clerk = (window as any).Clerk;
      let token = null;
      if (clerk && clerk.session) {
        token = await clerk.session.getToken();
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-admin-test-key': adminKey,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const currentEnabled = featureFlags[key as keyof typeof featureFlags];
      
      const response = await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          key,
          enabled: !currentEnabled,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setFeatureFlags(prev => ({
          ...prev,
          [key]: data.enabled,
        }));
        setFlagResult({
          success: true,
          message: `${key} is now ${data.enabled ? 'ON' : 'OFF'}`,
        });
      } else {
        const errorData = await response.json();
        setFlagResult({
          success: false,
          message: errorData.error || 'Failed to toggle feature flag',
        });
      }
    } catch (error) {
      setFlagResult({
        success: false,
        message: 'Network error: ' + (error instanceof Error ? error.message : 'Unknown error'),
      });
    } finally {
      setFlagsLoading(false);
    }
  };

  const handleFounderAction = async (action: 'status' | 'grant' | 'revoke') => {
    if (!founderEmail.trim()) {
      setFounderResult({
        success: false,
        message: 'Please enter an email address',
      });
      return;
    }

    setFounderLoading(true);
    setFounderResult(null);

    try {
      // Get Clerk token for authentication
      const clerk = (window as any).Clerk;
      let token = null;
      if (clerk && clerk.session) {
        token = await clerk.session.getToken();
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-admin-test-key': adminKey,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/admin/founder-access', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action,
          email: founderEmail.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const actionText = action === 'status' ? 'checked' : action === 'grant' ? 'granted' : 'revoked';
        const founderStatus = data.founderAccess ? 'has founder access' : 'no founder access';
        setFounderResult({
          success: true,
          message: `${action === 'status' ? 'Founder status' : `Founder access ${actionText}`} for ${data.user.email} (${data.user.username}): ${founderStatus}`,
          founderAccess: data.founderAccess,
        });
      } else {
        setFounderResult({
          success: false,
          message: data.error || 'Failed to process founder action',
        });
      }
    } catch (error) {
      setFounderResult({
        success: false,
        message: 'Network error: ' + (error instanceof Error ? error.message : 'Unknown error'),
      });
    } finally {
      setFounderLoading(false);
    }
  };

  const loadOverviewStats = async () => {
    if (!adminKey) return;
    
    setStatsLoading(true);
    setStatsError(null);
    
    try {
      const clerk = (window as any).Clerk;
      let token = null;
      if (clerk && clerk.session) {
        token = await clerk.session.getToken();
      }

      const headers: Record<string, string> = {
        'x-admin-test-key': adminKey,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/admin/overview-stats', {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        setOverviewStats(data.stats);
        setStatsError(null); // Clear any previous error on success
      } else {
        const errorData = await response.json();
        setStatsError(errorData.error || 'Failed to load overview stats');
      }
    } catch (error) {
      setStatsError('Network error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setStatsLoading(false);
    }
  };

  const loadActivityFeed = async () => {
    if (!adminKey) return;
    
    setActivityLoading(true);
    
    try {
      const clerk = (window as any).Clerk;
      let token = null;
      if (clerk && clerk.session) {
        token = await clerk.session.getToken();
      }

      const headers: Record<string, string> = {
        'x-admin-test-key': adminKey,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/admin/activity-feed', {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        setActivityEvents(data.events || []);
      }
    } catch (error) {
      console.error('Failed to load activity feed:', error);
    } finally {
      setActivityLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#0d1117] p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Admin Command Center
          </h1>
          <p className="text-blue-400 text-sm mb-6 font-medium">
            Platform controls, founder access, and business overview.
          </p>

          {/* Admin Access */}
          <div className="mb-8 p-4 bg-[#1c2128] border border-gray-700 rounded-lg">
            <h2 className="text-lg font-semibold text-white mb-2">Admin Access</h2>
            <p className="text-gray-400 text-sm mb-4">
              Enter your admin key to load protected platform controls.
            </p>
            <div>
              <label htmlFor="adminKey" className="block text-sm font-medium text-gray-300 mb-2">
                Admin Test Key
              </label>
              <input
                id="adminKey"
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Enter ADMIN_TEST_KEY from environment variables"
                className="w-full px-4 py-2 bg-[#0d1117] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Activity Feed */}
          {adminKey && (
            <div className="mb-8">
              <h2 className="text-xl font-bold text-white mb-4">Recent Activity</h2>
              {activityLoading ? (
                <div className="text-center text-gray-400 text-sm py-8">Loading activity feed...</div>
              ) : activityEvents.length === 0 ? (
                <div className="p-4 bg-[#1c2128] border border-gray-700 rounded-lg text-gray-400 text-sm">
                  No activity yet
                </div>
              ) : (
                <div className="space-y-3">
                  {activityEvents.map((event) => (
                    <div 
                      key={event.id} 
                      className="p-4 bg-[#1c2128] border border-gray-600 rounded-lg hover:border-gray-500 transition-colors"
                      title={event.event_type}
                    >
                      <div className="flex items-start gap-3">
                        <span 
                          className={`text-xs px-2 py-1 rounded font-medium ${getEventBadgeColor(event.event_type)}`}
                          title={event.event_type}
                        >
                          {getEventLabel(event.event_type)}
                        </span>
                        <div className="flex-1">
                          <div className="text-white text-sm">{event.event_description}</div>
                        </div>
                        <span 
                          className="text-xs text-gray-500 whitespace-nowrap"
                          title={new Date(event.created_at).toLocaleString()}
                        >
                          {formatRelativeTime(event.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Overview Stats Cards */}
          {adminKey && (
            <div className="mb-8">
              {statsError && !overviewStats && (
                <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-700 text-red-300 text-sm">
                  {statsError}
                </div>
              )}
              
              {statsLoading ? (
                <div className="text-center text-gray-400 text-sm py-8">Loading overview stats...</div>
              ) : overviewStats ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatCard label="Total Users" value={overviewStats.totalUsers.toLocaleString()} />
                  <StatCard label="Free Users" value={overviewStats.freeUsers.toLocaleString()} />
                  <StatCard label="Pro Users" value={overviewStats.proUsers.toLocaleString()} />
                  <StatCard label="Founder Users" value={overviewStats.founderUsers.toLocaleString()} />
                  <StatCard label="Total Smart Links" value={overviewStats.totalSmartLinks.toLocaleString()} />
                  <StatCard label="Total Clicks" value={overviewStats.totalTrackedClicks.toLocaleString()} />
                  <StatCard label="Proofs Generated" value={overviewStats.totalProofsGenerated.toLocaleString()} />
                  <StatCard label="Creator Hubs" value={overviewStats.activeCreatorHubs.toLocaleString()} />
                  <StatCard 
                    label="Referral System" 
                    value={featureFlags.referrals_enabled ? 'ON' : 'OFF'}
                    valueColor={featureFlags.referrals_enabled ? 'text-green-400' : 'text-gray-400'}
                  />
                </div>
              ) : null}
            </div>
          )}

          {/* Referral System Controls */}
          <div className="mt-8 pt-6 border-t border-gray-800">
            <h2 className="text-xl font-bold text-white mb-4">
              Referral System Controls
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Toggle referral system features on/off. Changes take effect immediately.
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#1c2128] rounded-lg">
                <div className="flex-1">
                  <h3 className="text-white font-medium">Referral System</h3>
                  <p className="text-gray-400 text-sm">Shows referral card and allows capture/qualification</p>
                </div>
                <button
                  onClick={() => handleToggleFeatureFlag('referrals_enabled')}
                  disabled={flagsLoading || !adminKey}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    featureFlags.referrals_enabled
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-600 hover:bg-gray-500 text-white'
                  } disabled:bg-gray-700 disabled:text-gray-400`}
                >
                  {flagsLoading ? '...' : featureFlags.referrals_enabled ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#1c2128] rounded-lg">
                <div className="flex-1">
                  <h3 className="text-white font-medium">IP Anti-Abuse Check</h3>
                  <p className="text-gray-400 text-sm">Requires qualifying clicks to pass IP check</p>
                </div>
                <button
                  onClick={() => handleToggleFeatureFlag('referrals_ip_check_enabled')}
                  disabled={flagsLoading || !adminKey}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    featureFlags.referrals_ip_check_enabled
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-600 hover:bg-gray-500 text-white'
                  } disabled:bg-gray-700 disabled:text-gray-400`}
                >
                  {flagsLoading ? '...' : featureFlags.referrals_ip_check_enabled ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#1c2128] rounded-lg">
                <div className="flex-1">
                  <h3 className="text-white font-medium">Referral Rewards</h3>
                  <p className="text-gray-400 text-sm">Reserved for future reward granting</p>
                </div>
                <button
                  onClick={() => handleToggleFeatureFlag('referrals_rewards_enabled')}
                  disabled={flagsLoading || !adminKey}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    featureFlags.referrals_rewards_enabled
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-600 hover:bg-gray-500 text-white'
                  } disabled:bg-gray-700 disabled:text-gray-400`}
                >
                  {flagsLoading ? '...' : featureFlags.referrals_rewards_enabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {flagResult && (
              <div
                className={`mt-4 p-4 rounded-lg ${
                  flagResult.success
                    ? 'bg-green-900/30 border border-green-700 text-green-300'
                    : 'bg-red-900/30 border border-red-700 text-red-300'
                }`}
              >
                {flagResult.message}
              </div>
            )}
          </div>

          {/* Founder Access Controls */}
          <div className="mt-8 pt-6 border-t border-gray-800">
            <h2 className="text-xl font-bold text-white mb-4">
              Founder Access Controls
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Manually grant or revoke Founder Access. Comped founders do not count toward the first 50 paid founder spots.
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="founderEmail" className="block text-sm font-medium text-gray-300 mb-2">
                  User Email
                </label>
                <input
                  id="founderEmail"
                  type="email"
                  value={founderEmail}
                  onChange={(e) => setFounderEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-4 py-2 bg-[#1c2128] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => handleFounderAction('status')}
                  disabled={founderLoading || !adminKey || !founderEmail.trim()}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    founderLoading || !adminKey || !founderEmail.trim()
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                  }`}
                >
                  {founderLoading ? 'Checking...' : 'Check Status'}
                </button>
                <button
                  onClick={() => handleFounderAction('grant')}
                  disabled={founderLoading || !adminKey || !founderEmail.trim()}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    founderLoading || !adminKey || !founderEmail.trim()
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {founderLoading ? 'Granting...' : 'Grant Access'}
                </button>
                <button
                  onClick={() => handleFounderAction('revoke')}
                  disabled={founderLoading || !adminKey || !founderEmail.trim()}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    founderLoading || !adminKey || !founderEmail.trim()
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {founderLoading ? 'Revoking...' : 'Revoke Access'}
                </button>
              </div>

              <div className="text-xs text-gray-500">
                Note: Comped founder access (granted via this tool) does not count toward the first 50 paid founder spots.
              </div>
            </div>

            {founderResult && (
              <div
                className={`mt-4 p-4 rounded-lg ${
                  founderResult.success
                    ? 'bg-green-900/30 border border-green-700 text-green-300'
                    : 'bg-red-900/30 border border-red-700 text-red-300'
                }`}
              >
                {founderResult.message}
                {founderResult.founderAccess && (
                  <div className="mt-2 text-xs">
                    {founderResult.founderAccess.is_comped && <span className="text-amber-400">Comped access • </span>}
                    {founderResult.founderAccess.source && <span>Source: {founderResult.founderAccess.source} • </span>}
                    {founderResult.founderAccess.granted_at && <span>Granted: {new Date(founderResult.founderAccess.granted_at).toLocaleString()}</span>}
                  </div>
                )}
              </div>
            )}
          </div>


        </div>
      </div>
    </div>
  );
}
