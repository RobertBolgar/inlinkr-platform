import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import { PageSkeleton } from '../components/PageSkeleton';
import { VideoProofModal } from '../components/VideoProofModal';
import { ArrowLeft, ExternalLink, Edit } from 'lucide-react';
import { getPlacementLabel } from '../lib/placement-intelligence';

type Placement = {
  placement_id: number;
  placement_name: string;
  placement_type: string;
  clicks: number;
};

type SmartLink = {
  link_id: number;
  slug: string;
  title: string;
  destination_domain: string;
  destination_url: string;
  clicks: number;
  top_source: string | null;
  link_usage_id: number | null;
  proof_available: boolean;
  proof_context_type: 'usage' | 'placement' | 'legacy';
  placement_breakdown: Array<{
    source_code: string;
    click_count: number;
    placement_name: string;
    placement_type: string;
  }>;
};

type ClickPath = {
  placement_name: string;
  placement_type: string;
  link_title: string;
  link_slug: string;
  destination_domain: string;
  clicks: number;
};

type Proof = {
  public_token: string;
  proof_mode: 'snapshot' | 'live';
  snapshot_clicks: number | null;
  created_at: string;
  is_enabled: number;
};

type VideoData = {
  video_id: string;
  title: string | null;
  thumbnail: string | null;
  youtube_url: string;
  total_clicks: number;
  total_views: number | null;
  ctr: number | null;
  link_count: number;
  placements: Placement[];
  smart_links: SmartLink[];
  click_paths: ClickPath[];
  proofs: Proof[];
  attribution_mode: string;
};

