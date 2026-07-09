import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { PageSkeleton } from '../components/PageSkeleton';
import { AddPlacementModal } from '../components/AddPlacementModal';
import { PlacementBadge } from '../components/placements/PlacementBadge';
import { QRCodeDisplay } from '../components/placements/QRCodeDisplay';
import { Badge } from '../components/ui';
import { Copy, CheckCircle2, Plus, ArrowLeft, Trash2, RefreshCw, QrCode, X } from 'lucide-react';
import { db as apiClient } from '../lib/cloudflare';
import { useAuth } from '../contexts/AuthContext';
import { hasFeature, FEATURES } from '../lib/plan';
import { getPlacementLabel } from '../lib/placement-intelligence';

const PUBLIC_BASE_URL = 'https://go.tubelinkr.com';

type Placement = {
  id: number;
  link_id: number;
  name: string;
  type: string;
  source_code: string;
  public_code: string;
  created_at: string;
  updated_at: string;
  clicks: number;
  link_usage_id?: number | null;
  youtube_video_id?: string | null;
};

type VideoContext = {
  video_id: string;
  title?: string | null;
  thumbnail?: string | null;
  url: string;
  placement_name?: string | null;
  is_base: boolean;
  link_usage_id?: number;
};

type LinkInfo = {
  id: string;
  user_id: number;
  slug: string;
  title?: string;
  original_url: string;
  username: string;
  public_code?: string;
  video_id?: string | null;
  video_title?: string | null;
  video_thumbnail?: string | null;
};

