import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Link as LinkType, User } from '../lib/cloudflare';
import { Copy, Check, ExternalLink, Plus, List, ChevronDown, ChevronUp, MoreHorizontal, Power, PowerOff, Edit2, QrCode } from 'lucide-react';
import { hasFeature, FEATURES, hasProAccess } from '../lib/plan';

type LinkWithStats = LinkType & {
  clicks: number;
  video_id?: string | null;
  video_title?: string | null;
  video_thumbnail?: string | null;
  link_usages?: any[];
  base_video_placements?: Array<{ name: string; type: string; source_code: string }>;
  base_video_proof_available?: boolean;
  base_video_proof_context_type?: string;
};

interface LinkCardProps {
  link: LinkWithStats;
  username?: string;
  onToggleStatus: (linkId: string, currentStatus: boolean) => void;
  onAddPlacement: (linkId: string, videoContexts?: Array<{ video_id: string; title?: string | null; thumbnail?: string | null; url: string; placement_name?: string | null; is_base: boolean; link_usage_id?: number }>) => void;
  onViewPlacements: (linkId: string) => void;
  onShowQR?: (linkId: string) => void;
  onShareProof?: (videoContext: { video_id: string; title?: string | null; thumbnail?: string | null; link_id: number; link_usage_id: number | undefined; clicks: number | undefined; destination_url: string; base_video_placements?: Array<{ name: string; type: string; source_code: string }> }) => void;
  onRemoveBaseVideo?: (linkId: string) => void;
  user: User | null;
}

const PUBLIC_BASE_URL = 'https://go.tubelinkr.com';

