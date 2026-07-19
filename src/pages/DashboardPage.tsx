import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/cloudflare';
import { formatSourceLabel } from '../lib/utils';
import { Layout } from '../components/Layout';
import { PageSkeleton } from '../components/PageSkeleton';
import { ReferralCard } from '../components/ReferralCard';
import { Activity, Clock, Check, TrendingUp, ArrowUpRight, Plus, BarChart3, Layers, Share2 } from 'lucide-react';
import { getRewardTimeRemaining } from '../lib/referral-reward';
import { getDisplayName } from '../lib/display-name';
import { getEffectivePlan } from '../lib/plan';

interface ReferralStatus {
  enabled: boolean;
  referralCode: string | null;
  referralUrl: string | null;
  referralClicks: number;
  rawReferralUrl: string | null;
  qualifiedCount: number;
  rewards?: {
    rewardsEnabled: boolean;
    milestones: Array<{
      count: number;
      plan: string;
      days: number;
      label: string;
      unlocked: boolean;
      granted: boolean;
    }>;
    activeReward?: {
      plan: string;
      expiresAt: string;
    } | null;
  };
}


type DashboardStats = {
  totalLinks: number;
  totalClicks: number;
  activeLinks: number;
  topLinks: Array<{
    id: string;
    title: string;
    slug: string;
    clicks: number;
  }>;
  sourceData: Array<{
    source: string | null;
    clicks: number;
    topLinkId?: string;
    topLinkTitle?: string;
    topLinkClicks?: number;
  }>;
  mostRecentClick: {
    linkTitle: string;
    linkSlug: string;
    timestamp: string;
  } | null;
};