export function PlacementsPage() {
  const { linkId } = useParams<{ linkId: string }>();
  const { user } = useAuth();
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedPlacementForQR, setSelectedPlacementForQR] = useState<Placement | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [videoContexts, setVideoContexts] = useState<Array<{ video_id: string; title?: string | null; thumbnail?: string | null; url: string; placement_name?: string | null; is_base: boolean; link_usage_id?: number }>>([]);
  const [showAttachVideoModal, setShowAttachVideoModal] = useState(false);
  const [selectedPlacementForAttach, setSelectedPlacementForAttach] = useState<Placement | null>(null);
  const [youtubeVideos, setYoutubeVideos] = useState<any[]>([]);
  const [youtubeVideosLoading, setYoutubeVideosLoading] = useState(false);
  const [youtubeVideosError, setYoutubeVideosError] = useState<string | null>(null);

  const getBaseUrl = () => {
    if (hasFeature(user, FEATURES.CUSTOM_SUBDOMAIN)) {
      const subdomain = user?.subdomain || user?.username || '';
      return `https://${subdomain}.tubelinkr.com`;
    }
    return PUBLIC_BASE_URL;
  };

  const getPlacementUrl = (placement: Placement) => {
    const baseUrl = getBaseUrl();
    if (hasFeature(user, FEATURES.CUSTOM_SUBDOMAIN)) {
      // Pro users: branded subdomain (unchanged)
      return `${baseUrl}/${linkInfo?.slug}/${placement.public_code}`;
    }
    // Phase 3: Free users prefer public_code, fallback to username/slug
    if (linkInfo?.public_code) {
      return `${baseUrl}/${linkInfo?.public_code}/${placement.public_code}`;
    }
    return `${baseUrl}/${linkInfo?.username}/${linkInfo?.slug}/${placement.public_code}`;
  };

  useEffect(() => {
    if (linkId) {
      fetchPlacements();
      fetchLinkInfo();
    }
  }, [linkId]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    if (!linkId) return;

    const interval = setInterval(() => {
      fetchPlacements();
    }, 15000);

    return () => clearInterval(interval);
  }, [linkId]);

  // Refetch when tab becomes visible or gains focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && linkId) {
        fetchPlacements();
      }
    };

    const handleFocus = () => {
      if (linkId) {
        fetchPlacements();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [linkId]);

  // Fetch YouTube videos when attach modal opens for QR code
  useEffect(() => {
    const fetchYouTubeVideos = async () => {
      if (!user || !showAttachVideoModal) return;

      setYoutubeVideosLoading(true);
      setYoutubeVideosError(null);
      try {
        const clerk = (window as any).Clerk;
        let headers: HeadersInit = { 'Content-Type': 'application/json' };

        if (clerk && clerk.session) {
          const token = await clerk.session.getToken();
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        }

        const response = await fetch('/api/youtube/videos', {
          method: 'GET',
          headers,
        });

        if (response.ok) {
          const data = await response.json();
          setYoutubeVideos(data.videos || []);
        } else {
          const data = await response.json();
          setYoutubeVideosError(data.error || 'Failed to fetch videos');
          if (data.needsReconnect) {
            setYoutubeVideosError('YouTube access expired. Please reconnect in Settings.');
          }
        }
      } catch (err) {
        console.error('Failed to fetch YouTube videos:', err);
        setYoutubeVideosError('Failed to fetch videos');
      } finally {
        setYoutubeVideosLoading(false);
      }
    };

    fetchYouTubeVideos();
  }, [user, showAttachVideoModal]);

  const fetchPlacements = async () => {
    if (!linkId) return;

    try {
      const data = await apiClient.getPlacementsByLinkId(linkId);
      setPlacements(data);
    } catch (error) {
      console.error('Error fetching placements:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchPlacements();
  };

  const fetchLinkInfo = async () => {
    if (!linkId) return;

    try {
      const data = await apiClient.getLinkById(linkId, { include_metadata: true });
      setLinkInfo(data);

      // Fetch link usages to build video contexts
      try {
        const usagesData = await apiClient.getLinkUsages(linkId, { include_metadata: true });
        const usages = usagesData.usages || usagesData || [];

        // Build video contexts list
        const contexts: Array<{ video_id: string; title?: string | null; thumbnail?: string | null; url: string; placement_name?: string | null; is_base: boolean; link_usage_id?: number }> = [];
        const seen = new Set<string>();

        // Add base video if present
        if (data.video_id) {
          contexts.push({
            video_id: data.video_id,
            title: data.video_title || null,
            thumbnail: data.video_thumbnail || null,
            url: `https://youtube.com/watch?v=${data.video_id}`,
            is_base: true
          });
          seen.add(data.video_id);
        }

        // Add usage videos
        if (usages.length > 0) {
          usages.forEach((usage: any) => {
            if (usage.youtube_video_id && !seen.has(usage.youtube_video_id)) {
              contexts.push({
                video_id: usage.youtube_video_id,
                title: usage.title || usage.title_snapshot || null,
                thumbnail: usage.thumbnail || null,
                url: `https://youtube.com/watch?v=${usage.youtube_video_id}`,
                placement_name: usage.placement_name,
                is_base: false,
                link_usage_id: usage.id
              });
              seen.add(usage.youtube_video_id);
            }
          });
        }

        setVideoContexts(contexts);
      } catch (error) {
        console.error('Error fetching link usages:', error);
        setVideoContexts([]);
      }
    } catch (error) {
      console.error('Error fetching link info:', error);
    }
  };

  const handleAddPlacement = async (placement: { name: string; type: string; link_usage_id?: number | null; youtube_video_id?: string | null }) => {
    try {
      const data = await apiClient.createPlacement({ ...placement, link_id: parseInt(linkId || '0') });

      if (!data.success) {
        throw new Error(data.error || 'Failed to add placement');
      }

      fetchPlacements();
    } catch (error) {
      throw error;
    }
  };

  const handleDeletePlacement = async (placementId: string) => {
    if (!confirm('Are you sure you want to delete this placement?')) return;

    try {
      const data = await apiClient.deletePlacement(placementId);

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete placement');
      }

      fetchPlacements();
    } catch (error) {
      console.error('Error deleting placement:', error);
      alert('Failed to delete placement');
    }
  };

  const handleRemoveVideo = async (placementId: string) => {
    if (!confirm('Remove this video from the placement? The placement will remain but will no longer be associated with this video.')) return;

    try {
      const placement = placements.find(p => p.id === parseInt(placementId));
      if (!placement) return;

      const videoIdToRemove = placement.youtube_video_id;

      // Clear placement-level video association
      const data = await apiClient.updatePlacement(placementId, {
        youtube_video_id: null,
        link_usage_id: null
      });

      if (!data.success) {
        throw new Error(data.error || 'Failed to remove video');
      }

      // Check if the removed video was the link's base video
      if (linkInfo?.video_id === videoIdToRemove) {
        // Check if any other placements still reference this video
        const otherPlacementsWithVideo = placements.filter(
          p => p.id !== parseInt(placementId) && p.youtube_video_id === videoIdToRemove
        );

        // If no other placements use this video, clear the link's base video
        if (otherPlacementsWithVideo.length === 0) {
          await apiClient.updateLink(linkId || '', { video_id: null });
        }
      }

      fetchPlacements();
      fetchLinkInfo();
    } catch (error) {
      console.error('Error removing video:', error);
      alert('Failed to remove video');
    }
  };

  const handleRemoveBaseVideo = async () => {
    if (!confirm('Remove the base video from this smart link? The link and placements will remain but will no longer be associated with this video.')) return;

    try {
      await apiClient.updateLink(linkId || '', {
        video_id: null,
        video_title: null,
        video_thumbnail: null
      });

      fetchLinkInfo();
      fetchPlacements();
    } catch (error) {
      console.error('Error removing base video:', error);
      alert('Failed to remove base video');
    }
  };

  const handleAttachVideo = async (placementId: string, videoId: string, linkUsageId?: number) => {
    try {
      const data = await apiClient.updatePlacement(placementId, {
        youtube_video_id: videoId,
        link_usage_id: linkUsageId || null
      });

      if (!data.success) {
        throw new Error(data.error || 'Failed to attach video');
      }

      fetchPlacements();
      fetchLinkInfo();
      setShowAttachVideoModal(false);
      setSelectedPlacementForAttach(null);
    } catch (error) {
      console.error('Error attaching video:', error);
      alert('Failed to attach video');
    }
  };

  const copyPlacementUrl = (placement: Placement) => {
    const url = getPlacementUrl(placement);
    navigator.clipboard.writeText(url);
    setCopiedId(placement.id);
    setTimeout(() => setCopiedId(null), 2000);
  };


  const getDestinationPreview = (url: string) => {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname;
      const pathname = parsed.pathname;
      if (pathname.length > 30) {
        return `${hostname}${pathname.substring(0, 30)}...`;
      }
      return `${hostname}${pathname}`;
    } catch {
      return url.length > 40 ? `${url.substring(0, 40)}...` : url;
    }
  };

  const getBestPlacement = () => {
    if (placements.length === 0) return null;
    const placementsWithClicks = placements.filter(p => p.clicks > 0);
    if (placementsWithClicks.length === 0) return null;
    return placementsWithClicks.reduce((best, current) => current.clicks > best.clicks ? current : best);
  };

  const getTotalClicks = () => {
    return placements.reduce((sum, p) => sum + p.clicks, 0);
  };

  const getRecommendation = () => {
    const bestPlacement = getBestPlacement();
    const totalClicks = getTotalClicks();
    const placementCount = placements.length;

    // No placements yet
    if (placementCount === 0) {
      return 'No placement data yet.';
    }

    // Has placements but no clicks
    if (placementCount > 0 && totalClicks === 0) {
      return 'Add placements to videos or bios to start tracking clicks.';
    }

    // Has best placement
    if (bestPlacement) {
      const placementType = bestPlacement.type;

      // Use placement intelligence for creator-friendly guidance
      if (placementType === 'bio') {
        return 'Channel bio is currently driving the most clicks.';
      }
      if (placementType === 'pinned') {
        return 'Pinned comment is performing well.';
      }
      if (placementType === 'description') {
        return 'YouTube description is your top performer.';
      }
      if (placementType === 'short') {
        return 'Shorts description is getting the most clicks.';
      }
      if (placementType === 'direct') {
        return 'Direct traffic is outperforming tracked placements.';
      }
      return `${bestPlacement.name} is currently driving the most clicks.`;
    }

    // Has clicks but no clear best placement
    if (totalClicks > 0) {
      return 'This link is getting traffic from multiple placements.';
    }

    return 'YouTube descriptions may need stronger CTA wording.';
  };

  const getVideoContextForPlacement = (placement: Placement, baseVideoContext: VideoContext | null = null) => {
    // First match by link_usage_id (most specific)
    if (placement.link_usage_id) {
      return videoContexts.find(v => v.link_usage_id === placement.link_usage_id);
    }
    // Then match by youtube_video_id
    if (placement.youtube_video_id) {
      return videoContexts.find(v => v.video_id === placement.youtube_video_id);
    }
    // Video-specific placements can inherit parent Smart Link video for display grouping
    const videoSpecificTypes = ['description', 'pinned', 'short', 'video'];
    if (videoSpecificTypes.includes(placement.type) && baseVideoContext) {
      return baseVideoContext;
    }
    // General placements (bio, other, direct) should not inherit parent video
    return null;
  };

  // Group placements by video context
  const getGroupedPlacements = () => {
    const groups: {
      videoId: string;
      videoContext: VideoContext | null;
      placements: Placement[];
      totalClicks: number;
    }[] = [];
    const generalPlacements: Placement[] = [];
    const legacyPlacements: Placement[] = [];

    // Get base video context from parent Smart Link for fallback grouping
    const baseVideoContext = videoContexts.find(v => v.is_base) || null;

    placements.forEach((placement) => {
      const videoContext = getVideoContextForPlacement(placement, baseVideoContext);

      if (!videoContext) {
        // General placements (bio, other, direct) go to General Placements
        const generalTypes = ['bio', 'other', 'direct'];
        if (generalTypes.includes(placement.type)) {
          generalPlacements.push(placement);
        } else {
          // Video-specific placements with no video go to No Video Attached
          legacyPlacements.push(placement);
        }
        return;
      }

      // Check if group already exists
      const existingGroup = groups.find(g => g.videoId === videoContext.video_id);

      if (existingGroup) {
        existingGroup.placements.push(placement);
        existingGroup.totalClicks += placement.clicks;
      } else {
        groups.push({
          videoId: videoContext.video_id,
          videoContext,
          placements: [placement],
          totalClicks: placement.clicks
        });
      }
    });

    // If there's a base video but no placements, show it as a group with 0 placements
    if (baseVideoContext && !groups.find(g => g.videoId === baseVideoContext.video_id)) {
      groups.push({
        videoId: baseVideoContext.video_id,
        videoContext: baseVideoContext,
        placements: [],
        totalClicks: 0
      });
    }

    return { groups, generalPlacements, legacyPlacements };
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
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 sm:px-6 lg:px-8 space-y-4">

        {/* ── HEADER ROW ── */}
        <div>
          <Link
            to="/links"
            className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-300 transition-colors text-xs mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Links
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight truncate">
                {linkInfo?.title || linkInfo?.slug}
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">See which placements drive clicks.</p>
            </div>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="flex-shrink-0 p-2 text-gray-500 hover:text-gray-300 bg-gray-800/60 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={isRefreshing ? 'Refreshing...' : 'Refresh stats'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── LINK OVERVIEW CARD ── */}
        <div className="bg-gray-900 border border-gray-800/80 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-gray-600 uppercase tracking-wide font-medium mb-1">Smart Link</div>
              <div className="text-sm font-semibold text-white truncate leading-snug">{linkInfo?.title || linkInfo?.slug}</div>
              <div className="text-xs text-gray-500 font-mono truncate mt-0.5">/{linkInfo?.slug}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-xl font-bold text-white tabular-nums leading-none">{getTotalClicks()}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">total clicks</div>
            </div>
          </div>

          {/* Destination */}
          <div className="text-xs text-gray-500 mb-3 truncate">
            → <span className="text-gray-400">{linkInfo ? getDestinationPreview(linkInfo.original_url) : 'Loading...'}</span>
          </div>

          {/* Best placement */}
          {getBestPlacement() && (
            <div className="text-xs text-gray-500 mb-3">
              Best: <span className="text-gray-300 font-medium">{getBestPlacement()?.name}</span>
              <span className="text-gray-600 ml-1">· {getBestPlacement()?.clicks} click{getBestPlacement()?.clicks !== 1 ? 's' : ''}</span>
            </div>
          )}
          <div className="text-[11px] text-blue-400/60 leading-snug mb-3">
            {getRecommendation()}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-3 border-t border-gray-800/60">
            <button
              onClick={() => {
                if (linkInfo) {
                  // Phase 3: Prefer public_code for Free links, fallback to username/slug
                  const url = hasFeature(user, FEATURES.CUSTOM_SUBDOMAIN)
                    ? `${getBaseUrl()}/${linkInfo.slug}`
                    : (linkInfo.public_code ? `${PUBLIC_BASE_URL}/${linkInfo.public_code}` : `${PUBLIC_BASE_URL}/${linkInfo.username}/${linkInfo.slug}`);
                  navigator.clipboard.writeText(url);
                  setCopiedId(-1);
                  setTimeout(() => setCopiedId(null), 2000);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {copiedId === -1 ? (
                <><CheckCircle2 className="w-3.5 h-3.5" />Copied!</>
              ) : (
                <><Copy className="w-3.5 h-3.5" />Copy Smart Link</>
              )}
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add placement
            </button>
          </div>
        </div>

        {/* ── PLACEMENTS LIST ── */}
        {placements.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:p-6 text-center">
            <h2 className="text-base font-semibold text-white mb-2">See which placements drive clicks</h2>
            <p className="text-sm text-gray-400 mb-5 max-w-md mx-auto">
              Add placements to your videos and bios to compare which content performs best.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Placement
            </button>
            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <span className="px-2 py-1 bg-gray-800 rounded-md">YouTube Description</span>
                <span className="px-2 py-1 bg-gray-800 rounded-md">Pinned Comment</span>
                <span className="px-2 py-1 bg-gray-800 rounded-md">Channel Bio</span>
                <span className="px-2 py-1 bg-gray-800 rounded-md">Shorts Description</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {(() => {
              const { groups, generalPlacements, legacyPlacements } = getGroupedPlacements();

              return (
                <>
                  {/* Video-grouped placements */}
                  {groups.map((group) => (
                    <div key={group.videoId} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                      {/* Video section header */}
                      <div className="px-4 pt-3 pb-2 border-b border-gray-800/50 bg-gray-900/50">
                        <div className="flex items-center gap-3">
                          {group.videoContext?.thumbnail ? (
                            <img
                              src={group.videoContext.thumbnail}
                              alt=""
                              className="w-24 h-14 object-cover rounded flex-shrink-0"
                            />
                          ) : (
                            <div className="w-24 h-14 bg-gray-800 rounded flex-shrink-0 flex items-center justify-center">
                              <span className="text-[10px] text-gray-600">No thumbnail</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              {group.videoContext?.title ? (
                                <div className="text-sm font-semibold text-gray-200 truncate">
                                  {group.videoContext.title}
                                </div>
                              ) : (
                                <div className="text-xs font-mono text-gray-400 truncate">
                                  {group.videoContext?.url}
                                </div>
                              )}
                              {group.videoContext?.is_base && (
                                <span className="px-1.5 py-0.5 bg-blue-900/30 border border-blue-700/40 rounded text-[10px] text-blue-400 flex-shrink-0">
                                  Base
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span>{group.placements.length} placement{group.placements.length !== 1 ? 's' : ''}</span>
                              <span>·</span>
                              <span>{group.totalClicks} click{group.totalClicks !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                          {group.videoContext?.is_base && (
                            <button
                              onClick={handleRemoveBaseVideo}
                              className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 text-[11px] font-medium rounded transition-colors"
                              title="Remove base video"
                            >
                              <Trash2 className="w-3 h-3" />
                              Remove
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Placements under this video */}
                      <div className="space-y-1">
                        {group.placements.length === 0 ? (
                          <div className="px-4 py-3 border-t border-gray-800/30 text-center">
                            <p className="text-xs text-gray-500">No placements for this video</p>
                          </div>
                        ) : (
                          group.placements.map((placement) => {
                          const isTopPerformer = getBestPlacement()?.id === placement.id && placement.clicks > 0;
                          const isDirect = placement.type === 'direct';
                          return (
                            <div
                              key={placement.id}
                              className={`px-4 py-2 border-t border-gray-800/30 transition-colors ${
                                isTopPerformer ? 'bg-green-900/5' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`text-sm font-medium leading-snug truncate ${isDirect ? 'text-gray-400' : 'text-gray-200'}`}>
                                      {placement.name}
                                    </span>
                                    <Badge variant="default" size="sm">{getPlacementLabel(placement.type)}</Badge>
                                    <PlacementBadge placementType={placement.type} compact />
                                    {isTopPerformer && (
                                      <Badge variant="top" size="sm">Top</Badge>
                                    )}
                                  </div>
                                </div>
                                {/* Click count */}
                                <div className="flex-shrink-0 text-right">
                                  <span className={`text-sm font-bold tabular-nums leading-none ${
                                    placement.clicks === 0 ? 'text-gray-600' : isTopPerformer ? 'text-green-400' : 'text-gray-300'
                                  }`}>{placement.clicks}</span>
                                  <span className="text-[10px] text-gray-600 ml-1">clicks</span>
                                </div>
                              </div>

                              {/* Actions row */}
                              {!isDirect && (
                                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-800/30">
                                  {placement.type === 'qr_code' && (
                                    <button
                                      onClick={() => {
                                        setSelectedPlacementForQR(placement);
                                        setShowQRModal(true);
                                      }}
                                      className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-medium rounded transition-colors"
                                      title="Show QR Code"
                                    >
                                      <QrCode className="w-3 h-3" />
                                      QR Code
                                    </button>
                                  )}
                                  <button
                                    onClick={() => copyPlacementUrl(placement)}
                                    className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 text-white text-[11px] font-medium rounded transition-colors"
                                  >
                                    {copiedId === placement.id ? (
                                      <><CheckCircle2 className="w-3 h-3 text-green-500" />Copied!</>
                                    ) : (
                                      <><Copy className="w-3 h-3" />Copy</>
                                    )}
                                  </button>
                                  <details className="flex-1">
                                    <summary className="text-[10px] text-gray-600 hover:text-gray-400 cursor-pointer select-none list-none px-2 py-1 transition-colors">
                                      Placement Link
                                    </summary>
                                    <div className="mt-1.5 mx-0 text-[10px] text-gray-400 font-mono break-all bg-gray-800/50 px-2 py-1.5 rounded">
                                      {getPlacementUrl(placement)}
                                    </div>
                                  </details>
                                  {(placement.youtube_video_id || placement.link_usage_id) && (
                                    <button
                                      onClick={() => handleRemoveVideo(String(placement.id))}
                                      className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 text-[11px] font-medium rounded transition-colors"
                                      title="Remove video from placement"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      Remove Video
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeletePlacement(String(placement.id))}
                                    className="p-1 text-gray-600 hover:text-red-400 rounded transition-colors"
                                    title="Delete placement"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                        )}
                      </div>
                    </div>
                  ))}

                  {/* General placements */}
                  {generalPlacements.length > 0 && (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                      <div className="px-4 pt-3 pb-2 border-b border-gray-800/50 bg-gray-900/50">
                        <div className="text-sm font-medium text-gray-300">General Placements</div>
                      </div>
                      <div className="space-y-1">
                        {generalPlacements.map((placement) => {
                          const isTopPerformer = getBestPlacement()?.id === placement.id && placement.clicks > 0;
                          const isDirect = placement.type === 'direct';
                          return (
                            <div
                              key={placement.id}
                              className={`px-4 py-2 border-t border-gray-800/30 transition-colors ${
                                isTopPerformer ? 'bg-green-900/5' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`text-sm font-medium leading-snug truncate ${isDirect ? 'text-gray-400' : 'text-gray-200'}`}>
                                      {placement.name}
                                    </span>
                                    <Badge variant="default" size="sm">{getPlacementLabel(placement.type)}</Badge>
                                    <PlacementBadge placementType={placement.type} compact />
                                    {isTopPerformer && (
                                      <Badge variant="top" size="sm">Top</Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex-shrink-0 text-right">
                                  <span className={`text-sm font-bold tabular-nums leading-none ${
                                    placement.clicks === 0 ? 'text-gray-600' : isTopPerformer ? 'text-green-400' : 'text-gray-300'
                                  }`}>{placement.clicks}</span>
                                  <span className="text-[10px] text-gray-600 ml-1">clicks</span>
                                </div>
                              </div>

                              {!isDirect && (
                                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-800/30">
                                  {placement.type === 'qr_code' && (
                                    <button
                                      onClick={() => {
                                        setSelectedPlacementForQR(placement);
                                        setShowQRModal(true);
                                      }}
                                      className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-medium rounded transition-colors"
                                      title="Show QR Code"
                                    >
                                      <QrCode className="w-3 h-3" />
                                      QR Code
                                    </button>
                                  )}
                                  <button
                                    onClick={() => copyPlacementUrl(placement)}
                                    className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 text-white text-[11px] font-medium rounded transition-colors"
                                  >
                                    {copiedId === placement.id ? (
                                      <><CheckCircle2 className="w-3 h-3 text-green-500" />Copied!</>
                                    ) : (
                                      <><Copy className="w-3 h-3" />Copy</>
                                    )}
                                  </button>
                                  <details className="flex-1">
                                    <summary className="text-[10px] text-gray-600 hover:text-gray-400 cursor-pointer select-none list-none px-2 py-1 transition-colors">
                                      Placement Link
                                    </summary>
                                    <div className="mt-1.5 mx-0 text-[10px] text-gray-400 font-mono break-all bg-gray-800/50 px-2 py-1.5 rounded">
                                      {getPlacementUrl(placement)}
                                    </div>
                                  </details>
                                  {(placement.youtube_video_id || placement.link_usage_id) && (
                                    <button
                                      onClick={() => handleRemoveVideo(String(placement.id))}
                                      className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 text-[11px] font-medium rounded transition-colors"
                                      title="Remove video from placement"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      Remove Video
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeletePlacement(String(placement.id))}
                                    className="p-1 text-gray-600 hover:text-red-400 rounded transition-colors"
                                    title="Delete placement"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Legacy/no-context placements */}
                  {legacyPlacements.length > 0 && (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                      <div className="px-4 pt-3 pb-2 border-b border-gray-800/50 bg-gray-900/50">
                        <div className="text-sm font-medium text-gray-300">No Video Attached</div>
                      </div>
                      <div className="space-y-1">
                        {legacyPlacements.map((placement) => {
                          const isTopPerformer = getBestPlacement()?.id === placement.id && placement.clicks > 0;
                          const isDirect = placement.type === 'direct';
                          return (
                            <div
                              key={placement.id}
                              className={`px-4 py-2 border-t border-gray-800/30 transition-colors ${
                                isTopPerformer ? 'bg-green-900/5' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`text-sm font-medium leading-snug truncate ${isDirect ? 'text-gray-400' : 'text-gray-200'}`}>
                                      {placement.name}
                                    </span>
                                    <Badge variant="default" size="sm">{getPlacementLabel(placement.type)}</Badge>
                                    <PlacementBadge placementType={placement.type} compact />
                                    {isTopPerformer && (
                                      <Badge variant="top" size="sm">Top</Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex-shrink-0 text-right">
                                  <span className={`text-sm font-bold tabular-nums leading-none ${
                                    placement.clicks === 0 ? 'text-gray-600' : isTopPerformer ? 'text-green-400' : 'text-gray-300'
                                  }`}>{placement.clicks}</span>
                                  <span className="text-[10px] text-gray-600 ml-1">clicks</span>
                                </div>
                              </div>

                              {!isDirect && (
                                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-800/30">
                                  {placement.type === 'qr_code' && (
                                    <button
                                      onClick={() => {
                                        setSelectedPlacementForQR(placement);
                                        setShowQRModal(true);
                                      }}
                                      className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-medium rounded transition-colors"
                                      title="Show QR Code"
                                    >
                                      <QrCode className="w-3 h-3" />
                                      QR Code
                                    </button>
                                  )}
                                  {placement.type === 'qr_code' && !placement.youtube_video_id && !placement.link_usage_id && (
                                    <button
                                      onClick={() => {
                                        setSelectedPlacementForAttach(placement);
                                        setShowAttachVideoModal(true);
                                      }}
                                      className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium rounded transition-colors"
                                      title="Attach video to placement"
                                    >
                                      <Plus className="w-3 h-3" />
                                      Attach Video
                                    </button>
                                  )}
                                  <button
                                    onClick={() => copyPlacementUrl(placement)}
                                    className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 text-white text-[11px] font-medium rounded transition-colors"
                                  >
                                    {copiedId === placement.id ? (
                                      <><CheckCircle2 className="w-3 h-3 text-green-500" />Copied!</>
                                    ) : (
                                      <><Copy className="w-3 h-3" />Copy</>
                                    )}
                                  </button>
                                  <details className="flex-1">
                                    <summary className="text-[10px] text-gray-600 hover:text-gray-400 cursor-pointer select-none list-none px-2 py-1 transition-colors">
                                      Placement Link
                                    </summary>
                                    <div className="mt-1.5 mx-0 text-[10px] text-gray-400 font-mono break-all bg-gray-800/50 px-2 py-1.5 rounded">
                                      {getPlacementUrl(placement)}
                                    </div>
                                  </details>
                                  {(placement.youtube_video_id || placement.link_usage_id) && (
                                    <button
                                      onClick={() => handleRemoveVideo(String(placement.id))}
                                      className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 text-[11px] font-medium rounded transition-colors"
                                      title="Remove video from placement"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      Remove Video
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeletePlacement(String(placement.id))}
                                    className="p-1 text-gray-600 hover:text-red-400 rounded transition-colors"
                                    title="Delete placement"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {showAddModal && (
          <AddPlacementModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            onAdd={handleAddPlacement}
            videoContexts={videoContexts}
          />
        )}

        {showQRModal && selectedPlacementForQR && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-md w-full transition-all duration-200">
              <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <h2 className="text-lg font-semibold text-white">
                  {selectedPlacementForQR.name}
                </h2>
                <button
                  onClick={() => {
                    setShowQRModal(false);
                    setSelectedPlacementForQR(null);
                  }}
                  className="text-gray-400 hover:text-white transition-all duration-200 active:scale-[0.98] p-1 rounded hover:bg-gray-800/50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <QRCodeDisplay
                  url={getPlacementUrl(selectedPlacementForQR)}
                  placementName={selectedPlacementForQR.name}
                />
              </div>
            </div>
          </div>
        )}

        {showAttachVideoModal && selectedPlacementForAttach && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-md w-full transition-all duration-200">
              <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <h2 className="text-lg font-semibold text-white">
                  Attach video to {selectedPlacementForAttach.name}
                </h2>
                <button
                  onClick={() => {
                    setShowAttachVideoModal(false);
                    setSelectedPlacementForAttach(null);
                  }}
                  className="text-gray-400 hover:text-white transition-all duration-200 active:scale-[0.98] p-1 rounded hover:bg-gray-800/50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-gray-400">
                  {selectedPlacementForAttach.type === 'qr_code'
                    ? 'Select a YouTube video to attach to this QR placement:'
                    : 'Select a video to attach to this placement:'}
                </p>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {youtubeVideosLoading ? (
                    <div className="text-sm text-gray-500 text-center py-4">
                      Loading videos...
                    </div>
                  ) : youtubeVideosError ? (
                    <div className="text-sm text-red-400 text-center py-4">
                      {youtubeVideosError}
                    </div>
                  ) : selectedPlacementForAttach.type === 'qr_code' ? (
                    // For QR codes, show all user's YouTube videos
                    youtubeVideos.length === 0 ? (
                      <div className="text-sm text-gray-500 text-center py-4">
                        No YouTube videos available. Connect your YouTube account in Settings.
                      </div>
                    ) : (
                      youtubeVideos.map((video) => (
                        <button
                          key={video.video_id}
                          onClick={() => handleAttachVideo(String(selectedPlacementForAttach.id), video.video_id, undefined)}
                          className="w-full text-left px-3 py-2.5 bg-gray-950 border border-gray-800 rounded-lg text-gray-300 hover:bg-gray-800 hover:border-gray-700 transition-colors flex items-start gap-3"
                        >
                          {video.thumbnail ? (
                            <img
                              src={video.thumbnail}
                              alt=""
                              className="w-24 h-14 object-cover rounded flex-shrink-0"
                            />
                          ) : (
                            <div className="w-24 h-14 bg-gray-800 rounded flex-shrink-0 flex items-center justify-center">
                              <span className="text-xs text-gray-600">No thumbnail</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            {video.title ? (
                              <div className="text-sm font-medium text-gray-200 truncate mb-0.5">
                                {video.title}
                              </div>
                            ) : (
                              <div className="text-sm font-mono text-gray-300 truncate mb-0.5">
                                youtube.com/watch?v={video.video_id}
                              </div>
                            )}
                            <div className="text-xs font-mono text-gray-500 truncate">
                              youtube.com/watch?v={video.video_id}
                            </div>
                          </div>
                        </button>
                      ))
                    )
                  ) : (
                    // For non-QR placements, show link's video contexts
                    videoContexts.length === 0 ? (
                      <div className="text-sm text-gray-500 text-center py-4">
                        No videos available. Add a video to this Smart Link first.
                      </div>
                    ) : (
                      videoContexts.map((video) => (
                        <button
                          key={video.video_id}
                          onClick={() => handleAttachVideo(String(selectedPlacementForAttach.id), video.video_id, video.link_usage_id)}
                          className="w-full text-left px-3 py-2.5 bg-gray-950 border border-gray-800 rounded-lg text-gray-300 hover:bg-gray-800 hover:border-gray-700 transition-colors flex items-start gap-3"
                        >
                          {video.thumbnail ? (
                            <img
                              src={video.thumbnail}
                              alt=""
                              className="w-24 h-14 object-cover rounded flex-shrink-0"
                            />
                          ) : (
                            <div className="w-24 h-14 bg-gray-800 rounded flex-shrink-0 flex items-center justify-center">
                              <span className="text-xs text-gray-600">No thumbnail</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            {video.title ? (
                              <div className="text-sm font-medium text-gray-200 truncate mb-0.5">
                                {video.title}
                              </div>
                            ) : (
                              <div className="text-sm font-mono text-gray-300 truncate mb-0.5">
                                {video.url}
                              </div>
                            )}
                            <div className="text-xs font-mono text-gray-500 truncate">
                              {video.url}
                            </div>
                            {video.is_base && (
                              <div className="text-xs text-blue-400 mt-0.5">
                                Base video
                              </div>
                            )}
                          </div>
                        </button>
                      ))
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