export function VideoPerformancePage() {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proofModalVideo, setProofModalVideo] = useState<any>(null);
  const [proofModalConvertingPlacements, setProofModalConvertingPlacements] = useState<Array<{ source_code: string; click_count: number }>>([]);
  const [proofModalTopSource, setProofModalTopSource] = useState('');
  const [proofModalAdditionalSources, setProofModalAdditionalSources] = useState<string[]>([]);
  const [proofModalAttributionAvailable, setProofModalAttributionAvailable] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !videoId) return;

      try {
        const clerk = (window as any).Clerk;
        let headers: HeadersInit = { 'Content-Type': 'application/json' };

        if (clerk && clerk.session) {
          const token = await clerk.session.getToken();
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        }

        const response = await fetch(`/api/video/${videoId}`, {
          method: 'GET',
          headers,
        });

        const result = await response.json();

        if (response.ok) {
          setData(result.data);
        } else {
          setError(result.error || 'Failed to load video performance');
        }
      } catch (err) {
        setError('Failed to load video performance');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, videoId]);

  const formatCTR = (ctr: number | null) => {
    if (ctr === null) return '—';
    if (ctr === 0) return '0.0%';
    if (ctr < 0.1) return '<0.1%';
    return `${ctr.toFixed(1)}%`;
  };

  const getPlacementTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      description: 'bg-blue-500/20 text-blue-400',
      pinned: 'bg-green-500/20 text-green-400',
      bio: 'bg-purple-500/20 text-purple-400',
      short: 'bg-orange-500/20 text-orange-400',
      video: 'bg-red-500/20 text-red-400',
      other: 'bg-gray-500/20 text-gray-400',
      direct: 'bg-gray-500/20 text-gray-400',
    };
    return colors[type] || colors.other;
  };

  if (loading) {
    return (
      <Layout>
        <PageSkeleton />
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <h2 className="text-xl font-semibold text-white mb-2">Video Not Found</h2>
            <p className="text-gray-400 mb-6">{error || 'This video may not exist or you may not have access to it.'}</p>
            <button
              onClick={() => navigate('/analytics')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Analytics
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/analytics')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Analytics</span>
          </button>

          <div className="flex flex-col md:flex-row gap-6">
            {/* Thumbnail */}
            {data.thumbnail && (
              <div className="flex-shrink-0">
                <img
                  src={data.thumbnail}
                  alt={data.title || 'Video'}
                  className="w-full md:w-72 rounded-lg object-cover"
                />
              </div>
            )}

            {/* Video Info */}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white mb-2">
                {data.title || 'Video'}
              </h1>
              <p className="text-gray-400 text-sm mb-4">ID: {data.video_id}</p>
              
              <a
                href={data.youtube_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm transition-colors mb-6"
              >
                <ExternalLink className="w-4 h-4" />
                Open on YouTube
              </a>

              {/* Metric Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-2xl font-bold text-white mb-1">{data.total_clicks}</div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Clicks</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-2xl font-bold text-white mb-1">
                    {data.total_views !== null ? data.total_views.toLocaleString() : '—'}
                  </div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Views</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-2xl font-bold text-white mb-1">{formatCTR(data.ctr)}</div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">CTR</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-2xl font-bold text-white mb-1">{data.link_count}</div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Links</div>
                </div>
              </div>

              {/* Legacy attribution helper message */}
              {data.attribution_mode === 'legacy_unattributed' && (
                <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                  <p className="text-sm text-amber-200">
                    <strong>Note:</strong> This video uses older link tracking. Only the attached Smart Links are shown above. New clicks will be attributed after you add links through placements.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Placements Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Placements</h2>
          {data.placements.length > 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-lg divide-y divide-gray-800">
              {data.placements.map((placement) => (
                <div
                  key={placement.placement_id}
                  className="flex items-center justify-between p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-white">{getPlacementLabel(placement.placement_type)}</span>
                    <span className={`text-xs px-2 py-1 rounded ${getPlacementTypeBadge(placement.placement_type)}`}>
                      {getPlacementLabel(placement.placement_type)}
                    </span>
                  </div>
                  <div className="text-lg font-semibold text-blue-400">{placement.clicks}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400">No placement data yet.</p>
            </div>
          )}
        </div>

        {/* Smart Links Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Smart Links</h2>
          {data.smart_links.length > 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-lg divide-y divide-gray-800">
              {data.smart_links.map((link) => (
                <div
                  key={link.link_id}
                  className="flex items-center justify-between p-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white mb-1">{link.title}</div>
                    <div className="text-sm text-gray-400 mb-1">{link.destination_domain}</div>
                    {link.top_source && (
                      <div className="text-xs text-gray-400">Top source: {link.top_source}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-lg font-semibold text-blue-400">{link.clicks}</div>
                    {link.proof_available ? (
                      <button
                        onClick={() => {
                          const convertingPlacements = link.placement_breakdown.map(p => ({
                            source_code: p.source_code,
                            click_count: p.click_count
                          }));
                          const topSourceLabel = link.top_source || '';
                          const additionalSourceLabels = link.placement_breakdown
                            .slice(1, 3)
                            .map(p => p.placement_name);

                          // Calculate CTR from link-specific clicks, not video-level CTR
                          const linkSpecificCtr = data.total_views > 0 ? (link.clicks / data.total_views) * 100 : null;
                          
                          setProofModalVideo({
                            video_id: data.video_id,
                            title: data.title,
                            thumbnail: data.thumbnail,
                            total_clicks: link.clicks,
                            conversion_rate: linkSpecificCtr,
                            views: data.total_views,
                            link_count: 1,
                            link_id: link.link_id,
                            link_usage_id: link.link_usage_id,
                            destination_url: link.destination_url
                          });
                          setProofModalConvertingPlacements(convertingPlacements);
                          setProofModalTopSource(topSourceLabel);
                          setProofModalAdditionalSources(additionalSourceLabels);
                          setProofModalAttributionAvailable(convertingPlacements.length > 0);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
                      >
                        Share Proof
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">Proof unavailable for older tracking</span>
                    )}
                    <Link
                      to={`/links/${link.link_id}/edit`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
                    >
                      <Edit className="w-3 h-3" />
                      Edit
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400">No Smart Links found for this video.</p>
            </div>
          )}
        </div>

        {/* Best Click Paths Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Best Click Paths</h2>
          {data.click_paths.length > 0 ? (
            <div className="space-y-3">
              {data.click_paths.map((path, index) => (
                <div
                  key={`${path.placement_name}-${path.link_slug}-${index}`}
                  className="bg-gray-900 border border-gray-800 rounded-lg p-4"
                >
                  <div className="text-lg font-semibold text-blue-400 mb-3">{path.clicks} clicks</div>
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-2 text-sm">
                    <span className="font-medium text-white">{getPlacementLabel(path.placement_type)}</span>
                    <span className="text-gray-400">↓</span>
                    <span className="font-medium text-white">{path.link_title}</span>
                    <span className="text-gray-400">↓</span>
                    <span className="text-gray-400">{path.destination_domain}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400">No click paths yet.</p>
            </div>
          )}
        </div>

        {/* Proofs Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Proof of Performance</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400 mb-4">Create proofs from the Smart Links above. Manage and share all proofs from My Proofs.</p>
            <Link
              to="/proofs"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              View My Proofs
            </Link>
            <p className="text-gray-400 text-xs mt-4">Proofs capture a verified snapshot of traffic sent to a specific destination.</p>
          </div>
        </div>

        {/* Video Proof Modal */}
        {proofModalVideo && (
          <VideoProofModal
            isOpen={!!proofModalVideo}
            onClose={() => {
              setProofModalVideo(null);
              setProofModalConvertingPlacements([]);
              setProofModalTopSource('');
              setProofModalAdditionalSources([]);
              setProofModalAttributionAvailable(false);
            }}
            video={proofModalVideo}
            destinationUrl={proofModalVideo.destination_url || null}
            attributionAvailable={proofModalAttributionAvailable}
            topSourceLabel={proofModalTopSource}
            additionalSourceLabels={proofModalAdditionalSources}
            convertingPlacements={proofModalConvertingPlacements}
            onProofCreated={() => {
              // Refresh data to show newly created proof
              const fetchData = async () => {
                if (!user || !videoId) return;
                try {
                  const clerk = (window as any).Clerk;
                  let headers: HeadersInit = { 'Content-Type': 'application/json' };
                  if (clerk && clerk.session) {
                    const token = await clerk.session.getToken();
                    if (token) {
                      headers['Authorization'] = `Bearer ${token}`;
                    }
                  }
                  const response = await fetch(`/api/video/${videoId}`, { headers });
                  const result = await response.json();
                  if (result.success) {
                    setData(result.data);
                  }
                } catch (err) {
                  console.error('Error refreshing data after proof creation:', err);
                }
              };
              fetchData();
            }}
          />
        )}
      </div>
    </Layout>
  );
}
