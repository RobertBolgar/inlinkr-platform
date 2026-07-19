import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import { PageSkeleton } from '../components/PageSkeleton';
import { Badge, Toast } from '../components/ui';
import { ExternalLink, Copy, Share2, Calendar, MoreVertical, Power, ChevronDown, ChevronUp, History, RotateCcw, Info } from 'lucide-react';
import { getProofLimit } from '../lib/plan';

type Proof = {
  public_token: string;
  proof_mode: 'snapshot' | 'live';
  title: string | null;
  thumbnail: string | null;
  destination_domain: string | null;
  clicks: number;
  generated_at: string;
  snapshot_generated_at: string | null;
  created_at: string;
  is_enabled: number;
  proof_group_key: string | null;
  view_count: number;
  last_viewed_at: string | null;
  youtube_video_id: string | null;
  link_id: number | null;
  link_title: string | null;
  link_slug: string | null;
};

type ProofGroup = {
  groupKey: string;
  proofs: Proof[];
  latestProof: Proof;
  totalSnapshots: number;
  totalViews: number;
  lastViewedAt: string | null;
  allDisabled: boolean;
};

export function ProofsPage() {
  const { user } = useAuth();
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; variant: 'success' | 'error'; message: string }>({ visible: false, variant: 'success', message: '' });
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [disablingToken, setDisablingToken] = useState<string | null>(null);
  const [disablingGroupKey, setDisablingGroupKey] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'disabled'>('active');
  const [restoringToken, setRestoringToken] = useState<string | null>(null);

  useEffect(() => {
    fetchProofs();
  }, [user]);

  const fetchProofs = async () => {
    if (!user) return;

    try {
      const clerk = (window as any).Clerk;
      const token = await clerk.session.getToken();

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/proof-shares/list?include_disabled=true', {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (response.ok) {
        setProofs(data.proofs || []);
      } else {
        setError(data.error || 'Failed to load proofs');
      }
    } catch (err) {
      setError('Failed to load proofs');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (variant: 'success' | 'error', message: string) => {
    setToast({ visible: true, variant, message });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 2500);
  };

  const handleCopyLink = async (publicToken: string) => {
    try {
      const proofUrl = `${window.location.origin}/proof/${publicToken}`;
      await navigator.clipboard.writeText(proofUrl);
      setCopiedToken(publicToken);
      setCopyError(null);
      showToast('success', 'Proof link copied');
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
      setCopyError('Unable to copy link');
      showToast('error', 'Unable to copy link');
      setTimeout(() => setCopyError(null), 2000);
    }
  };

  const handleShare = async (proof: Proof) => {
    const proofUrl = `${window.location.origin}/proof/${proof.public_token}`;

    if (typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator) {
      try {
        if (navigator.canShare({ title: 'InLinkr Proof', url: proofUrl })) {
          await navigator.share({
            title: proof.title || 'InLinkr Proof',
            url: proofUrl,
          });
        }
      } catch (error) {
        // User cancelled or share failed
        if (error instanceof DOMException && error.name !== 'AbortError') {
          console.error('Share failed:', error);
        }
      }
    } else {
      // Fallback to copy
      handleCopyLink(proof.public_token);
    }
  };

  const handleDisable = async (publicToken: string) => {
    if (!window.confirm('Disable this proof? The public link will stop working.')) {
      return;
    }

    setDisablingToken(publicToken);

    try {
      const clerk = (window as any).Clerk;
      const token = await clerk.session.getToken();

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/proof-shares/disable', {
        method: 'POST',
        headers,
        body: JSON.stringify({ public_token: publicToken }),
      });

      const data = await response.json();

      if (response.ok) {
        // Remove the disabled proof from the list
        setProofs(proofs.filter(p => p.public_token !== publicToken));
        setMenuOpen(null);
      } else {
        setError(data.error || 'Failed to disable proof');
      }
    } catch (err) {
      setError('Failed to disable proof');
    } finally {
      setDisablingToken(null);
    }
  };

  const handleDisableGroup = async (group: ProofGroup) => {
    const message = group.totalSnapshots > 1
      ? `Disable all ${group.totalSnapshots} proofs in this group? The public links will stop working.`
      : 'Disable this proof? The public link will stop working.';

    if (!window.confirm(message)) {
      return;
    }

    setDisablingGroupKey(group.groupKey);

    try {
      const clerk = (window as any).Clerk;
      const token = await clerk.session.getToken();

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Use proof_group_key for production-safe group disabling
      const response = await fetch('/api/proof-shares/disable-group', {
        method: 'POST',
        headers,
        body: JSON.stringify({ proof_group_key: group.groupKey }),
      });

      const data = await response.json();

      if (response.ok) {
        // Refresh proofs to show updated state
        fetchProofs();
      } else {
        setError(data.error || 'Failed to disable proof group');
      }
    } catch (err) {
      setError('Failed to disable proof group');
    } finally {
      setDisablingGroupKey(null);
    }
  };

  const handleRestore = async (publicToken: string) => {
    if (!window.confirm('Restore this proof? The public link will work again.')) {
      return;
    }

    setRestoringToken(publicToken);

    try {
      const clerk = (window as any).Clerk;
      const token = await clerk.session.getToken();

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/proof-shares/restore', {
        method: 'POST',
        headers,
        body: JSON.stringify({ public_token: publicToken }),
      });

      const data = await response.json();

      if (response.ok) {
        // Refresh proofs to show updated state
        fetchProofs();
      } else {
        setError(data.error || 'Failed to restore proof');
      }
    } catch (err) {
      setError('Failed to restore proof');
    } finally {
      setRestoringToken(null);
    }
  };

  // Group proofs by youtube_video_id + destination_domain with intelligent fallbacks
  // Group proofs by proof_group_key when present, with legacy fallback for old records
  const groupProofs = (proofsList: Proof[]): ProofGroup[] => {
    const groups = new Map<string, Proof[]>();

    proofsList.forEach(proof => {
      // Prefer proof_group_key from database (production-safe grouping)
      let groupKey: string;

      if (proof.proof_group_key) {
        // Use the stable proof_group_key from the database
        groupKey = proof.proof_group_key;
      } else {
        // Legacy fallback for old records without proof_group_key
        // This matches the old grouping logic for backward compatibility
        if (proof.youtube_video_id && proof.destination_domain) {
          groupKey = `${proof.youtube_video_id}::${proof.destination_domain}`;
        } else if (proof.youtube_video_id) {
          groupKey = `video:${proof.youtube_video_id}`;
        } else if (proof.destination_domain && proof.title) {
          groupKey = `title_dest:${proof.title}::${proof.destination_domain}`;
        } else if (proof.title) {
          groupKey = `title:${proof.title}`;
        } else {
          groupKey = 'unknown';
        }
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(proof);
    });

    // Convert to ProofGroup objects
    return Array.from(groups.entries()).map(([groupKey, groupProofs]) => {
      // Sort by created_at desc to find latest
      const sortedProofs = groupProofs.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const latestProof = sortedProofs[0];

      // Calculate total views across all proofs in group
      const totalViews = sortedProofs.reduce((sum, p) => sum + (p.view_count || 0), 0);

      // Find the most recent last_viewed_at across all proofs
      const lastViewedDates = sortedProofs
        .map(p => p.last_viewed_at)
        .filter((date): date is string => date !== null);
      const lastViewedAt = lastViewedDates.length > 0
        ? lastViewedDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
        : null;

      // Find best destination to display (prefer destination from any proof in group)
      const bestDestination = sortedProofs.find(p => p.destination_domain)?.destination_domain || null;

      // Check if all proofs in group are disabled
      const allDisabled = sortedProofs.every(p => p.is_enabled === 0);

      return {
        groupKey,
        proofs: sortedProofs,
        latestProof: {
          ...latestProof,
          destination_domain: latestProof.destination_domain || bestDestination
        },
        totalSnapshots: sortedProofs.length,
        totalViews,
        lastViewedAt,
        allDisabled
      };
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
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
      <Toast visible={toast.visible} variant={toast.variant} message={toast.message} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-white">My Proofs</h1>
            {/* Usage Indicator */}
            {user && (
              <div className="text-sm">
                {(() => {
                  const limit = getProofLimit(user);
                  const activeCount = proofs.filter(p => p.is_enabled === 1).length;
                  
                  if (limit === 'unlimited') {
                    return (
                      <span className="text-gray-400">
                        Unlimited Active Proofs
                      </span>
                    );
                  }
                  
                  const remaining = limit - activeCount;
                  const isNearLimit = remaining <= 2;
                  
                  return (
                    <span className={isNearLimit ? 'text-amber-400' : 'text-gray-400'}>
                      {activeCount} / {limit} Active Proofs
                    </span>
                  );
                })()}
              </div>
            )}
          </div>
          <p className="text-gray-400 text-sm">
            Your traffic proof library for sponsors
          </p>
          {/* Helper text for Free users nearing limit */}
          {user && (() => {
            const limit = getProofLimit(user);
            if (limit !== 'unlimited') {
              const activeCount = proofs.filter(p => p.is_enabled === 1).length;
              const remaining = limit - activeCount;
              if (remaining <= 2 && remaining > 0) {
                return (
                  <p className="text-gray-500 text-xs mt-2 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    Disable older proofs anytime to free up active proof slots.
                  </p>
                );
              }
            }
            return null;
          })()}
        </div>

        {/* Tabs */}
        <div className="mb-4">
          <div className="inline-flex bg-gray-800/50 rounded-lg p-1 border border-gray-700/50">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === 'active'
                  ? 'bg-primary text-white shadow-sm shadow-blue-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              Active ({groupProofs(proofs.filter(p => p.is_enabled === 1)).length})
            </button>
            <button
              onClick={() => setActiveTab('disabled')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === 'disabled'
                  ? 'bg-amber-600/90 text-white shadow-sm shadow-amber-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              Disabled ({groupProofs(proofs.filter(p => p.is_enabled === 0)).length})
            </button>
          </div>
        </div>

        {proofs.length > 0 && (
          <p className="text-gray-500 text-xs mb-3">
            Showing latest 25 proofs, grouped by video and destination
          </p>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {!error && proofs.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-gray-600 mb-4">
              {activeTab === 'disabled' ? (
                <Power className="w-10 h-10 mx-auto mb-3" />
              ) : (
                <Share2 className="w-10 h-10 mx-auto mb-3" />
              )}
            </div>
            <h3 className="text-white text-base font-medium mb-2">
              {activeTab === 'disabled' ? 'No disabled proofs' : 'Your proof library is empty'}
            </h3>
            <p className="text-gray-400 text-sm mb-2">
              {activeTab === 'disabled'
                ? 'Disabled proofs will appear here'
                : 'Generate traffic proofs to share your performance with sponsors'}
            </p>
            {activeTab === 'active' && (
              <>
                <p className="text-gray-500 text-xs mb-4">
                  Proofs show your clicks and engagement in a shareable format
                </p>
                <Link
                  to="/links"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Go to Links
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {groupProofs(proofs.filter(p => activeTab === 'active' ? p.is_enabled === 1 : p.is_enabled === 0)).map((group) => (
              <div
                key={group.groupKey}
                className={`bg-gray-900 border rounded-xl transition-all relative ${
                  group.allDisabled
                    ? 'border-amber-900/40 bg-gray-900/60 opacity-70'
                    : 'border-gray-800 hover:border-gray-700'
                }`}
              >
                {/* Thumbnail Section */}
                {group.latestProof.thumbnail && (
                  <div className={`relative h-28 bg-gray-800 rounded-t-xl overflow-hidden ${
                    group.allDisabled ? 'opacity-40 grayscale-[30%]' : ''
                  }`}>
                    <img
                      src={group.latestProof.thumbnail}
                      alt={group.latestProof.title || 'Video'}
                      className="w-full h-full object-cover"
                    />
                    {/* Proof Mode Badge */}
                    <div className="absolute top-2 right-2">
                      {group.latestProof.proof_mode === 'snapshot' ? (
                        <Badge 
                          variant="snapshot" 
                          size="md"
                          className={group.allDisabled ? 'opacity-80' : ''}
                        >
                          Snapshot
                        </Badge>
                      ) : (
                        <Badge 
                          variant="live" 
                          size="md"
                          className={group.allDisabled ? 'opacity-80' : ''}
                        >
                          Live
                        </Badge>
                      )}
                    </div>
                    {/* Disabled Badge */}
                    {group.allDisabled && (
                      <div className="absolute top-2 left-2">
                        <Badge variant="disabled" size="md">Disabled</Badge>
                      </div>
                    )}
                    {/* Snapshot Count Badge */}
                    {group.totalSnapshots > 1 && !group.allDisabled && (
                      <div className="absolute top-2 left-2">
                        <Badge variant="count" size="md">{group.totalSnapshots}</Badge>
                      </div>
                    )}
                  </div>
                )}

                {/* Content Section */}
                <div className="p-3">
                  {/* Title */}
                  <h3 className={`font-medium text-sm leading-tight mb-2 line-clamp-2 ${
                    group.allDisabled ? 'text-gray-400' : 'text-white'
                  }`}>
                    {group.latestProof.title || 'Untitled Video'}
                  </h3>

                  {/* Smart Link */}
                  {group.latestProof.link_title || group.latestProof.link_slug ? (
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className={`text-[11px] font-medium ${
                        group.allDisabled ? 'text-gray-500' : 'text-blue-400'
                      }`}>
                        Smart Link: {group.latestProof.link_title || group.latestProof.link_slug}
                      </p>
                    </div>
                  ) : null}

                  {/* Destination */}
                  {group.latestProof.destination_domain ? (
                    <div className="flex items-center gap-1.5 mb-2">
                      <ExternalLink className={`w-3 h-3 flex-shrink-0 ${
                        group.allDisabled ? 'text-gray-600' : 'text-gray-500'
                      }`} />
                      <p className={`text-[11px] truncate ${
                        group.allDisabled ? 'text-gray-500' : 'text-gray-400'
                      }`}>
                        {group.latestProof.destination_domain}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mb-2">
                      <ExternalLink className={`w-3 h-3 flex-shrink-0 ${
                        group.allDisabled ? 'text-gray-600' : 'text-gray-500'
                      }`} />
                      <p className="text-gray-500 text-[11px] truncate">
                        Tracked destination
                      </p>
                    </div>
                  )}

                  {/* Stats Row */}
                  <div className="flex items-center gap-3 mb-2">
                    <div>
                      <p className={`font-semibold text-base ${
                        group.allDisabled ? 'text-gray-400' : 'text-white'
                      }`}>
                        {group.latestProof.clicks}
                      </p>
                      <p className="text-gray-500 text-[9px] uppercase tracking-wide">
                        Click{group.latestProof.clicks !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 ${
                      group.allDisabled ? 'text-gray-600' : 'text-gray-500'
                    }`}>
                      <Calendar className="w-3 h-3" />
                      <span className="text-[11px]">
                        {formatDate(group.latestProof.generated_at)}
                      </span>
                    </div>
                  </div>

                  {/* View Count */}
                  <div className="mb-2">
                    {group.totalViews > 0 ? (
                      <p className={`text-[11px] ${
                        group.allDisabled ? 'text-gray-500' : 'text-gray-400'
                      }`}>
                        {group.totalViews} view{group.totalViews !== 1 ? 's' : ''}
                        {group.lastViewedAt && (
                          <> • {formatDate(group.lastViewedAt)}</>
                        )}
                      </p>
                    ) : (
                      <p className="text-gray-500 text-[11px]">No views yet</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-gray-800">
                    {group.allDisabled ? (
                      <>
                        <button
                          onClick={() => handleRestore(group.latestProof.public_token)}
                          disabled={restoringToken === group.latestProof.public_token}
                          className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-amber-950/80 hover:bg-amber-900/80 text-amber-300 rounded-md text-xs font-medium transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          {restoringToken === group.latestProof.public_token ? 'Restoring...' : 'Restore'}
                        </button>
                        {group.totalSnapshots > 1 && (
                          <button
                            onClick={() => setExpandedGroup(expandedGroup === group.groupKey ? null : group.groupKey)}
                            className="p-1.5 bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 hover:text-white rounded-md transition-colors"
                            title="History"
                          >
                            {expandedGroup === group.groupKey ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <Link
                          to={`/proof/${group.latestProof.public_token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-center px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-md text-xs font-medium transition-colors"
                        >
                          View Proof
                        </Link>
                        <button
                          onClick={() => handleCopyLink(group.latestProof.public_token)}
                          className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-md text-xs font-medium transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          {copiedToken === group.latestProof.public_token ? 'Proof link copied' : copyError ? 'Unable to copy link' : 'Copy'}
                        </button>
                        <button
                          onClick={() => handleShare(group.latestProof)}
                          className="p-1.5 bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 hover:text-white rounded-md transition-colors"
                          title="Share"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDisableGroup(group)}
                          disabled={disablingGroupKey === group.groupKey}
                          className="p-1.5 bg-red-950/80 hover:bg-red-900/80 text-red-300 rounded-md transition-colors"
                          title={group.totalSnapshots > 1 ? 'Disable Proof Group' : 'Disable Proof'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        {group.totalSnapshots > 1 && (
                          <button
                            onClick={() => setExpandedGroup(expandedGroup === group.groupKey ? null : group.groupKey)}
                            className="p-1.5 bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 hover:text-white rounded-md transition-colors"
                            title="History"
                          >
                            {expandedGroup === group.groupKey ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* History Section */}
                  {expandedGroup === group.groupKey && group.totalSnapshots > 1 && (
                    <div className="mt-3 pt-3 border-t border-gray-800">
                      <div className="flex items-center gap-1.5 mb-2">
                        <History className={`w-3.5 h-3.5 ${
                          group.allDisabled ? 'text-gray-600' : 'text-gray-500'
                        }`} />
                        <p className={`text-[11px] font-medium ${
                          group.allDisabled ? 'text-gray-500' : 'text-gray-400'
                        }`}>History</p>
                      </div>
                      <div className="space-y-1.5">
                        {group.proofs.map((proof) => (
                          <div
                            key={proof.public_token}
                            className={`flex items-center justify-between p-2 rounded-md ${
                              group.allDisabled ? 'bg-gray-800/30' : 'bg-gray-800/50'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className={`text-[10px] ${
                                group.allDisabled ? 'text-gray-500' : 'text-gray-400'
                              }`}>
                                {formatDate(proof.created_at)}
                              </p>
                              <p className={`text-[11px] ${
                                group.allDisabled ? 'text-gray-400' : 'text-gray-300'
                              }`}>
                                {proof.clicks} click{proof.clicks !== 1 ? 's' : ''}
                              </p>
                              {proof.view_count > 0 && (
                                <p className="text-gray-500 text-[9px]">
                                  {proof.view_count} view{proof.view_count !== 1 ? 's' : ''}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              {group.allDisabled ? (
                                <button
                                  onClick={() => handleRestore(proof.public_token)}
                                  disabled={restoringToken === proof.public_token}
                                  className="p-1 bg-amber-950/80 hover:bg-amber-900/80 text-amber-300 rounded transition-colors"
                                  title="Restore"
                                >
                                  <RotateCcw className="w-2.5 h-2.5" />
                                </button>
                              ) : (
                                <>
                                  <Link
                                    to={`/proof/${proof.public_token}`}
                                    className="p-1 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                                    title="View"
                                  >
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </Link>
                                  <button
                                    onClick={() => handleCopyLink(proof.public_token)}
                                    className="p-1 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                                    title="Copy"
                                  >
                                    <Copy className="w-2.5 h-2.5" />
                                  </button>
                                  <div className="relative">
                                    <button
                                      onClick={() => setMenuOpen(menuOpen === proof.public_token ? null : proof.public_token)}
                                      className="p-1 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                                      title="More"
                                    >
                                      <MoreVertical className="w-2.5 h-2.5" />
                                    </button>
                                    {menuOpen === proof.public_token && (
                                      <div className="absolute right-0 top-full mt-1.5 w-20 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50">
                                        <button
                                          onClick={() => handleDisable(proof.public_token)}
                                          disabled={disablingToken === proof.public_token}
                                          className="w-full px-2 py-1.5 text-left text-[11px] text-red-400 hover:bg-gray-700 rounded-md transition-colors flex items-center gap-1.5"
                                        >
                                          <Power className="w-2.5 h-2.5" />
                                          {disablingToken === proof.public_token ? 'Disabling...' : 'Disable'}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
