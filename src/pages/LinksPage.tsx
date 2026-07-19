import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, Link as LinkType } from '../lib/cloudflare';
import { Layout } from '../components/Layout';
import { PageSkeleton } from '../components/PageSkeleton';
import { LinkCard } from '../components/LinkCard';
import { VideoProofModal } from '../components/VideoProofModal';
import { AddPlacementModal } from '../components/AddPlacementModal';
import { QRCodeDisplay } from '../components/placements/QRCodeDisplay';
import { Plus, RefreshCw, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { hasProAccess } from '../lib/plan';
import { buildSmartLinkUrl } from '../lib/smart-link-url';
import {
  LinkPortfolio,
  LinkActivityChart,
  TopPerformingLinks,
} from '../components/links-overview';

type LinkWithClicks = LinkType & {
  clicks: number;
};

export function LinksPage() {
  const { user } = useAuth();
  const userHasProAccess = useMemo(() => hasProAccess(user), [user]);
  const [links, setLinks] = useState<LinkWithClicks[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [selectedVideoContexts, setSelectedVideoContexts] = useState<Array<{ video_id: string; title?: string | null; thumbnail?: string | null; url: string; placement_name?: string | null; is_base: boolean; link_usage_id?: number }>>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedLinkForQR, setSelectedLinkForQR] = useState<LinkWithClicks | null>(null);
  const [qrPlacementUrl, setQrPlacementUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [activePage, setActivePage] = useState(1);
  const [archivedPage, setArchivedPage] = useState(1);
  const LINKS_PER_PAGE = 10;
  const [proofModalVideo, setProofModalVideo] = useState<any>(null);
  const [proofModalConvertingPlacements, setProofModalConvertingPlacements] = useState<Array<{ source_code: string; click_count: number }>>([]);
  const [proofModalTopSource, setProofModalTopSource] = useState<string>('');
  const [proofModalAdditionalSources, setProofModalAdditionalSources] = useState<string[]>([]);
  const [proofModalAttributionAvailable, setProofModalAttributionAvailable] = useState<boolean>(false);
  const [totalPlacements, setTotalPlacements] = useState<number>(0);

  useEffect(() => {
    fetchLinks();
  }, [user]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      fetchLinks();
    }, 15000);

    return () => clearInterval(interval);
  }, [user]);

  // Refetch when tab becomes visible or gains focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user) {
        fetchLinks();
      }
    };

    const handleFocus = () => {
      if (user) {
        fetchLinks();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user]);

  const fetchLinks = async () => {
    if (!user) return;

    try {
      const links = await db.getLinksByUserId(user.id, true);

      if (!links || links.length === 0) {
        setLoading(false);
        return;
      }

      // /api/links already returns click counts and YouTube metadata
      // No need for additional fetches
      const linksWithClicks = links.map((link: any) => ({
        ...link,
        clicks: link.clicks || 0,
      }));

      setLinks(linksWithClicks);

      // Fetch total placements count
      const linkIds = links.map((l: any) => l.id);
      if (linkIds.length > 0) {
        try {
          const placementsData = await db.getPlacementsByLinkIds(linkIds);
          const totalPlacementsCount = Object.values(placementsData).reduce((sum: number, placements: any) => sum + (placements?.length || 0), 0);
          setTotalPlacements(totalPlacementsCount);
        } catch (error) {
          console.error('Error fetching placements count:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching links:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchLinks();
  };

  const handleTabChange = (tab: 'active' | 'archived') => {
    setActiveTab(tab);
    if (tab === 'active') {
      setActivePage(1);
    } else {
      setArchivedPage(1);
    }
  };

  const toggleLinkStatus = async (linkId: string, currentStatus: boolean) => {
    try {
      await db.updateLink(linkId, { 
        is_active: !currentStatus
      });
      fetchLinks();
    } catch (error) {
      console.error('Error toggling link status:', error);
    }
  };

  const handleAddPlacement = (linkId: string, videoContexts?: Array<{ video_id: string; title?: string | null; thumbnail?: string | null; url: string; placement_name?: string | null; is_base: boolean; link_usage_id?: number }>) => {
    setSelectedLinkId(linkId);
    setSelectedVideoContexts(videoContexts || []);
    setShowAddModal(true);
  };

  const handleAddPlacementSubmit = async (placement: { name: string; type: string; link_usage_id?: number | null; youtube_video_id?: string | null }) => {
    try {
      const data = await db.createPlacement({ ...placement, link_id: parseInt(selectedLinkId || '0') });

      if (!data.success) {
        throw new Error(data.error || 'Failed to add placement');
      }

      fetchLinks();
    } catch (error) {
      throw error;
    }
  };

  const handleViewPlacements = (linkId: string) => {
    window.location.href = `/links/${linkId}/placements`;
  };

  const handleShowQR = async (linkId: string) => {
    const link = links.find(l => l.id === linkId);
    if (!link) return;

    setSelectedLinkForQR(link);

    // Check if QR placement already exists
    try {
      const placements = await db.getPlacementsByLinkId(linkId);
      const qrPlacement = placements.find((p: any) => p.type === 'qr_code');

      if (qrPlacement) {
        // Use existing QR placement
        const url = buildSmartLinkUrl({
          slug: link.slug,
          publicCode: link.public_code,
          username: user?.username,
          placementCode: qrPlacement.public_code,
        }, user);
        setQrPlacementUrl(url);
        setShowQRModal(true);
      } else {
        // Create QR placement silently
        const qrData = await db.createPlacement({
          link_id: parseInt(linkId),
          name: 'Video QR Code',
          type: 'qr_code',
          link_usage_id: null,
          youtube_video_id: null
        });

        if (qrData.success) {
          const url = buildSmartLinkUrl({
            slug: link.slug,
            publicCode: link.public_code,
            username: user?.username,
            placementCode: qrData.placement.public_code,
          }, user);
          setQrPlacementUrl(url);
          setShowQRModal(true);
          fetchLinks(); // Refresh to show the new placement count
        } else {
          alert('Failed to create QR placement');
        }
      }
    } catch (error) {
      console.error('Error handling QR:', error);
      alert('Failed to load QR code');
    }
  };

  const handleRemoveBaseVideo = async (linkId: string) => {
    try {
      await db.updateLink(linkId, {
        video_id: null,
        video_title: null,
        video_thumbnail: null
      });
      fetchLinks();
    } catch (error) {
      console.error('Error removing base video:', error);
      alert('Failed to remove base video');
    }
  };

  const handleShareProof = async (videoContext: { video_id: string; title?: string | null; thumbnail?: string | null; link_id: number; link_usage_id: number | undefined; clicks: number | undefined; destination_url: string; base_video_placements?: Array<{ name: string; type: string; source_code: string }> }) => {
    // Fetch video-specific metrics from canonical API
    let videoSpecificClicks = videoContext.clicks || 0;
    let videoSpecificViews = null;
    let videoSpecificCtr = null;
    let videoSpecificPlacements = [];
    let videoSpecificTopSource = '';
    let videoSpecificAdditionalSources = [];
    let videoSpecificAttributionAvailable = false;

    try {
      const clerk = (window as any).Clerk;
      let headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (clerk && clerk.session) {
        const token = await clerk.session.getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(`/api/video/${videoContext.video_id}`, { headers });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Find the matching Smart Link by link_id
          const matchingLink = result.data.smart_links?.find((link: any) => link.link_id === videoContext.link_id);
          if (matchingLink) {
            videoSpecificClicks = matchingLink.clicks || 0;
            videoSpecificViews = result.data.total_views;
            // Calculate CTR from link-specific clicks, not video-level CTR
            videoSpecificCtr = videoSpecificViews > 0 ? (videoSpecificClicks / videoSpecificViews) * 100 : null;
            
            // Extract placement data from matching link's placement_breakdown
            if (matchingLink.placement_breakdown && matchingLink.placement_breakdown.length > 0) {
              videoSpecificPlacements = matchingLink.placement_breakdown.map((p: any) => ({
                source_code: p.source_code,
                click_count: p.click_count
              }));
              videoSpecificAttributionAvailable = true;
              
              if (videoSpecificPlacements.length > 0) {
                videoSpecificPlacements.sort((a: any, b: any) => b.click_count - a.click_count);
                videoSpecificTopSource = videoSpecificPlacements[0].source_code;
                videoSpecificAdditionalSources = videoSpecificPlacements.slice(1).map((p: any) => p.source_code);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching video-specific metrics for proof:', error);
      // Fallback to provided context if fetch fails
    }

    // If base video placements are provided (from Links page), use them as fallback
    if (!videoSpecificAttributionAvailable && videoContext.base_video_placements && videoContext.base_video_placements.length > 0) {
      videoSpecificPlacements = videoContext.base_video_placements.map((p: any) => ({
        source_code: p.source_code || 'direct',
        click_count: 0 // We don't have click counts from the links API, but we have the placement names
      }));
      videoSpecificAttributionAvailable = true;
      
      if (videoSpecificPlacements.length > 0) {
        videoSpecificTopSource = videoSpecificPlacements[0].source_code;
        videoSpecificAdditionalSources = videoSpecificPlacements.slice(1).map((p: any) => p.source_code);
      }
    }

    setProofModalVideo({
      video_id: videoContext.video_id,
      title: videoContext.title,
      thumbnail: videoContext.thumbnail,
      total_clicks: videoSpecificClicks || 0,
      conversion_rate: videoSpecificCtr,
      views: videoSpecificViews,
      link_count: 1,
      link_id: videoContext.link_id,
      link_usage_id: videoContext.link_usage_id,
      destination_url: videoContext.destination_url
    });
    setProofModalConvertingPlacements(videoSpecificPlacements);
    setProofModalTopSource(videoSpecificTopSource);
    setProofModalAdditionalSources(videoSpecificAdditionalSources);
    setProofModalAttributionAvailable(videoSpecificAttributionAvailable);
  };

  if (loading) {
    return (
      <Layout>
        <PageSkeleton />
      </Layout>
    );
  }

  // Filter out system links and invite links for limit checking (only active links count toward cap)
  const nonSystemLinks = links.filter((link: any) => !link.is_system && link.slug !== 'invite' && link.slug !== 'my-invite' && link.is_active !== false && link.is_active !== 0);

  // Separate active and inactive links
  const activeLinks = links.filter((link: any) => link.is_active !== false && link.is_active !== 0);
  const inactiveLinks = links.filter((link: any) => link.is_active === false || link.is_active === 0);

  // Calculate paginated links
  const currentPage = activeTab === 'active' ? activePage : archivedPage;
  const currentLinks = activeTab === 'active' ? activeLinks : inactiveLinks;
  const totalPages = Math.ceil(currentLinks.length / LINKS_PER_PAGE);
  const paginatedLinks = currentLinks.slice(
    (currentPage - 1) * LINKS_PER_PAGE,
    currentPage * LINKS_PER_PAGE
  );

  // Sum only active link clicks to match Analytics page (which excludes archived links)
  const totalClicks = activeLinks.reduce((sum, link) => sum + (link.clicks || 0), 0);
  const averageClicksPerLink = activeLinks.length > 0 ? totalClicks / activeLinks.length : 0;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 sm:px-6 lg:px-8">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              <span className="hidden sm:inline">Your Smart Links</span>
              <span className="sm:hidden">Smart Links</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh stats"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <Link
              to="/links/new"
              className="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Create Smart Link
            </Link>
          </div>
        </div>

        {/* Limit warnings */}
        {!userHasProAccess && (
          <div className="mb-4">
            {nonSystemLinks.length >= 5 ? (
              <div className="bg-red-900/20 border border-red-800 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
                <p className="text-red-400 text-sm">Smart Link limit reached.</p>
                <Link to="/upgrade" className="text-sm text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap font-medium">Upgrade to Pro</Link>
              </div>
            ) : nonSystemLinks.length >= 4 ? (
              <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg px-3 py-2">
                <p className="text-yellow-400 text-sm">{5 - nonSystemLinks.length} free Smart Link{5 - nonSystemLinks.length > 1 ? 's' : ''} remaining.</p>
              </div>
            ) : null}
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left column - Main content (60%) */}
          <div className={`space-y-3 ${links.length > 0 ? 'lg:col-span-3' : 'lg:col-span-5'}`}>
            {links.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:p-6 text-center">
                <h2 className="text-base sm:text-lg font-semibold text-white mb-2">No Smart Links Yet</h2>
                <p className="text-sm text-gray-400 mb-5 max-w-md mx-auto">
                  Create your first Smart Link to track clicks from your videos. Each link can be reused across multiple videos, descriptions, and placements.
                </p>
                <Link
                  to="/links/new"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create your first Smart Link
                </Link>
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <p className="text-xs text-gray-400 mb-2">Track clicks from:</p>
                  <div className="flex items-center justify-center gap-3 text-xs text-gray-400">
                    <span>YouTube descriptions</span>
                    <span className="text-gray-500">•</span>
                    <span>Pinned comments</span>
                    <span className="text-gray-500">•</span>
                    <span>Channel bios</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-1 flex gap-1">
                  <button
                    onClick={() => handleTabChange('active')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      activeTab === 'active'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                    }`}
                  >
                    Active ({activeLinks.length})
                  </button>
                  <button
                    onClick={() => handleTabChange('archived')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      activeTab === 'archived'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                    }`}
                  >
                    Archived ({inactiveLinks.length})
                  </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'active' ? (
                  activeLinks.length > 0 ? (
                    <>
                      <div className="space-y-2.5">
                        {paginatedLinks.map((link) => (
                          <LinkCard
                            key={link.id}
                            link={link}
                            username={user?.username}
                            onToggleStatus={toggleLinkStatus}
                            onAddPlacement={handleAddPlacement}
                            onViewPlacements={handleViewPlacements}
                            onShowQR={handleShowQR}
                            onShareProof={handleShareProof}
                            onRemoveBaseVideo={handleRemoveBaseVideo}
                            user={user}
                          />
                        ))}
                      </div>
                      {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-4">
                          <button
                            onClick={() => setActivePage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronLeft className="w-4 h-4" />
                            Previous
                          </button>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                              <button
                                key={page}
                                onClick={() => setActivePage(page)}
                                className={`w-8 h-8 text-sm font-medium rounded-lg transition-colors ${
                                  currentPage === page
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                }`}
                              >
                                {page}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => setActivePage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:p-6 text-center">
                      <h2 className="text-base sm:text-lg font-semibold text-white mb-2">No active Smart Links</h2>
                      <p className="text-sm text-gray-400 mb-5 max-w-md mx-auto">
                        Create a Smart Link or reactivate one from your archived Smart Links to start tracking clicks.
                      </p>
                      {inactiveLinks.length > 0 && (
                        <button
                          onClick={() => handleTabChange('archived')}
                          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          View archived Smart Links
                        </button>
                      )}
                    </div>
                  )
                ) : (
                  inactiveLinks.length > 0 ? (
                    <>
                      <div className="space-y-2.5">
                        {paginatedLinks.map((link) => (
                          <LinkCard
                            key={link.id}
                            link={link}
                            username={user?.username}
                            onToggleStatus={toggleLinkStatus}
                            onAddPlacement={handleAddPlacement}
                            onViewPlacements={handleViewPlacements}
                            onShowQR={handleShowQR}
                            onShareProof={handleShareProof}
                            onRemoveBaseVideo={handleRemoveBaseVideo}
                            user={user}
                          />
                        ))}
                      </div>
                      {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-4">
                          <button
                            onClick={() => setArchivedPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronLeft className="w-4 h-4" />
                            Previous
                          </button>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                              <button
                                key={page}
                                onClick={() => setArchivedPage(page)}
                                className={`w-8 h-8 text-sm font-medium rounded-lg transition-colors ${
                                  currentPage === page
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                }`}
                              >
                                {page}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => setArchivedPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:p-6 text-center">
                      <h2 className="text-base sm:text-lg font-semibold text-white mb-2">No archived Smart Links</h2>
                      <p className="text-sm text-gray-400 mb-5 max-w-md mx-auto">
                        Archived Smart Links appear here when you deactivate them. Reactivate them anytime.
                      </p>
                      {activeLinks.length > 0 && (
                        <button
                          onClick={() => handleTabChange('active')}
                          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          View active Smart Links
                        </button>
                      )}
                    </div>
                  )
                )}
              </>
            )}
          </div>

          {/* Right column - Sticky overview panel (40%) - Only show when links exist */}
          {links.length > 0 && (
            <div className="lg:col-span-2 space-y-4">
              <div className="lg:sticky lg:top-4 space-y-4">
                <LinkPortfolio
                  totalClicks={totalClicks}
                  activeLinks={activeLinks.length}
                  totalPlacements={totalPlacements}
                  averageClicksPerLink={averageClicksPerLink}
                />

                <LinkActivityChart />

                <TopPerformingLinks links={
                  [...links]
                    .filter((link: any) => link.is_active !== false && link.is_active !== 0)
                    .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
                    .slice(0, 3)
                    .map((link: any) => ({
                      id: link.id,
                      name: link.name || link.slug || 'Unnamed Link',
                      clicks: link.clicks || 0,
                      percentage: totalClicks > 0 ? ((link.clicks || 0) / totalClicks) * 100 : 0,
                    }))
                } />
              </div>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <AddPlacementModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddPlacementSubmit}
          videoContexts={selectedVideoContexts}
        />
      )}

      {proofModalVideo && (
        <VideoProofModal
          isOpen={!!proofModalVideo}
          onClose={() => setProofModalVideo(null)}
          video={proofModalVideo}
          destinationUrl={proofModalVideo.destination_url || null}
          attributionAvailable={proofModalAttributionAvailable}
          topSourceLabel={proofModalTopSource}
          additionalSourceLabels={proofModalAdditionalSources}
          convertingPlacements={proofModalConvertingPlacements}
        />
      )}

      {showQRModal && selectedLinkForQR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-md w-full transition-all duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">
                {selectedLinkForQR.title || selectedLinkForQR.slug}
              </h2>
              <button
                onClick={() => {
                  setShowQRModal(false);
                  setSelectedLinkForQR(null);
                }}
                className="text-gray-400 hover:text-white transition-all duration-200 active:scale-[0.98] p-1 rounded hover:bg-gray-800/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <QRCodeDisplay
                url={qrPlacementUrl}
                placementName="Video QR Code"
              />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