export function LinkCard({ link, username, onToggleStatus, onAddPlacement, onViewPlacements, onShowQR, onShareProof, onRemoveBaseVideo, user }: LinkCardProps) {
  const navigate = useNavigate();
  const userHasProAccess = useMemo(() => hasProAccess(user), [user]);
  const [copied, setCopied] = useState(false);
  const [quickCopied, setQuickCopied] = useState(false);
  const [brandedCopied, setBrandedCopied] = useState(false);
  const [showCopyUpgradeMessage, setShowCopyUpgradeMessage] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);

  const getPublicUrl = (slug: string, publicCode?: string): string => {
    if (!username) return '';
    // Phase 3: Prefer public_code for Free links, fallback to username/slug
    if (publicCode) {
      return `${PUBLIC_BASE_URL}/${publicCode}`;
    }
    return `${PUBLIC_BASE_URL}/${username}/${slug}`;
  };

  const getBrandedUrl = (slug: string): string => {
    const subdomain = user?.subdomain || user?.username || '';
    return `https://${subdomain}.tubelinkr.com/${slug}`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getPublicUrl(link.slug, link.public_code));
    setCopied(true);
    if (userHasProAccess && !hasFeature(user, FEATURES.CUSTOM_SUBDOMAIN)) {
      setShowCopyUpgradeMessage(true);
      setTimeout(() => setShowCopyUpgradeMessage(false), 3000);
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const quickCopy = () => {
    const url = hasFeature(user, FEATURES.CUSTOM_SUBDOMAIN)
      ? getBrandedUrl(link.slug)
      : getPublicUrl(link.slug, link.public_code);
    if (!url) return;
    navigator.clipboard.writeText(url);
    setQuickCopied(true);
    setTimeout(() => setQuickCopied(false), 1500);
  };

  const canQuickCopy = hasFeature(user, FEATURES.CUSTOM_SUBDOMAIN)
    ? !!(user?.subdomain || user?.username)
    : !!username;

  const copyBrandedToClipboard = () => {
    navigator.clipboard.writeText(getBrandedUrl(link.slug));
    setBrandedCopied(true);
    setTimeout(() => setBrandedCopied(false), 2000);
  };

  const getPlacementCountText = () => {
    const count = link.placement_count || 0;
    if (count === 0) return 'No placements';
    if (count === 1) return '1 placement';
    return `${count} placements`;
  };

  const getAllVideos = () => {
    const videos: Array<{ video_id: string; title?: string | null; thumbnail?: string | null; url: string; placement_name?: string | null; is_base: boolean; link_usage_id?: number; proof_available?: boolean; proof_context_type?: string }> = [];
    const seen = new Set<string>();

    // Add base video first
    if (link.video_id) {
      // Determine placement name for base video from base_video_placements
      let basePlacementName = null;
      if (link.base_video_placements && link.base_video_placements.length > 0) {
        if (link.base_video_placements.length === 1) {
          basePlacementName = link.base_video_placements[0].name;
        } else {
          basePlacementName = `${link.base_video_placements.length} placements`;
        }
      }
      
      videos.push({
        video_id: link.video_id,
        title: link.video_title || null,
        thumbnail: link.video_thumbnail || null,
        url: `https://youtube.com/watch?v=${link.video_id}`,
        placement_name: basePlacementName,
        is_base: true,
        proof_available: link.base_video_proof_available,
        proof_context_type: link.base_video_proof_context_type
      });
      seen.add(link.video_id);
    }

    // Add usage videos
    if (link.link_usages && link.link_usages.length > 0) {
      link.link_usages.forEach((usage: any) => {
        if (usage.youtube_video_id && !seen.has(usage.youtube_video_id)) {
          videos.push({
            video_id: usage.youtube_video_id,
            title: usage.title || usage.title_snapshot || null,
            thumbnail: usage.thumbnail || null,
            url: `https://youtube.com/watch?v=${usage.youtube_video_id}`,
            placement_name: usage.placement_name,
            is_base: false,
            link_usage_id: usage.id,
            proof_available: usage.proof_available,
            proof_context_type: usage.proof_context_type
          });
          seen.add(usage.youtube_video_id);
        }
      });
    }

    return videos;
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition-all duration-200 active:scale-[0.995]">
      {/* Collapsed state: Compact single row */}
      <div className="flex items-center gap-3 p-3">
        {/* Left: Title + secondary line */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {/* Active status dot */}
            {link.is_active && (
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
            )}
            <div className="text-sm font-semibold text-white truncate leading-snug">
              {link.title || link.slug}
            </div>
          </div>
          <div className="flex items-center gap-x-3 text-xs text-gray-400 mt-0.5">
            <span>{link.clicks} click{link.clicks !== 1 ? 's' : ''}</span>
            <span>•</span>
            <span>{getPlacementCountText()}</span>
          </div>
        </div>

        {/* Right: Copy button + expand chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={quickCopy}
            disabled={!canQuickCopy}
            className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title={hasFeature(user, FEATURES.CUSTOM_SUBDOMAIN) ? 'Copy branded link' : 'Copy link'}
          >
            {quickCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors rounded"
            title={expanded ? 'Show less' : 'Show more'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded state: Details + actions */}
      {expanded && (
        <div className="px-3 pb-3 pt-2 border-t border-gray-800/60 space-y-3">
          {/* Branded subdomain link for Pro users */}
          {hasFeature(user, FEATURES.CUSTOM_SUBDOMAIN) ? (
            <div className="flex items-center gap-2 bg-purple-900/20 border border-purple-800/50 rounded-lg p-2.5">
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-medium text-purple-400/80 uppercase tracking-wide mb-0.5">Branded link</span>
                <div className="text-xs font-medium text-purple-300/90 font-mono break-all">
                  {getBrandedUrl(link.slug)}
                </div>
              </div>
              <button
                onClick={copyBrandedToClipboard}
                className="p-1.5 text-purple-400 hover:text-purple-300 transition-colors flex-shrink-0 ml-2"
                title="Copy branded link"
              >
                {brandedCopied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          ) : null}

          {/* Fallback link */}
          <div className="flex items-center gap-2 bg-gray-800/30 rounded-lg p-2.5">
            <span className="text-xs text-gray-400 whitespace-nowrap">Fallback:</span>
            <div className="text-xs text-gray-400 font-mono flex-1 min-w-0 truncate">
              {getPublicUrl(link.slug, link.public_code)}
            </div>
            <button
              onClick={copyToClipboard}
              className="p-1.5 text-gray-400 hover:text-white transition-colors flex-shrink-0"
              title="Copy public link"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Destination URL */}
          <div className="text-xs">
            <span className="text-gray-400">Destination: </span>
            <a
              href={link.original_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-200 transition-colors inline-flex items-center gap-0.5 truncate"
            >
              {link.original_url}
              <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
            </a>
          </div>

          {/* Videos using this link */}
          {getAllVideos().length > 0 && (
            <div className="text-xs">
              <span className="text-gray-400 font-medium">Videos driving traffic to this destination: </span>
              <div className="mt-2 space-y-2">
                {getAllVideos().map((video, index) => (
                  <div
                    key={`${video.video_id}-${index}`}
                    className="flex items-start gap-2 p-2 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors group"
                  >
                    <a
                      href={`https://youtube.com/watch?v=${video.video_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 flex-1 min-w-0"
                    >
                      {video.thumbnail ? (
                        <img
                          src={video.thumbnail}
                          alt={video.title || 'Video'}
                          className="w-20 h-12 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-12 bg-gray-800 rounded flex-shrink-0 flex items-center justify-center">
                          <span className="text-xs text-gray-600">No thumbnail</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {video.title ? (
                          <div className="text-gray-300 text-xs font-medium truncate group-hover:text-blue-300 transition-colors">
                            {video.title}
                          </div>
                        ) : (
                          <div className="text-gray-500 text-xs truncate">
                            youtube.com/watch?v={video.video_id}
                          </div>
                        )}
                        {video.placement_name && (
                          <div className="text-gray-400 text-[10px] mt-0.5">
                            {video.placement_name}
                          </div>
                        )}
                      </div>
                    </a>
                    {onShareProof && video.proof_available ? (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onShareProof({
                            video_id: video.video_id,
                            title: video.title,
                            thumbnail: video.thumbnail,
                            link_id: parseInt(link.id),
                            link_usage_id: video.link_usage_id,
                            clicks: (link.clicks ?? 0),
                            destination_url: link.original_url,
                            base_video_placements: video.is_base ? link.base_video_placements : undefined
                          });
                        }}
                        className="flex-shrink-0 px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-medium rounded transition-colors"
                      >
                        Share Proof
                      </button>
                    ) : onShareProof && !video.proof_available ? (
                      <span className="flex-shrink-0 text-[10px] text-gray-400">
                        Proof unavailable for older tracking
                      </span>
                    ) : null}
                    {video.is_base && onRemoveBaseVideo && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (confirm('Remove the base video from this smart link? The link will remain but will no longer be associated with this video.')) {
                            onRemoveBaseVideo(link.id);
                          }
                        }}
                        className="flex-shrink-0 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-[10px] font-medium rounded transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Copy upgrade message for Free users */}
          {showCopyUpgradeMessage && !userHasProAccess && !hasFeature(user, FEATURES.CUSTOM_SUBDOMAIN) && (
            <div className="text-xs text-purple-400 italic">
              Copied. Upgrade to Pro to use your branded link.
            </div>
          )}

          {/* Branded subdomain upgrade prompt for Free users */}
          {!userHasProAccess && !hasFeature(user, FEATURES.CUSTOM_SUBDOMAIN) && (
            <div className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-3">
              <div className="text-sm text-purple-400 mb-2 font-medium">Branded creator links build more trust.</div>
              <div className="text-sm text-purple-300 font-mono mb-2 break-all">{getBrandedUrl(link.slug)}</div>
              <div className="text-xs text-gray-400 mb-3">Look more professional to viewers and sponsors.</div>
              <button
                onClick={() => navigate('/upgrade')}
                className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Upgrade to Pro
              </button>
            </div>
          )}

          {/* Helper text for Pro users */}
          {hasFeature(user, FEATURES.CUSTOM_SUBDOMAIN) && (
            <div className="text-xs italic">
              {user?.subdomain ? (
                <span className="text-green-500/70">Your branded link is live and ready to use.</span>
              ) : (
                <span className="text-gray-400">Your branded link will be active shortly after setup.</span>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-800/60">
            {/* QR Code button - always visible with purple accent */}
            {onShowQR && (
              <button
                type="button"
                onClick={() => onShowQR(link.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition-all duration-200 active:scale-[0.98] shadow-sm shadow-purple-900/20"
              >
                <QrCode className="w-3.5 h-3.5" />
                QR Code
              </button>
            )}

            {(link.placement_count || 0) === 0 ? (
              <>
                {/* Primary: Add placement - for zero-placement links */}
                <button
                  type="button"
                  onClick={() => onAddPlacement(link.id, getAllVideos())}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all duration-200 active:scale-[0.98] shadow-sm shadow-blue-900/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add placement
                </button>

                {/* Secondary: Manage Link - muted */}
                <button
                  type="button"
                  onClick={() => onViewPlacements(link.id)}
                  className="flex items-center gap-1 px-2 py-1.5 text-gray-400 hover:text-gray-200 text-xs font-medium rounded transition-all duration-200 active:scale-[0.98] hover:bg-gray-800/50"
                >
                  <List className="w-3.5 h-3.5" />
                  Manage Link
                </button>
              </>
            ) : (
              <>
                {/* Primary: Manage Link - for links with placements */}
                <button
                  type="button"
                  onClick={() => onViewPlacements(link.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all duration-200 active:scale-[0.98] shadow-sm shadow-blue-900/20"
                >
                  <List className="w-3.5 h-3.5" />
                  Manage Link
                </button>

                {/* Secondary: Add placement - muted */}
                <button
                  type="button"
                  onClick={() => onAddPlacement(link.id, getAllVideos())}
                  className="flex items-center gap-1 px-2 py-1.5 text-gray-400 hover:text-gray-200 text-xs font-medium rounded transition-all duration-200 active:scale-[0.98] hover:bg-gray-800/50"
                >
                  <Plus className="w-3 h-3" />
                  Add placement
                </button>
              </>
            )}

            {/* Spacer pushes overflow menu right */}
            {!link.is_system && (
              <>
                <span className="flex-1" />
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowOverflowMenu(!showOverflowMenu)}
                    className="text-gray-400 hover:text-gray-200 transition-all duration-200 active:scale-[0.98] p-1.5 rounded hover:bg-gray-800/50"
                    title="More options"
                    aria-label="More options"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>

                  {/* Overflow menu */}
                  {showOverflowMenu && (
                    <>
                      {/* Backdrop - closes menu on tap outside */}
                      <div
                        className="fixed inset-0 z-50"
                        onClick={() => setShowOverflowMenu(false)}
                      />

                      {/* Menu */}
                      <div className="absolute right-0 top-full mt-1 z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl min-w-[160px] overflow-hidden">
                        {/* Edit */}
                        <Link
                          to={`/links/${link.id}/edit`}
                          onClick={() => setShowOverflowMenu(false)}
                          className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </Link>

                        {/* Toggle active/inactive */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowOverflowMenu(false);
                            onToggleStatus(link.id, link.is_active);
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                        >
                          {link.is_active ? (
                            <>
                              <PowerOff className="w-4 h-4" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <Power className="w-4 h-4" />
                              Activate
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
