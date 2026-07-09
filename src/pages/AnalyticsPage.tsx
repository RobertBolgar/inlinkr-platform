import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/cloudflare';
import { formatSourceLabel } from '../lib/utils';
import { getPlacementMetadata } from '../lib/placement-intelligence';
import { Layout } from '../components/Layout';
import { PageSkeleton } from '../components/PageSkeleton';
import { RefreshCw, ExternalLink, Trophy, Target, TrendingUp } from 'lucide-react';

type SourceStats = {
  source: string;
  clicks: number;
  topLinkId?: string;
  topLinkTitle?: string;
  topLinkClicks?: number;
};

type VideoStats = {
  video_id: string;
  total_clicks: number;
  link_count: number;
  views: number | null;
  conversion_rate: number | null;
  title: string | null;
  thumbnail: string | null;
  link_id?: number | null;
  link_usage_id?: number | null;
  placement_breakdown?: Array<{ source: string | null; count: number }>;
  attribution_mode?: string;
};


export function AnalyticsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sourceStats, setSourceStats] = useState<SourceStats[]>([]);
  const [last24hClicks, setLast24hClicks] = useState(0);
  const [videoStats, setVideoStats] = useState<VideoStats[]>([]);
  const [placementMap, setPlacementMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [proofViews, setProofViews] = useState(0);
  const [showAllVideosModal, setShowAllVideosModal] = useState(false);
  const [allVideosSearch, setAllVideosSearch] = useState('');
  const [allVideosSort, setAllVideosSort] = useState<'clicks' | 'views' | 'newest'>('clicks');
  const [allVideosPage, setAllVideosPage] = useState(1);
  const VIDEOS_PER_PAGE = 25;

  useEffect(() => {
    fetchAnalytics();
  }, [user]);

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
    const fetchProofViews = async () => {
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

        const response = await fetch('/api/proof-shares/list?include_disabled=true', {
          method: 'GET',
          headers,
        });

        if (response.ok) {
          const data = await response.json();
          const proofs = data.proofs || [];
          const totalViews = proofs.reduce((sum: number, p: any) => sum + (p.view_count || 0), 0);
          setProofViews(totalViews);
        }
      } catch (err) {
        console.error('Failed to fetch proof views:', err);
      }
    };

    fetchProofViews();
  }, [user]);

  const handleHideFromAnalytics = async (videoId: string) => {
    if (!confirm('This hides the video from analytics reports but does not delete links, clicks, or proof history. Continue?')) {
      return;
    }

    try {
      const clerk = (window as any).Clerk;
      let headers: HeadersInit = { 'Content-Type': 'application/json' };

      if (clerk && clerk.session) {
        const token = await clerk.session.getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch('/api/analytics-video-exclusions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          youtube_video_id: videoId,
          reason: 'Hidden by user'
        }),
      });

      if (response.ok) {
        fetchAnalytics();
      } else {
        alert('Failed to hide video from analytics');
      }
    } catch (error) {
      console.error('Error hiding video:', error);
      alert('Failed to hide video from analytics');
    }
  };

  // Auto-refresh every 15 seconds
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      fetchAnalytics();
    }, 15000);

    return () => clearInterval(interval);
  }, [user]);

  // Refetch when tab becomes visible or gains focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user) {
        fetchAnalytics();
      }
    };

    const handleFocus = () => {
      if (user) {
        fetchAnalytics();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user]);

  const fetchAnalytics = async () => {
    if (!user) return;

    try {
      const links = await db.getLinksByUserId(user.id);
      const videoStats = await db.getLinkVideoStatsByUserId(user.id);

      if (!links || links.length === 0) {
        setLoading(false);
        return;
      }

      const linkIds = links.map((l) => l.id);

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

      const clickEventsResponse = await db.getClickEventsByLinkIds(linkIds);

      // Handle new API response format
      const clickEvents = clickEventsResponse.events || [];
      const bySource = clickEventsResponse.bySource || [];

      const linkClickCounts: Record<string, number> = {};
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      let clicksLast24h = 0;

      clickEvents.forEach((event: any) => {
        linkClickCounts[event.link_id] = (linkClickCounts[event.link_id] || 0) + 1;

        const eventDate = new Date(event.timestamp);
        if (eventDate >= yesterday) {
          clicksLast24h++;
        }
      });

      // Use pre-calculated source analytics from API and enrich with top link info
      const sourceStats = bySource.length > 0 ? bySource.map((source: any) => ({
        ...source,
        topLinkId: undefined,
        topLinkTitle: undefined,
        topLinkClicks: undefined,
      })) : [];

      setSourceStats(sourceStats as SourceStats[]);
      setLast24hClicks(clicksLast24h);

      // Use videoStats from API directly - it already includes link_usages aggregation
      // The API (functions/api/links.js) now aggregates from link_usages as primary source
      // and links.video_id as fallback, so we don't need to build usageEntries locally
      const allVideoStats = videoStats || [];
      setVideoStats(allVideoStats.sort((a: any, b: any) => (b.conversion_rate || 0) - (a.conversion_rate || 0)));
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchAnalytics();
  };

  const getBestSource = (sourceData: SourceStats[]) => {
    if (!sourceData || sourceData.length === 0) return null;
    const sorted = [...sourceData].sort((a, b) => b.clicks - a.clicks);
    return sorted[0];
  };

  const getSourcePercentage = (clicks: number, totalClicks: number) => {
    if (totalClicks === 0) return 0;
    return Math.round((clicks / totalClicks) * 100);
  };

  const formatSourceLabelWithPlacements = (source: string | null) => {
    if (!source) return 'Untracked traffic';
    
    if (placementMap[source]) {
      return placementMap[source];
    }
    
    return formatSourceLabel(source);
  };

  // Determine the placement that drove the most clicks for a given video.
  // Uses server-side video-scoped placement breakdown from API.
  const getTopPlacementForVideo = (stat: VideoStats): string | null => {
    const placementBreakdown = stat.placement_breakdown || [];
    
    if (placementBreakdown.length === 0) return null;

    const topPlacement = placementBreakdown.sort((a: any, b: any) => b.count - a.count)[0];
    if (!topPlacement) return null;

    const source = topPlacement.source;
    if (source === null || source === 'direct') return 'Direct';
    return placementMap[source] || formatSourceLabel(source);
  };

  if (loading) {
    return (
      <Layout>
        <PageSkeleton />
      </Layout>
    );
  }

  const totalClicks = sourceStats.reduce((sum, s) => sum + s.clicks, 0);
  const bestSource = getBestSource(sourceStats);
  const totalSourceClicks = sourceStats.reduce((sum, s) => sum + s.clicks, 0);

  const getPerformanceColor = (stat: VideoStats) => {
    const rate = stat.conversion_rate || 0;
    const views = stat.views || 0;
    const clicks = stat.total_clicks || 0;
    
    // Awaiting clicks - zero clicks
    if (clicks === 0) return 'gray';
    // Strong: high conversion rate OR high clicks
    if (rate > 5 || clicks > 10) return 'orange';
    // Growing: decent conversion with reasonable views
    if (rate > 1 && views > 50) return 'green';
    // Weak: high views but low clicks
    if (views > 100 && clicks < 5) return 'amber';
    // Default for active clicks with low/unknown conversion rate
    // Use amber for neutral status when we have clicks but low/unknown CTR
    return 'amber';
  };

  const getPerformanceBadge = (color: string) => {
    switch (color) {
      case 'orange': return 'Strong engagement';
      case 'green': return 'Growing engagement';
      case 'amber': return 'Needs stronger CTA';
      default: return 'Awaiting clicks';
    }
  };

  const getPerformanceBadgeClass = (color: string) => {
    switch (color) {
      case 'orange': return 'text-orange-400 bg-orange-500/10';
      case 'green': return 'text-green-400 bg-green-500/10';
      case 'amber': return 'text-amber-400 bg-amber-500/10';
      default: return 'text-gray-400 bg-gray-700/30';
    }
  };

  const getSortedAndFilteredVideos = (videos: VideoStats[]) => {
    let filtered = videos;
    
    // Filter by search
    if (allVideosSearch) {
      const searchLower = allVideosSearch.toLowerCase();
      filtered = filtered.filter(v => 
        (v.title && v.title.toLowerCase().includes(searchLower))
      );
    }
    
    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (allVideosSort) {
        case 'clicks':
          return (b.total_clicks || 0) - (a.total_clicks || 0);
        case 'views':
          return (b.views || 0) - (a.views || 0);
        case 'newest':
          // Sort by link_id descending as a proxy for newest
          return (b.link_id || 0) - (a.link_id || 0);
        default:
          return 0;
      }
    });
    
    return sorted;
  };


  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-3 sm:py-5 sm:px-6 lg:px-8 overflow-x-hidden space-y-2.5">

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Top Performing Content</h1>
            <p className="text-gray-500 mt-0.5 text-xs sm:text-sm">See which videos and placements drive engagement.</p>
          </div>
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            title="Refresh stats"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>

        {/* ── EMPTY STATE: No engagement data yet ── */}
        {totalClicks === 0 && (!youtubeConnected || videoStats.length === 0) && (
          <div className="bg-gray-900 border border-gray-800/80 rounded-xl p-5 sm:p-6 text-center">
            <h2 className="text-sm sm:text-base font-semibold text-white mb-2">No engagement data yet</h2>
            <p className="text-sm text-gray-400 mb-5 max-w-md mx-auto">
              Once your Smart Links are shared, TubeLinkr will show which videos and placements actually drive engagement.
            </p>
            <div className="flex items-center justify-center gap-3 mb-6">
              <a
                href="/links/new"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Create Smart Link
              </a>
              <a
                href="/links"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
              >
                Manage Link
              </a>
            </div>
            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Top placement</div>
                <div className="text-sm font-semibold text-gray-400">—</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Best video</div>
                <div className="text-sm font-semibold text-gray-400">—</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Engagement rate</div>
                <div className="text-sm font-semibold text-gray-400">—</div>
              </div>
            </div>
          </div>
        )}

        {/* ── COMPACT SUMMARY ROW ── */}
        {totalClicks > 0 && (
          <div className="grid gap-2.5 sm:gap-3 grid-cols-2 sm:grid-cols-4">
          {/* Total Clicks */}
          <div className="relative bg-gray-900 border border-gray-800/80 rounded-xl p-2.5 sm:p-3.5 overflow-hidden">
            <div className="absolute inset-0 bg-blue-500/5 rounded-xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-4 h-4 rounded-md bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                  <div className="w-1 h-1 rounded-full bg-blue-400" />
                </div>
                <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Total Clicks</div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white leading-none mb-1">{totalClicks}</div>
              {last24hClicks > 0 ? (
                <div className="text-[10px] text-green-400 font-medium">+{last24hClicks} today</div>
              ) : (
                <div className="text-[10px] text-gray-600">No clicks today</div>
              )}
            </div>
          </div>

          {/* Top Placement */}
          <div className="relative bg-gray-900 border border-gray-800/80 rounded-xl p-2.5 sm:p-3.5 overflow-hidden">
            <div className="absolute inset-0 bg-green-500/5 rounded-xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-4 h-4 rounded-md bg-green-500/15 flex items-center justify-center flex-shrink-0">
                  <div className="w-1 h-1 rounded-full bg-green-400" />
                </div>
                <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Top Placement</div>
              </div>
              {bestSource && totalSourceClicks > 0 ? (
                <>
                  <div className="text-xs sm:text-sm font-semibold text-white truncate mb-0.5">{formatSourceLabelWithPlacements(bestSource.source)}</div>
                  <div className="text-xl sm:text-2xl font-bold text-white leading-none mb-1">{bestSource.clicks}</div>
                  <div className="text-[10px] text-green-400">{getSourcePercentage(bestSource.clicks, totalSourceClicks)}% of clicks</div>
                </>
              ) : (
                <div className="text-[10px] text-gray-500 mt-1">No data yet</div>
              )}
            </div>
          </div>

          {/* Videos Tracked */}
          <div className="relative bg-gray-900 border border-gray-800/80 rounded-xl p-2.5 sm:p-3.5 overflow-hidden">
            <div className="absolute inset-0 bg-purple-500/5 rounded-xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-4 h-4 rounded-md bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                  <div className="w-1 h-1 rounded-full bg-purple-400" />
                </div>
                <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Videos Tracked</div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white leading-none mb-1">{videoStats.length}</div>
              <div className="text-[10px] text-gray-600">{videoStats.length === 1 ? 'video with links' : 'videos with links'}</div>
            </div>
          </div>

          {/* Proof Views */}
          <div className="relative bg-gray-900 border border-gray-800/80 rounded-xl p-2.5 sm:p-3.5 overflow-hidden">
            <div className="absolute inset-0 bg-cyan-500/5 rounded-xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-4 h-4 rounded-md bg-cyan-500/15 flex items-center justify-center flex-shrink-0">
                  <div className="w-1 h-1 rounded-full bg-cyan-400" />
                </div>
                <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Proof Views</div>
              </div>
              {proofViews > 0 ? (
                <div className="text-2xl sm:text-3xl font-bold text-white leading-none mb-1">{proofViews}</div>
              ) : (
                <div className="text-2xl sm:text-3xl font-bold text-gray-600 leading-none mb-1">—</div>
              )}
              <div className="text-[10px] text-gray-600">across shared proofs</div>
            </div>
          </div>
        </div>
        )}

        {/* ── TWO-COLUMN LAYOUT: VIDEOS + PLACEMENTS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-2.5">
          {/* ── LEFT COLUMN: TOP PERFORMING VIDEOS (60-65%) ── */}
          {youtubeConnected && videoStats.length > 0 && (() => {
            const displayedVideos = [...videoStats]
              .sort((a, b) => (b.total_clicks || 0) - (a.total_clicks || 0))
              .slice(0, 5);

            return (
              <div className="lg:col-span-3 bg-gray-900 border border-gray-800/80 rounded-xl p-3 sm:p-4">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-sm font-semibold text-white">Top Performing Videos</h2>
                    {videoStats.length > 5 && (
                      <button
                        onClick={() => setShowAllVideosModal(true)}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                      >
                        View all videos
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wide">See which videos are generating clicks</p>
                </div>
                <div className="space-y-1.5">
                  {displayedVideos.map((stat) => {
                    const topPlacement = getTopPlacementForVideo(stat);

                    return (
                      <div
                        key={stat.video_id}
                        onClick={() => navigate(`/video/${stat.video_id}`)}
                        className="rounded-lg overflow-hidden transition-colors p-2 sm:p-3 bg-gray-800/40 border border-gray-700/50 hover:bg-gray-800/60 cursor-pointer"
                      >
                        <div className="flex gap-2.5">
                          {/* Thumbnail */}
                          {stat.thumbnail ? (
                            <img
                              src={stat.thumbnail}
                              alt={stat.title || 'Video'}
                              className="w-20 h-14 sm:w-32 sm:h-20 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-20 h-14 sm:w-32 sm:h-20 rounded-lg bg-gray-700 flex-shrink-0" />
                          )}

                          {/* Content */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                            {/* Row 1: Title + YouTube Link */}
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div className="flex-1 min-w-0">
                                {stat.title ? (
                                  <div className="font-semibold text-white truncate leading-tight text-xs sm:text-sm">
                                    {stat.title}
                                  </div>
                                ) : (
                                  <div className="text-blue-400 truncate text-[10px] sm:text-xs">
                                    YouTube video
                                  </div>
                                )}
                              </div>
                              <a
                                href={`https://youtube.com/watch?v=${stat.video_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-gray-500 hover:text-blue-400 transition-colors flex-shrink-0"
                              >
                                <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
                              </a>
                            </div>

                            {/* Row 2: Clicks */}
                            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] mb-1">
                              {stat.total_clicks === 0 ? (
                                <span className="font-medium text-gray-500">Waiting for first tracked click...</span>
                              ) : (
                                <span className="font-semibold text-white">{stat.total_clicks} click{stat.total_clicks === 1 ? '' : 's'}</span>
                              )}
                            </div>

                            {/* Row 3: Top Placement */}
                            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-gray-400 min-w-0">
                              {topPlacement ? (
                                <span className="truncate max-w-[140px] sm:max-w-[260px]">
                                  Top Placement: <span className="font-medium text-gray-200">{topPlacement}</span>
                                </span>
                              ) : (
                                <span className="text-gray-600">Collecting data...</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── RIGHT COLUMN: PLACEMENT PERFORMANCE (35-40%) ── */}
          {sourceStats.length > 0 && totalSourceClicks > 0 && (() => {
          const sortedSources = [...sourceStats].sort((a, b) => b.clicks - a.clicks);
          const topSource = sortedSources[0];
          const topPct = getSourcePercentage(topSource.clicks, totalSourceClicks);

          // Placements that exist but have not generated clicks yet (zero state).
          const activeLabels = new Set(
            sortedSources.map((s) => formatSourceLabelWithPlacements(s.source))
          );
          const zeroPlacements = Array.from(new Set(Object.values(placementMap)))
            .filter((name) => !activeLabels.has(name))
            .sort((a, b) => a.localeCompare(b));

          const getSourceColor = (source: string | null) => {
            const metadata = getPlacementMetadata(source);
            const toneToColor: Record<string, string> = {
              blue: '#f97316',
              green: '#22c55e',
              amber: '#f59e0b',
              purple: '#a855f7',
              cyan: '#06b6d4',
              gray: '#6b7280',
            };
            return toneToColor[metadata.badgeTone] || '#6b7280';
          };

          // Create SVG donut chart segments
          const createDonutSegments = () => {
            let cumulativePercent = 0;
            return sortedSources.map((stat) => {
              const pct = getSourcePercentage(stat.clicks, totalSourceClicks);
              if (pct === 0) return null;
              
              const startAngle = (cumulativePercent / 100) * 360 - 90;
              const endAngle = ((cumulativePercent + pct) / 100) * 360 - 90;
              cumulativePercent += pct;
              
              const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
              const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
              const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
              const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);
              const largeArcFlag = pct > 50 ? 1 : 0;
              
              const pathData = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
              
              return (
                <path
                  key={stat.source ?? 'direct'}
                  d={pathData}
                  fill={getSourceColor(stat.source)}
                  className="transition-opacity hover:opacity-80"
                />
              );
            });
          };

          return (
            <div className="lg:col-span-2 space-y-2.5">
              {/* Card 1: Donut chart + Placement legend */}
              <div className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-3 sm:p-4">
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-white">Placement Performance</h2>
                  <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wide">Compare which placements drive the most clicks.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  {/* Donut chart */}
                  <div className="flex-shrink-0">
                    <svg viewBox="0 0 100 100" className="w-36 h-36 sm:w-40 sm:h-40">
                      {createDonutSegments()}
                      <circle cx="50" cy="50" r="25" fill="#1f2937" />
                      <text x="50" y="55" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">
                        {totalSourceClicks}
                      </text>
                    </svg>
                  </div>

                  {/* Placement list */}
                  <div className="flex-1 space-y-1.5">
                    {sortedSources.map((stat) => {
                      const pct = getSourcePercentage(stat.clicks, totalSourceClicks);
                      return (
                        <div key={stat.source ?? 'direct'} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <div 
                              className="w-2 h-2 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: getSourceColor(stat.source) }}
                            />
                            <span className="text-xs text-gray-300 truncate">
                              {formatSourceLabelWithPlacements(stat.source)}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400 tabular-nums ml-2 flex-shrink-0">
                            {stat.clicks} <span className="text-green-400">({pct}%)</span>
                          </span>
                        </div>
                      );
                    })}
                    {zeroPlacements.length > 0 && (
                      <div className="flex items-center justify-between opacity-50">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2 h-2 rounded-full flex-shrink-0 bg-gray-600" />
                          <span className="text-xs text-gray-400">+ {zeroPlacements.length} unused placement{zeroPlacements.length > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 2: Top Placement summary */}
              <div className="bg-gray-900 border border-gray-800/80 rounded-xl p-4 sm:p-5">
                <div className="mb-4">
                  <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1">Top Placement</div>
                  <div className="text-base font-semibold text-white">
                    {formatSourceLabelWithPlacements(topSource.source)}
                  </div>
                </div>
                <div className="mb-3">
                  <div className="text-3xl font-bold text-green-400 leading-none mb-1">{topPct}%</div>
                  <div className="text-xs text-gray-500">of all tracked clicks</div>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {topSource.source === null 
                    ? 'Most clicks are currently unattributed. Add more placements to improve attribution visibility.'
                    : 'This placement is currently outperforming every other placement.'}
                </p>
              </div>

              {/* Card 3: Video Insights */}
              {videoStats.length > 0 && totalClicks > 0 && (() => {
                const mostClickedVideo = [...videoStats]
                  .sort((a, b) => (b.total_clicks || 0) - (a.total_clicks || 0))[0];
                const mostClickedLabel =
                  mostClickedVideo && (mostClickedVideo.total_clicks || 0) > 0
                    ? (mostClickedVideo.title || 'YouTube video')
                    : null;
                const highestPlacement =
                  bestSource && totalSourceClicks > 0
                    ? formatSourceLabelWithPlacements(bestSource.source)
                    : null;
                const videosWithClicks = videoStats.filter((v) => (v.total_clicks || 0) > 0).length;

                return (
                  <div className="bg-gray-900 border border-gray-800/80 rounded-xl p-4 sm:p-5">
                    <div className="mb-4">
                      <h2 className="text-sm font-semibold text-white">Video Insights</h2>
                      <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wide">A quick read on what's driving your clicks.</p>
                    </div>
                    <div className="space-y-4">
                      {/* Most Clicked Video */}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Trophy className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1">Most Clicked Video</div>
                          {mostClickedLabel ? (
                            <div className="text-sm font-semibold text-white truncate">{mostClickedLabel}</div>
                          ) : (
                            <div className="text-sm font-medium text-gray-500">Waiting for first tracked click...</div>
                          )}
                        </div>
                      </div>

                      {/* Highest Placement */}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Target className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1">Highest Performing Placement</div>
                          {highestPlacement ? (
                            <div className="text-sm font-semibold text-white truncate">{highestPlacement}</div>
                          ) : (
                            <div className="text-sm font-medium text-gray-500">Collecting data...</div>
                          )}
                        </div>
                      </div>

                      {/* Videos Generating Clicks */}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <TrendingUp className="w-4 h-4 text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1">Videos Generating Clicks</div>
                          <div className="text-sm font-semibold text-white">
                            {videosWithClicks} <span className="text-gray-500 font-normal">of {videoStats.length}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}
        </div>


        {/* ── SECTION 4: LINK PERFORMANCE ── */}

        {/* All Videos Modal */}
        {showAllVideosModal && (() => {
          const sortedVideos = getSortedAndFilteredVideos(videoStats);
          const paginatedVideos = sortedVideos.slice(0, allVideosPage * VIDEOS_PER_PAGE);
          const hasMore = sortedVideos.length > allVideosPage * VIDEOS_PER_PAGE;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAllVideosModal(false)} />
              <div className="relative bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-gray-800">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-white">All Videos</h2>
                      <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Browse every video connected to your Smart Links.</p>
                    </div>
                    <button
                      onClick={() => setShowAllVideosModal(false)}
                      className="text-gray-400 hover:text-white transition-colors p-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Search and Sort */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Search videos..."
                        value={allVideosSearch}
                        onChange={(e) => {
                          setAllVideosSearch(e.target.value);
                          setAllVideosPage(1);
                        }}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <select
                      value={allVideosSort}
                      onChange={(e) => {
                        setAllVideosSort(e.target.value as 'clicks' | 'views' | 'newest');
                        setAllVideosPage(1);
                      }}
                      className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="clicks">Most clicks</option>
                      <option value="views">Most views</option>
                      <option value="newest">Newest</option>
                    </select>
                  </div>
                </div>

                {/* Video List */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                  {sortedVideos.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-400 text-sm">No videos found</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {paginatedVideos.map((stat) => {
                        const perfColor = getPerformanceColor(stat);
                        const perfBadge = getPerformanceBadge(perfColor);
                        const perfBadgeClass = getPerformanceBadgeClass(perfColor);

                        return (
                          <div
                            key={stat.video_id}
                            onClick={() => {
                              navigate(`/video/${stat.video_id}`);
                              setShowAllVideosModal(false);
                            }}
                            className="rounded-lg overflow-hidden transition-colors p-2 sm:p-3 bg-gray-800/40 border border-gray-700/50 hover:bg-gray-800/60 cursor-pointer"
                          >
                            <div className="flex gap-2">
                              {/* Thumbnail */}
                              {stat.thumbnail ? (
                                <img
                                  src={stat.thumbnail}
                                  alt={stat.title || 'Video'}
                                  className="w-20 h-14 sm:w-32 sm:h-20 rounded-lg object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-20 h-14 sm:w-32 sm:h-20 rounded-lg bg-gray-700 flex-shrink-0" />
                              )}

                              {/* Content */}
                              <div className="flex-1 min-w-0 flex flex-col justify-between">
                                {/* Row 1: Title + badge + YouTube Link */}
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <div className="flex-1 min-w-0">
                                    {stat.title ? (
                                      <div className="font-bold text-white truncate leading-tight text-xs sm:text-sm">
                                        {stat.title}
                                      </div>
                                    ) : (
                                      <div>
                                        <div className="text-blue-400 truncate text-[10px] sm:text-xs">
                                          YouTube video
                                        </div>
                                        {stat.views === null && (
                                          <p className="text-[10px] text-gray-500 mt-0.5">YouTube data unavailable</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <a
                                      href={`https://youtube.com/watch?v=${stat.video_id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-gray-500 hover:text-blue-400 transition-colors flex-shrink-0"
                                    >
                                      <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
                                    </a>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleHideFromAnalytics(stat.video_id);
                                      }}
                                      className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
                                      title="Hide from Analytics"
                                    >
                                      <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                      </svg>
                                    </button>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${perfBadgeClass}`}>
                                      {perfBadge}
                                    </span>
                                  </div>
                                </div>

                                {/* Row 2: Inline metrics */}
                                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] mb-1 text-gray-400">
                                  {stat.total_clicks === 0 ? (
                                    <span className="font-semibold text-gray-500">No clicks yet</span>
                                  ) : (
                                    <span className="font-semibold text-white">{stat.total_clicks} clicks</span>
                                  )}
                                  {stat.total_clicks > 0 && (
                                    <>
                                      <span className="text-gray-600">•</span>
                                      <span className="font-semibold text-white">
                                        {typeof stat.conversion_rate === 'number' 
                                          ? (stat.conversion_rate > 0 && stat.conversion_rate < 0.1 
                                              ? '<0.1%' 
                                              : `${stat.conversion_rate.toFixed(1)}%`)
                                          : '—'}
                                      </span>
                                      <span className="text-gray-600">•</span>
                                      <span className="font-semibold text-white">
                                        {stat.views !== null ? stat.views.toLocaleString() : '—'} views
                                      </span>
                                    </>
                                  )}
                                </div>

                                {/* Row 3: Links */}
                                <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                                  <span className="truncate max-w-[120px] sm:max-w-[240px]">
                                    {stat.link_count > 0 ? `${stat.link_count} link${stat.link_count > 1 ? 's' : ''}` : 'No links'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Load More */}
                {hasMore && (
                  <div className="p-4 border-t border-gray-800">
                    <button
                      onClick={() => setAllVideosPage(allVideosPage + 1)}
                      className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Load more videos
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      </div>
    </Layout>
  );
}