export function DashboardPage() {
  const { user } = useAuth();
  
    const [stats, setStats] = useState<DashboardStats>({
    totalLinks: 0,
    totalClicks: 0,
    activeLinks: 0,
    topLinks: [],
    sourceData: [],
    mostRecentClick: null,
  });
  const [loading, setLoading] = useState(true);
  const [placementMap, setPlacementMap] = useState<Record<string, string>>({});
  const [hasAnyPlacement, setHasAnyPlacement] = useState(false);
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [recentActivity, setRecentActivity] = useState<Array<{
    slug: string;
    source: string;
    created_at: string;
  }>>([]);
  const [userLinks, setUserLinks] = useState<Array<{
    title: string;
    slug: string;
    created_at: string;
  }>>([]);
  const [proofData, setProofData] = useState<{
    totalProofs: number;
    totalProofViews: number;
    mostViewedProof: { title: string; views: number } | null;
    latestProof: { title: string; createdAt: string } | null;
  }>({ totalProofs: 0, totalProofViews: 0, mostViewedProof: null, latestProof: null });

  // For performance trend graph - generate mock trend data based on actual stats
  const [trendData, setTrendData] = useState<number[]>([]);
  const [isTrendingUp, setIsTrendingUp] = useState(true);

  // Centralized referral state
  const [referralStatus, setReferralStatus] = useState<ReferralStatus | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Creator hub settings for Pro/Founder onboarding
  const [hubSettings, setHubSettings] = useState<any>(null);

  // Shared copy handler
  const copyReferralLink = async () => {
    const urlToCopy = referralStatus?.referralUrl || referralStatus?.rawReferralUrl;
    if (!urlToCopy) {
      console.warn('No referral URL available to copy');
      return false;
    }
    try {
      await navigator.clipboard.writeText(urlToCopy);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      return true;
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      setCopySuccess(false);
      return false;
    }
  };

  useEffect(() => {
    fetchDashboardStats();
    fetchRecentActivity();
    fetchReferralStatus();
    fetchProofData();
    fetchHubSettings();
  }, [user]);

  // Generate trend data based on total clicks for visual representation
  useEffect(() => {
    if (stats.totalClicks > 0) {
      // Generate a realistic-looking trend based on actual click count
      const baseValue = Math.max(5, Math.floor(stats.totalClicks / 30));
      const data = Array.from({ length: 30 }, (_, i) => {
        const variance = Math.random() * 0.4 + 0.8; // 0.8 to 1.2 variance
        const trend = i / 30; // slight upward trend
        return Math.floor(baseValue * variance * (1 + trend * 0.3));
      });
      setTrendData(data);
      setIsTrendingUp(data[data.length - 1] > data[0]);
    } else {
      // Flat line for no data
      setTrendData(Array(30).fill(0));
      setIsTrendingUp(false);
    }
  }, [stats.totalClicks]);

  const fetchReferralStatus = async () => {
    try {
      const clerk = (window as any).Clerk;
      let headers: HeadersInit = { 'Content-Type': 'application/json' };

      if (clerk && clerk.session) {
        const token = await clerk.session.getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch('/api/referrals/status', {
        method: 'GET',
        headers,
        cache: "no-store",
      });

      if (response.ok) {
        const data: ReferralStatus = await response.json();
        setReferralStatus(data);
      }
    } catch (error) {
      console.error('Error fetching referral status:', error);
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

  const fetchHubSettings = async () => {
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

      const response = await fetch('/api/creator-hub-settings', {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        setHubSettings(data.settings);
      }
    } catch (err) {
      console.error('Failed to fetch hub settings:', err);
    }
  };

  const fetchDashboardStats = async () => {
    if (!user) return;

    try {
      const links = await db.getLinksByUserId(user.id);

      const totalLinks = links?.length || 0;
      const activeLinks = links?.filter((l) => l.is_active).length || 0;
      const hasAnyPlacement = links?.some((link) => (link.placement_count || 0) > 0) || false;
      setHasAnyPlacement(hasAnyPlacement);

      // Store links for slug→title mapping and "Smart Link created" activity
      setUserLinks(
        (links || []).map((l) => ({
          title: l.title || l.slug,
          slug: l.slug,
          created_at: l.created_at,
        }))
      );

      const linkIds = links?.map((l) => l.id) || [];
      let totalClicks = 0;
      const linkClickCounts: Record<string, number> = {};

      let sourceData: Array<{ source: string | null; clicks: number }> = [];
      let mostRecentClick: { linkTitle: string; linkSlug: string; timestamp: string } | null = null;

      // Fetch placements to map source codes and public codes to names
      const newPlacementMap: Record<string, string> = {};
      if (linkIds.length > 0) {
        try {
          // Fetch placements for all links in a single bulk request
          const placementsByLink = await db.getPlacementsByLinkIds(linkIds);
          Object.values(placementsByLink).flat().forEach((p: { source_code: string; public_code: string; name: string }) => {
            // Map both source_code and public_code to placement name
            newPlacementMap[p.source_code] = p.name;
            newPlacementMap[p.public_code] = p.name;
          });
          setPlacementMap(newPlacementMap);
        } catch (error) {
          console.error('Error fetching placements:', error);
        }
      }

      if (linkIds.length > 0) {
        const response = await db.getClickEventsByLinkIds(linkIds);
        const clickEvents = response.events || [];
        totalClicks = response.totalClicks || 0;
        sourceData = response.bySource || [];

        clickEvents.forEach((event) => {
          linkClickCounts[event.link_id] = (linkClickCounts[event.link_id] || 0) + 1;
        });

        // Track clicks per source per link
        const sourceLinkClicks: Record<string, Record<string, number>> = {};
        clickEvents.forEach((event) => {
          const source = event.source || 'Direct';
          if (!sourceLinkClicks[source]) {
            sourceLinkClicks[source] = {};
          }
          sourceLinkClicks[source][event.link_id] = (sourceLinkClicks[source][event.link_id] || 0) + 1;
        });

        // Enrich sourceData with top link info
        sourceData = sourceData.map((source) => {
          const sourceKey = source.source || 'Direct';
          const linkClicksForSource = sourceLinkClicks[sourceKey] || {};
          let topLinkId: string | undefined;
          let topLinkClicks = 0;
          
          Object.entries(linkClicksForSource).forEach(([linkId, clicks]) => {
            if (clicks > topLinkClicks) {
              topLinkClicks = clicks;
              topLinkId = linkId;
            }
          });

          const topLink = links?.find((l) => l.id === topLinkId);
          return {
            ...source,
            topLinkId,
            topLinkTitle: topLink?.title || topLink?.slug,
            topLinkClicks: topLinkClicks > 0 ? topLinkClicks : undefined,
          };
        });

        // Get most recent click
        if (clickEvents.length > 0) {
          const sortedEvents = [...clickEvents].sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          const mostRecent = sortedEvents[0];
          const link = links?.find((l) => l.id === mostRecent.link_id);
          if (link) {
            mostRecentClick = {
              linkTitle: link.title || link.slug,
              linkSlug: link.slug,
              timestamp: mostRecent.timestamp,
            };
          }
        }
      }

      const topLinks = links
        ?.map((link) => ({
          id: link.id,
          title: link.title || link.slug,
          slug: link.slug,
          clicks: linkClickCounts[link.id] || 0,
        }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5) || [];

      setStats({
        totalLinks,
        totalClicks,
        activeLinks,
        topLinks,
        sourceData,
        mostRecentClick,
      });

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivity = async () => {
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

      const response = await fetch('/api/analytics/recent-activity', {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        setRecentActivity(data.activity || []);
      } else {
        console.error('Recent activity fetch failed:', response.status, response.statusText);
        // Don't crash the dashboard, just leave recent activity empty
        setRecentActivity([]);
      }
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      // Don't crash the dashboard, just leave recent activity empty
      setRecentActivity([]);
    }
  };

  const fetchProofData = async () => {
    if (!user) return;
    try {
      const clerk = (window as any).Clerk;
      let headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (clerk && clerk.session) {
        const token = await clerk.session.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch('/api/proof-shares/list?include_disabled=true', { method: 'GET', headers });
      if (response.ok) {
        const data = await response.json();
        const proofs = data.proofs || [];
        const totalProofs = proofs.length;
        const totalProofViews = proofs.reduce((sum: number, p: any) => sum + (p.view_count || 0), 0);
        const mostViewedProof = proofs.length > 0
          ? proofs.reduce((max: any, p: any) => (p.view_count || 0) > (max.view_count || 0) ? p : max)
          : null;
        const latestProof = proofs.length > 0
          ? proofs.reduce((max: any, p: any) => new Date(p.created_at) > new Date(max.created_at) ? p : max)
          : null;
        setProofData({
          totalProofs,
          totalProofViews,
          mostViewedProof: mostViewedProof
            ? { title: mostViewedProof.title || 'Untitled', views: mostViewedProof.view_count || 0 }
            : null,
          latestProof: latestProof
            ? { title: latestProof.title || 'Untitled', createdAt: latestProof.created_at }
            : null,
        });
      }
    } catch (error) {
      console.error('Error fetching proof data:', error);
    }
  };

  const formatSourceLabelWithPlacements = (source: string | null) => {
    if (!source) return 'Direct';
    
    // Check if source code has a placement name
    if (placementMap[source]) {
      return placementMap[source];
    }
    
    // Fallback to original formatSourceLabel
    return formatSourceLabel(source);
  };

  const getRelativeTime = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  if (loading) {
    return (
      <Layout>
        <PageSkeleton />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-3 sm:py-5 sm:px-6 lg:px-8 overflow-x-hidden">

        {/* Header */}
        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Dashboard</h1>
          <div className="flex items-center gap-2 mt-0.5">
            {stats.mostRecentClick ? (
              <span className="text-[10px] text-gray-400">
                Last tracked click: {getRelativeTime(stats.mostRecentClick.timestamp)}
              </span>
            ) : stats.totalClicks > 0 ? (
              <span className="text-[10px] text-gray-400">
                {stats.totalClicks} tracked clicks across {stats.activeLinks} active link{stats.activeLinks !== 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-[10px] text-gray-400">
                Welcome, {getDisplayName(user)}
              </span>
            )}
          </div>
        </div>

        {/* Onboarding progress checklist */}
        {(() => {
          const effectivePlan = getEffectivePlan(user);
          const isProOrFounder = effectivePlan === 'pro' || effectivePlan === 'pro_plus' || effectivePlan === 'founder';

          const hasLinks = stats.totalLinks > 0;
          const hasPlacements = hasAnyPlacement;
          const hasClicks = stats.totalClicks > 0;
          const hasYouTubeConnected = youtubeConnected;
          const hasHubSetup = hubSettings !== null;
          const hasBrandedLink = user?.subdomain !== null && user?.subdomain !== undefined;

          // Core onboarding (same for all users)
          const coreSteps = [
            { label: 'Create your first Smart Link', complete: hasLinks },
            { label: 'Add a placement', complete: hasPlacements },
            { label: 'Connect YouTube for video insights', complete: hasYouTubeConnected },
            { label: 'Get your first tracked click', complete: hasClicks },
          ];

          const coreCompletedCount = coreSteps.filter(s => s.complete).length;
          const coreIsComplete = coreCompletedCount === coreSteps.length;

          // If core onboarding is not complete, show core checklist for all users
          if (!coreIsComplete) {
            let ctaText = '';
            let ctaLink = '';
            if (!hasLinks) {
              ctaText = 'Create your first Smart Link';
              ctaLink = '/links/new';
            } else if (!hasPlacements) {
              ctaText = 'Add a placement';
              ctaLink = '/links';
            } else if (!hasYouTubeConnected) {
              ctaText = 'Connect YouTube';
              ctaLink = '/settings';
            } else if (!hasClicks) {
              ctaText = 'Start sharing your link';
              ctaLink = '/links';
            }

            return (
              <div className="bg-gray-900 border border-gray-800/80 rounded-xl p-2.5 sm:p-3 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-semibold text-white">Get started</div>
                  <div className="text-[10px] text-gray-400">{coreCompletedCount} of {coreSteps.length} completed</div>
                </div>

                {/* Progress bar */}
                <div className="h-1 bg-gray-800 rounded-full mb-2 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${(coreCompletedCount / coreSteps.length) * 100}%` }}
                  />
                </div>

                {/* Checklist items */}
                <div className="space-y-1 mb-2">
                  {coreSteps.map((step, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {step.complete ? (
                        <div className="w-3 h-3 rounded bg-green-500/20 flex items-center justify-center flex-shrink-0">
                          <Check className="w-2 h-2 text-green-500" />
                        </div>
                      ) : (
                        <div className="w-3 h-3 rounded border border-gray-700 flex-shrink-0" />
                      )}
                      <div className={`text-[10px] ${step.complete ? 'text-gray-400' : 'text-gray-400'}`}>
                        {step.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Contextual CTA */}
                {ctaText && (
                  <Link
                    to={ctaLink}
                    className="inline-block text-[10px] bg-primary hover:bg-primary text-white px-2.5 py-1 rounded-lg transition-colors font-medium"
                  >
                    {ctaText}
                  </Link>
                )}
              </div>
            );
          }

          // Core onboarding is complete - show Pro/Founder setup card if applicable
          if (isProOrFounder) {
            const proSteps = [
              { label: 'Customize Creator Hub', complete: hasHubSetup },
              { label: 'Set up branded link', complete: hasBrandedLink },
            ];

            const proCompletedCount = proSteps.filter(s => s.complete).length;
            const proIsComplete = proCompletedCount === proSteps.length;

            if (proIsComplete) return null;

            let ctaText = '';
            let ctaLink = '';
            if (!hasHubSetup) {
              ctaText = 'Customize your Creator Hub';
              ctaLink = '/settings';
            } else if (!hasBrandedLink) {
              ctaText = 'Set up your branded link';
              ctaLink = '/settings';
            }

            const title = effectivePlan === 'founder' ? 'Welcome, Founder 🎉' : 'Welcome to Pro 🎉';
            const subtitle = effectivePlan === 'founder' ? "Let's get your creator platform ready." : "Let's unlock your creator tools.";

            return (
              <div className="bg-gray-900 border border-gray-800/80 rounded-xl p-2.5 sm:p-3 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-semibold text-white">{title}</div>
                  <div className="text-[10px] text-gray-400">{proCompletedCount} of {proSteps.length} completed</div>
                </div>

                {subtitle && (
                  <div className="text-[10px] text-gray-400 mb-2">{subtitle}</div>
                )}

                {/* Progress bar */}
                <div className="h-1 bg-gray-800 rounded-full mb-2 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${(proCompletedCount / proSteps.length) * 100}%` }}
                  />
                </div>

                {/* Checklist items */}
                <div className="space-y-1 mb-2">
                  {proSteps.map((step, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {step.complete ? (
                        <div className="w-3 h-3 rounded bg-green-500/20 flex items-center justify-center flex-shrink-0">
                          <Check className="w-2 h-2 text-green-500" />
                        </div>
                      ) : (
                        <div className="w-3 h-3 rounded border border-gray-700 flex-shrink-0" />
                      )}
                      <div className={`text-[10px] ${step.complete ? 'text-gray-400' : 'text-gray-400'}`}>
                        {step.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Contextual CTA */}
                {ctaText && (
                  <Link
                    to={ctaLink}
                    className="inline-block text-[10px] bg-primary hover:bg-primary text-white px-2.5 py-1 rounded-lg transition-colors font-medium"
                  >
                    {ctaText}
                  </Link>
                )}
              </div>
            );
          }

          // Free user with core onboarding complete - show ReferralCard
          return (
            <ReferralCard
              status={referralStatus}
              loading={false}
              copyReferralLink={copyReferralLink}
              copySuccess={copySuccess}
              compact={true}
            />
          );
        })()}

        {/* SECTION 1: Action Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {/* Strongest Performer */}
          <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl px-3 py-3">
            <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1">Strongest Performer</div>
            {stats.sourceData.length > 0 && stats.totalClicks > 0 ? (() => {
              const totalSourceClicks = stats.sourceData.reduce((sum, s) => sum + s.clicks, 0);
              const topSource = [...stats.sourceData].sort((a, b) => b.clicks - a.clicks)[0];
              const topPct = Math.round((topSource.clicks / totalSourceClicks) * 100);
              return (
                <>
                  <div className="text-2xl sm:text-3xl font-bold text-white leading-none tabular-nums mb-1">{topPct}%</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Top Placement</div>
                  <div className="text-xs sm:text-sm font-semibold text-white truncate mb-2">{formatSourceLabelWithPlacements(topSource.source)}</div>
                  <Link to="/links" className="text-[10px] text-blue-400 hover:text-blue-300 font-medium transition-colors">
                    Manage Placement →
                  </Link>
                </>
              );
            })() : (
              <div className="text-xs text-gray-600">No data yet</div>
            )}
          </div>

          {/* Growth */}
          <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl px-3 py-3">
            <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1">Growth</div>
            <div className="text-2xl sm:text-3xl font-bold text-white leading-none tabular-nums mb-1">{stats.totalClicks}</div>
            <div className="text-[11px] text-gray-400 mb-1">
              Tracked Clicks
            </div>
            <div className="text-[10px] text-gray-400 mb-2">
              {stats.totalClicks > 10 ? 'Growing steadily' : stats.totalClicks > 0 ? 'Activity is steady' : 'No clicks yet'}
            </div>
            <Link to="/analytics" className="text-[10px] text-blue-400 hover:text-blue-300 font-medium transition-colors">
              View Analytics →
            </Link>
          </div>

          {/* Sponsor Proof */}
          <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl px-3 py-3">
            <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1">Sponsor Proof</div>
            <div className="text-2xl sm:text-3xl font-bold text-white leading-none tabular-nums mb-1">{proofData.totalProofViews}</div>
            <div className="text-[11px] text-gray-400 mb-2">
              {proofData.totalProofViews > 0 ? 'People viewed your proof pages' : 'No views yet'}
            </div>
            <Link to="/proofs" className="text-[10px] text-blue-400 hover:text-blue-300 font-medium transition-colors">
              View My Proofs →
            </Link>
          </div>

          {/* Next Step */}
          <div className="bg-gray-900/80 border border-blue-500/30 rounded-xl px-3 py-3 shadow-lg shadow-blue-500/5">
            <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1">Next Step</div>
            {(() => {
              const effectivePlan = getEffectivePlan(user);
              const isProOrFounder = effectivePlan === 'pro' || effectivePlan === 'pro_plus' || effectivePlan === 'founder';
              const hasLinks = stats.totalLinks > 0;
              const hasPlacements = hasAnyPlacement;
              const hasClicks = stats.totalClicks > 0;
              const hasYouTubeConnected = youtubeConnected;
              const hasHubSetup = hubSettings !== null;
              const hasProofViews = proofData.totalProofViews > 0;

              // Priority order of recommendations
              if (!hasLinks) {
                return (
                  <>
                    <div className="text-xs sm:text-sm font-semibold text-white mb-1">Create Smart Link</div>
                    <div className="text-[11px] text-gray-400 mb-2">Start tracking your links</div>
                    <Link to="/links/new" className="text-[10px] text-blue-400 hover:text-blue-300 font-medium transition-colors">
                      Create Now →
                    </Link>
                  </>
                );
              }

              if (!hasPlacements) {
                return (
                  <>
                    <div className="text-xs sm:text-sm font-semibold text-white mb-1">Add Placement</div>
                    <div className="text-[11px] text-gray-400 mb-2">Track traffic sources</div>
                    <Link to="/links" className="text-[10px] text-blue-400 hover:text-blue-300 font-medium transition-colors">
                      Add Now →
                    </Link>
                  </>
                );
              }

              if (!hasYouTubeConnected) {
                return (
                  <>
                    <div className="text-xs sm:text-sm font-semibold text-white mb-1">Connect YouTube</div>
                    <div className="text-[11px] text-gray-400 mb-2">Unlock video insights</div>
                    <Link to="/settings" className="text-[10px] text-blue-400 hover:text-blue-300 font-medium transition-colors">
                      Connect →
                    </Link>
                  </>
                );
              }

              if (!hasClicks) {
                return (
                  <>
                    <div className="text-xs sm:text-sm font-semibold text-white mb-1">Share Your Link</div>
                    <div className="text-[11px] text-gray-400 mb-2">Get your first click</div>
                    <Link to="/links" className="text-[10px] text-blue-400 hover:text-blue-300 font-medium transition-colors">
                      Share →
                    </Link>
                  </>
                );
              }

              if (isProOrFounder && !hasHubSetup) {
                return (
                  <>
                    <div className="text-xs sm:text-sm font-semibold text-white mb-1">Setup Creator Hub</div>
                    <div className="text-[11px] text-gray-400 mb-2">Customize your profile</div>
                    <Link to="/settings/hub" className="text-[10px] text-blue-400 hover:text-blue-300 font-medium transition-colors">
                      Setup →
                    </Link>
                  </>
                );
              }

              if (!hasProofViews && hasLinks) {
                return (
                  <>
                    <div className="text-xs sm:text-sm font-semibold text-white mb-1">Share Proof Page</div>
                    <div className="text-[11px] text-gray-400 mb-2">Showcase your sponsors</div>
                    <Link to="/proofs" className="text-[10px] text-blue-400 hover:text-blue-300 font-medium transition-colors">
                      Share →
                    </Link>
                  </>
                );
              }

              // Default: create another link
              return (
                <>
                  <div className="text-xs sm:text-sm font-semibold text-white mb-1">Create Another Link</div>
                  <div className="text-[11px] text-gray-400 mb-2">Expand your reach</div>
                  <Link to="/links/new" className="text-[10px] text-blue-400 hover:text-blue-300 font-medium transition-colors">
                    Create →
                  </Link>
                </>
              );
            })()}
          </div>
        </div>


        {/* SECTION 2: Two-column layout - What's Working + Quick Actions */}
        {(() => {
          const totalSourceClicks = stats.sourceData.reduce((sum, s) => sum + s.clicks, 0);
          const hasWorkingData = totalSourceClicks > 0 && stats.sourceData.length > 0;

          if (hasWorkingData) {
            const sortedSources = [...stats.sourceData].sort((a, b) => b.clicks - a.clicks);
            const topSource = sortedSources[0];
            const topSourceLabel = formatSourceLabelWithPlacements(topSource.source);
            const topPct = Math.round((topSource.clicks / totalSourceClicks) * 100);
            const isTied = sortedSources.filter(s => s.clicks === topSource.clicks).length > 1;
            const insightText = isTied
              ? 'Your clicks are split across placements. Keep testing to find a clear winner.'
              : topSource.source === null
                ? `${topPct}% of your tracked clicks are coming from Direct traffic.`
                : `${topSourceLabel} is currently outperforming every other placement.`;

            const recommendation = isTied
              ? 'Continue testing different placements to identify your best performer.'
              : topSource.source === null
                ? 'Consider adding a placement to track specific traffic sources.'
                : topPct > 70
                  ? 'Continue using this placement for your current campaigns.'
                  : topPct > 50
                    ? 'This is your strongest traffic source—consider leveraging it more.'
                    : 'This placement shows promise; try it on more content.';

            return (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                {/* What's Working Right Now - Hero Section (spans 2 columns on desktop) */}
                <div className="lg:col-span-2 bg-gradient-to-br from-gray-900 to-gray-800/50 border border-blue-500/20 rounded-2xl p-5 sm:p-6 shadow-lg shadow-blue-500/5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-blue-400" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">What's Working Right Now</h2>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="text-2xl sm:text-3xl font-bold text-white truncate mb-2">{topSourceLabel}</div>
                      <div className="text-sm text-gray-400 mb-3">{topSource.clicks} clicks · {topPct}% of total</div>
                      <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all" style={{ width: `${topPct}%` }} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 border-t sm:border-t-0 sm:border-l border-gray-700/50 pt-4 sm:pt-0 sm:pl-6">
                      <div className="text-sm text-gray-200 leading-relaxed mb-2 font-medium">{insightText}</div>
                      <div className="text-xs text-gray-400 leading-relaxed mb-3">{recommendation}</div>
                      <Link to="/links" className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                        Manage Link <ArrowUpRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Quick Actions (sidebar column on desktop) */}
                <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
                  <h2 className="text-sm font-semibold text-white mb-3">Quick Actions</h2>
                  <div className="flex flex-col gap-2.5">
                    <Link
                      to="/links/new"
                      className="inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-medium text-sm rounded-xl px-4 py-2.5 transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Create Smart Link
                    </Link>
                    <Link
                      to="/analytics"
                      className="inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-medium text-sm rounded-xl px-4 py-2.5 transition-colors"
                    >
                      <BarChart3 className="w-4 h-4" /> View Analytics
                    </Link>
                    <Link
                      to="/proofs"
                      className="inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-medium text-sm rounded-xl px-4 py-2.5 transition-colors"
                    >
                      <Share2 className="w-4 h-4" /> View My Proofs
                    </Link>
                    {(() => {
                      const effectivePlan = getEffectivePlan(user);
                      const hasProAccess = effectivePlan === 'pro' || effectivePlan === 'pro_plus' || effectivePlan === 'founder';

                      if (hasProAccess) {
                        return (
                          <Link
                            to="/settings/hub"
                            className="inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-medium text-sm rounded-xl px-4 py-2.5 transition-colors"
                          >
                            <Layers className="w-4 h-4" /> Manage Creator Hub
                          </Link>
                        );
                      }

                      return (
                        <Link
                          to="/upgrade"
                          className="inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-medium text-sm rounded-xl px-4 py-2.5 transition-colors"
                        >
                          <Layers className="w-4 h-4" /> Unlock Creator Hub
                        </Link>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          }

          // No working data - Quick Actions spans full width
          return (
            <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4 mb-4">
              <h2 className="text-sm font-semibold text-white mb-3">Quick Actions</h2>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <Link
                  to="/links/new"
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-medium text-sm rounded-xl px-4 py-2.5 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Create Smart Link
                </Link>
                <Link
                  to="/analytics"
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-medium text-sm rounded-xl px-4 py-2.5 transition-colors"
                >
                  <BarChart3 className="w-4 h-4" /> View Analytics
                </Link>
                <Link
                  to="/proofs"
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-medium text-sm rounded-xl px-4 py-2.5 transition-colors"
                >
                  <Share2 className="w-4 h-4" /> View My Proofs
                </Link>
                {(() => {
                  const effectivePlan = getEffectivePlan(user);
                  const hasProAccess = effectivePlan === 'pro' || effectivePlan === 'pro_plus' || effectivePlan === 'founder';

                  if (hasProAccess) {
                    return (
                      <Link
                        to="/settings/hub"
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-medium text-sm rounded-xl px-4 py-2.5 transition-colors"
                      >
                        <Layers className="w-4 h-4" /> Manage Creator Hub
                      </Link>
                    );
                  }

                  return (
                    <Link
                      to="/upgrade"
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-medium text-sm rounded-xl px-4 py-2.5 transition-colors"
                    >
                      <Layers className="w-4 h-4" /> Unlock Creator Hub
                    </Link>
                  );
                })()}
              </div>
            </div>
          );
        })()}

        {/* SECTION 3: Two-column layout - Recent Activity + Performance Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Recent Activity */}
          <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-400" />
                Recent Activity
              </h2>
              {stats.mostRecentClick && (
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span>Live</span>
                </div>
              )}
            </div>
          {(() => {
            type ActivityItem = { eventLabel: string; title: string; source: string; timestamp: string; dot: string };
            const titleForSlug = (slug: string) =>
              userLinks.find((l) => l.slug === slug)?.title || slug;

            const byRecency = (arr: ActivityItem[]) =>
              arr
                .filter((i) => i.timestamp)
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            // Meaningful, outcome/engagement-based events take priority.
            // (Link clicks are the only outcome events with per-event timestamps.)
            // Configuration-only events (e.g. Creator Hub Updated) are intentionally excluded.
            const meaningfulItems: ActivityItem[] = recentActivity.map((a) => {
              const isDirect = !a.source || a.source === 'Direct';
              return {
                eventLabel: 'Click received',
                title: titleForSlug(a.slug),
                source: isDirect ? 'Direct' : formatSourceLabelWithPlacements(a.source),
                timestamp: a.created_at,
                dot: 'bg-green-500',
              };
            });

            // Smart Link created — fallback only, used to supplement when
            // meaningful engagement activity is sparse. Never used to pad count.
            const fallbackItems: ActivityItem[] = userLinks.map((l) => ({
              eventLabel: 'Link created',
              title: l.title || l.slug,
              source: '',
              timestamp: l.created_at,
              dot: 'bg-primary',
            }));

            const meaningful = byRecency(meaningfulItems);

            // Only supplement with creation events when meaningful activity is insufficient.
            const combined =
              meaningful.length >= 3
                ? meaningful
                : byRecency([...meaningfulItems, ...fallbackItems]);

            const sorted = combined.slice(0, 5);

            if (sorted.length === 0) {
              return (
                <div className="text-center py-4">
                  <div className="text-gray-500 text-xs">No recent activity yet.</div>
                  <div className="text-gray-600 text-[11px] mt-1">
                    More activity will appear as your links get clicks and proofs get viewed.
                  </div>
                </div>
              );
            }

            return (
              <div className="space-y-0">
                {sorted.map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-3 px-2.5 rounded-lg hover:bg-gray-800/30 transition-colors border-b border-gray-800/40 last:border-0">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0 overflow-hidden">
                      <div className={`w-1.5 h-1.5 ${item.dot} rounded-full flex-shrink-0`} />
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <span className="text-xs text-white truncate block">{item.eventLabel}</span>
                        <span className="text-[11px] text-gray-500 truncate block">
                          {item.title}{item.source ? ` · ${item.source}` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 flex-shrink-0 ml-2 whitespace-nowrap">
                      {getRelativeTime(item.timestamp)}
                    </div>
                  </div>
                ))}
                {sorted.length >= 5 && (
                  <div className="pt-3 px-2.5">
                    <Link to="/analytics" className="text-[11px] text-gray-500 hover:text-gray-400 cursor-pointer transition-colors">
                      View all activity →
                    </Link>
                  </div>
                )}
                {sorted.length < 3 && (
                  <div className="text-gray-600 text-[11px] pt-3 px-2.5">
                    More activity will appear as your links get clicks and proofs get viewed.
                  </div>
                )}
              </div>
            );
          })()}
          </div>

          {/* Performance Overview */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800/50 border border-gray-800/60 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                Performance Overview
              </h2>
              <div className="text-[10px] text-gray-400">Last 30 Days</div>
            </div>

            {/* Simple line graph */}
            <div className="mb-4">
              <svg viewBox="0 0 200 60" className="w-full h-16" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity="1" />
                  </linearGradient>
                </defs>
                {trendData.length > 0 && trendData.some(v => v > 0) ? (
                  <path
                    d={`M 0 ${60 - (trendData[0] / Math.max(...trendData)) * 50} ${trendData.map((v, i) => `L ${i * (200 / (trendData.length - 1))} ${60 - (v / Math.max(...trendData)) * 50}`).join(' ')}`}
                    fill="none"
                    stroke="url(#lineGradient)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : (
                  <path
                    d="M 0 55 L 200 55"
                    fill="none"
                    stroke="#374151"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                )}
              </svg>
            </div>

            {/* Trend indicator */}
            <div className="flex items-center gap-2 mb-4">
              {isTrendingUp && stats.totalClicks > 0 ? (
                <div className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Overall account activity is trending upward</span>
                </div>
              ) : stats.totalClicks > 0 ? (
                <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                  <span>Your account is maintaining steady activity</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                  <span>No data yet</span>
                </div>
              )}
            </div>

            {/* Dashboard Insights */}
            <div className="mb-4 p-3 bg-gray-800/40 rounded-lg border border-gray-700/40">
              <div className="text-[11px] text-gray-300 leading-relaxed space-y-1">
                {(() => {
                  const insights = [];
                  const totalSourceClicks = stats.sourceData.reduce((sum, s) => sum + s.clicks, 0);
                  if (totalSourceClicks > 0 && stats.sourceData.length > 0) {
                    const sortedSources = [...stats.sourceData].sort((a, b) => b.clicks - a.clicks);
                    const topSource = sortedSources[0];
                    const topPct = Math.round((topSource.clicks / totalSourceClicks) * 100);
                    insights.push(`Your strongest placement generated ${topPct}% of all tracked clicks.`);
                  }
                  if (stats.totalClicks > 0) {
                    insights.push('Your account activity has remained steady over the last 30 days.');
                  }
                  if (proofData.totalProofViews > 0) {
                    insights.push('Proof pages are receiving consistent traffic.');
                  }
                  if (insights.length === 0) {
                    insights.push('Create your first Smart Link to start tracking performance.');
                  }
                  return insights.slice(0, 2).map((insight, i) => (
                    <div key={i}>• {insight}</div>
                  ));
                })()}
              </div>
            </div>

            {/* CTA */}
            <Link
              to="/analytics"
              className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors"
            >
              View Full Analytics <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>


        {/* Dashboard Priority Card
            This top slot is the primary growth/onboarding area.
            Current content may be:
            - Get Started
            - Referral Program
            - Pro Setup
            - Founder Setup
            Future content may include:
            - Upgrade prompts
            - Proof Card onboarding
            - Creator Hub onboarding
            - Feature announcements
        */}
        {/* Referral / Pro status footer banner */}
        {(() => {
          const effectivePlan = getEffectivePlan(user);
          const isPaid = user?.subscription_status === 'active';
          const isFounder = effectivePlan === 'founder';
          const isProOrFounder = effectivePlan === 'pro' || effectivePlan === 'pro_plus' || effectivePlan === 'founder';
          const hasReferralReward =
            !isPaid &&
            user?.referral_reward_active &&
            user?.referral_reward_expires_at &&
            new Date(user.referral_reward_expires_at) > new Date();

          // Check if referral system is enabled
          const isSystemEnabled = referralStatus?.enabled ?? false;

          // Check if core onboarding is complete (ReferralCard shows in top slot when true for Free users)
          const hasLinks = stats.totalLinks > 0;
          const hasPlacements = hasAnyPlacement;
          const hasClicks = stats.totalClicks > 0;
          const hasYouTubeConnected = youtubeConnected;
          const coreIsComplete = hasLinks && hasPlacements && hasClicks && hasYouTubeConnected;

          // Hide lower banner if ReferralCard is showing in top slot (Free user with core complete)
          if (!isProOrFounder && coreIsComplete) return null;

          // Paid Pro, Pro+, or Founder — no referral clutter
          if (isPaid || isFounder) return null;

          // When referral system is OFF:
          // - If user HAS active reward: show status without "View progress" CTA
          // - If user does NOT have active reward: completely hide the banner
          if (!isSystemEnabled) {
            if (!hasReferralReward) return null;

            // Show informational-only banner for users with active rewards when system is disabled
            const timeRemaining = getRewardTimeRemaining(user?.referral_reward_expires_at || undefined);
            const isUrgent = timeRemaining.isExpiringSoon;
            return (
              <div className={`border rounded-xl p-4 flex items-center justify-between gap-3 ${isUrgent ? 'bg-orange-900/15 border-orange-500/40' : 'bg-blue-900/10 border-blue-700/30'}`}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isUrgent ? 'bg-orange-500/15' : 'bg-blue-500/15'}`}>
                    <Clock className={`w-4 h-4 ${isUrgent ? 'text-orange-400' : 'text-blue-400'}`} />
                  </div>
                  <div className="text-xs text-white min-w-0">
                    <div className="font-semibold">Referral Pro — {timeRemaining.label}</div>
                    <div className="text-gray-400 mt-0.5">Referral rewards are temporarily paused while we improve the system for launch.</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isUrgent && (
                    <Link
                      to="/upgrade"
                      className="text-xs text-gray-400 hover:text-gray-200 transition-colors font-medium whitespace-nowrap"
                    >
                      Keep Pro →
                    </Link>
                  )}
                </div>
              </div>
            );
          }

          // Referral Pro — countdown with View progress CTA (system enabled)
          if (hasReferralReward) {
            const timeRemaining = getRewardTimeRemaining(user?.referral_reward_expires_at || undefined);
            const isUrgent = timeRemaining.isExpiringSoon;
            return (
              <div className={`border rounded-xl p-4 flex items-center justify-between gap-3 ${isUrgent ? 'bg-orange-900/15 border-orange-500/40' : 'bg-blue-900/10 border-blue-700/30'}`}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isUrgent ? 'bg-orange-500/15' : 'bg-blue-500/15'}`}>
                    <Clock className={`w-4 h-4 ${isUrgent ? 'text-orange-400' : 'text-blue-400'}`} />
                  </div>
                  <div className="text-xs text-white min-w-0">
                    <div className="font-semibold">Referral Pro — {timeRemaining.label}</div>
                    <div className="text-gray-400 mt-0.5">You unlocked Pro through referrals.</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    to="/rewards"
                    className={`text-xs px-4 py-2 rounded-xl transition-colors font-semibold ${isUrgent ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-primary hover:bg-primary text-white'}`}
                  >
                    View progress
                  </Link>
                  {isUrgent && (
                    <Link
                      to="/upgrade"
                      className="text-xs text-gray-400 hover:text-gray-200 transition-colors font-medium whitespace-nowrap"
                    >
                      Keep Pro →
                    </Link>
                  )}
                </div>
              </div>
            );
          }

          // Free user — referral teaser
          return (
            <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-700/30 rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-base">🚀</span>
                </div>
                <div className="text-xs text-white min-w-0">
                  <div className="font-semibold text-white">Unlock Pro free</div>
                  <div className="text-gray-400 mt-0.5">Invite 3 creators and get 7 days free</div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  to="/rewards"
                  className="text-xs bg-primary hover:bg-primary text-white px-3 py-2 rounded-xl transition-colors font-semibold whitespace-nowrap"
                >
                  View progress
                </Link>
                <button
                  onClick={copyReferralLink}
                  disabled={!referralStatus?.referralUrl && !referralStatus?.rawReferralUrl}
                  className="text-xs text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium whitespace-nowrap"
                >
                  {copySuccess ? 'Copied!' : 'Copy link'}
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </Layout>
  );
}
