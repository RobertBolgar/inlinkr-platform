import { useState, useRef, useEffect } from 'react';
import { X, Download, ExternalLink, ArrowUpRight, Share2, Twitter, Link2, MoreVertical, Lock, Play } from 'lucide-react';
import html2canvas from 'html2canvas';
import { getSponsorPlacementLabel } from '../lib/placement-intelligence';
import { generateShareText, generateTwitterShareUrl } from '../lib/share-text';

type VideoProofModalProps = {
  isOpen: boolean;
  onClose: () => void;
  video: {
    video_id: string;
    title: string | null;
    thumbnail: string | null;
    total_clicks: number;
    conversion_rate: number | null;
    views: number | null;
    link_count: number;
    link_id?: number | null;
    link_usage_id?: number | null;
  };
  destinationUrl: string | null;
  attributionAvailable: boolean;
  topSourceLabel: string;
  additionalSourceLabels: string[];
  convertingPlacements: Array<{ source_code: string; click_count: number }>;
  onProofCreated?: () => void;
};

export function VideoProofModal({ isOpen, onClose, video, destinationUrl, attributionAvailable, topSourceLabel, additionalSourceLabels, convertingPlacements, onProofCreated }: VideoProofModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [proofLinkCopied, setProofLinkCopied] = useState(false);
  const [proofLinkError, setProofLinkError] = useState<string | null>(null);
  const [copySuccessMessage, setCopySuccessMessage] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const proofCardRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Detect native share support
  const supportsNativeShare = typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator;

  const handleCopySummary = () => {
    let attributionText = '';
    if (attributionAvailable && topSourceLabel) {
      attributionText = `Attribution:
• Top placement: ${topSourceLabel}`;
      if (additionalSourceLabels.length > 0) {
        attributionText += `\n• Additional placements: ${additionalSourceLabels.join(', ')}`;
      }
    } else {
      attributionText = `Attribution:
Source details unavailable`;
    }

    const text = `Video proof from TubeLinkr

Video:
${video.title || 'Untitled Video'}

Destination:
${destinationUrl || 'Destination not available'}

Results:
• ${video.total_clicks} directly measured clicks
• ${formatCTR(video.conversion_rate)} CTR
• ${video.views !== null ? video.views.toLocaleString() : '—'} views
• ${video.link_count} Smart Link${video.link_count > 1 ? 's' : ''} attached

${attributionText}

Tracked with TubeLinkr`;

    navigator.clipboard.writeText(text);
  };

  const handleDownloadImage = async () => {
    if (!proofCardRef.current) return;

    setDownloading(true);
    setDownloadError(null);

    try {
      const canvas = await html2canvas(proofCardRef.current, {
        backgroundColor: '#111827',
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
      });

      // Convert canvas to PNG Blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setDownloadError('Failed to generate image. Please try again.');
          setDownloading(false);
          return;
        }

        const fileName = `tubelinkr-proof-${video.video_id}.png`;

        // Try native share on mobile
        if (supportsNativeShare) {
          try {
            const file = new File([blob], fileName, { type: 'image/png' });
            
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                title: 'TubeLinkr video proof',
                text: 'Video proof generated with TubeLinkr',
                files: [file],
              });
            } else {
              // Fallback to download if canShare returns false
              fallbackToDownload(canvas, fileName);
            }
          } catch (shareError) {
            // User cancelled share or share failed, fallback to download
            if (shareError instanceof DOMException && shareError.name === 'AbortError') {
              // User cancelled, do nothing
            } else {
              console.error('Share failed, falling back to download:', shareError);
              fallbackToDownload(canvas, fileName);
            }
          }
        } else {
          // Fallback to download on desktop/unsupported browsers
          fallbackToDownload(canvas, fileName);
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error generating proof image:', error);
      setDownloadError('Failed to generate image. Please try again.');
      setDownloading(false);
    }
  };

  const fallbackToDownload = (canvas: HTMLCanvasElement, fileName: string) => {
    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    link.click();
    setDownloading(false);
  };

  const handleCopyProofLink = async () => {
    setProofLinkError(null);

    try {
      // Get Clerk token for authentication
      const clerk = (window as any).Clerk;
      const token = await clerk.session.getToken();

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/proof-shares/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          link_id: video.link_id || null,
          link_usage_id: video.link_usage_id || null,
          youtube_video_id: video.video_id,
          title: video.title,
          destination_url: destinationUrl,
          top_source_label: attributionAvailable ? topSourceLabel : null,
          additional_source_labels: attributionAvailable ? JSON.stringify(additionalSourceLabels) : null,
          // Phase 1: Snapshot fields (additive, backward-compatible)
          snapshot_clicks: video.total_clicks,
          snapshot_ctr: video.conversion_rate,
          snapshot_views: video.views,
          snapshot_link_count: video.link_count,
          snapshot_video_title: video.title,
          snapshot_thumbnail_url: video.thumbnail,
          snapshot_destination_domain: getHostname(destinationUrl),
          snapshot_destination_url: destinationUrl,
          snapshot_top_placement_label: attributionAvailable ? topSourceLabel : null,
          snapshot_converting_placements_json: JSON.stringify(convertingPlacements),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await navigator.clipboard.writeText(data.public_url);
        setShareUrl(data.public_url);
        setProofLinkCopied(true);
        setCopySuccessMessage('✓ Proof link copied');
        setTimeout(() => {
          setProofLinkCopied(false);
          setCopySuccessMessage(null);
        }, 2500);
        onProofCreated?.();
      } else {
        // Handle proof limit error specifically
        if (data.error === 'Active proof limit reached') {
          const limitMsg = data.can_upgrade 
            ? `${data.message} <a href="/upgrade" class="text-blue-400 hover:underline">Upgrade to Pro</a> for 100 active proofs.`
            : data.message;
          setProofLinkError(limitMsg);
        } else {
          setProofLinkError(data.error || 'Failed to create proof link');
        }
      }
    } catch (error) {
      setProofLinkError('Network error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Native share handler for text/URL sharing
  const handleNativeShare = async () => {
    if (!shareUrl) {
      await handleCopyProofLink();
      return;
    }

    if (!supportsNativeShare) return;

    const shareText = generateShareText({
      title: video.title,
      clicks: video.total_clicks,
      converting_placements: convertingPlacements,
      proofUrl: shareUrl,
    });

    try {
      if (navigator.canShare && navigator.canShare({ title: 'TubeLinkr Proof', text: shareText, url: shareUrl })) {
        await navigator.share({
          title: 'TubeLinkr Proof',
          text: shareText,
          url: shareUrl,
        });
      }
    } catch (error) {
      // User cancelled or share failed - silent fallback
      if (error instanceof DOMException && error.name !== 'AbortError') {
        console.error('Share failed:', error);
      }
    }
  };

  // Twitter share handler
  const handleTwitterShare = async () => {
    if (!shareUrl) {
      await handleCopyProofLink();
      return;
    }

    const shareText = generateShareText({
      title: video.title,
      clicks: video.total_clicks,
      converting_placements: convertingPlacements,
      proofUrl: shareUrl,
    });

    const twitterUrl = generateTwitterShareUrl(shareText, shareUrl);
    window.open(twitterUrl, '_blank', 'noopener,noreferrer,width=600,height=400');
  };


  // Copy link handler
  const handleCopyLink = async () => {
    if (!shareUrl) {
      await handleCopyProofLink();
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setProofLinkCopied(true);
      setCopySuccessMessage('✓ Proof link copied');
      setTimeout(() => {
        setProofLinkCopied(false);
        setCopySuccessMessage(null);
      }, 2500);
    } catch (err) {
      setProofLinkError('Unable to copy link');
      setTimeout(() => setProofLinkError(null), 2500);
    }
  };

  const getHostname = (url: string | null) => {
    if (!url) return null;
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  };

  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };

    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMoreMenu]);

  // Derived insight helpers
  const formatPlacementLabel = (sourceCode: string): string => {
    // Convert source code to sponsor-facing label
    // Uses sponsor-friendly language for proof cards
    return getSponsorPlacementLabel(sourceCode);
  };

  const formatCTR = (ctr: number | null): string => {
    if (ctr === null) return '—';
    if (ctr === 0) return '0.0%';
    if (ctr < 0.1) return '<0.1%';
    return `${ctr.toFixed(1)}%`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative w-full sm:max-w-lg bg-gray-900 border border-gray-800/80 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors z-20"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>

        {/* Scrollable Content - Proof Card Only */}
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="p-4 sm:p-5 pt-5 sm:pt-5 text-center mb-0">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-1">Proof this video drove traffic</h2>
            <p className="text-xs text-gray-500">Screenshot-ready performance summary</p>
          </div>

          {/* Proof Card Container for Image Generation */}
          <div
            ref={proofCardRef}
            className="rounded-2xl p-5 mx-4 sm:mx-5 mb-4 border border-gray-600/30 shadow-2xl"
            style={{ 
              background: 'radial-gradient(ellipse at top, #1e3a5f 0%, #0f172a 50%, #020617 100%)',
              boxShadow: '0 0 80px rgba(59, 130, 246, 0.15), 0 0 60px rgba(168, 85, 247, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
            }}
          >
            {/* Card Header */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <img
                  src="/tubelinkr-icon-wht.png"
                  alt="TubeLinkr"
                  className="w-5 h-5 rounded-lg object-contain"
                  crossOrigin="anonymous"
                />
                <span className="text-white font-semibold text-sm">TubeLinkr</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Snapshot date pill */}
                <div className="flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-800/60 text-gray-300 border border-gray-600/40">
                  {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                {/* Green verification pill */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium rounded-full bg-green-500/15 text-green-400 border border-green-500/30">
                  <Lock className="w-3 h-3" />
                  <span>Verified Snapshot</span>
                </div>
              </div>
            </div>

            {/* Hero Headline */}
            <div className="mb-2 text-center">
              <h1 className="text-2xl sm:text-4xl font-bold text-white mb-1 tracking-tight">
                VERIFIED <span style={{ color: '#8b5cf6' }}>TRAFFIC</span> PROOF
              </h1>
              <p className="text-base text-gray-300">
                <span className="font-bold text-white text-lg">{video.total_clicks}</span> Click{video.total_clicks !== 1 ? 's' : ''} Sent to <span className="font-bold text-blue-400">{getHostname(destinationUrl) || 'tracked destination'}</span>
              </p>
            </div>

            {/* Video Section - Premium media card */}
            {video.thumbnail && (
              <div className="mb-3 rounded-xl overflow-hidden border border-gray-600/30 p-3" style={{ background: 'rgba(15, 23, 42, 0.6)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)' }}>
                <div className="flex gap-4 max-w-3xl mx-auto">
                  {/* Thumbnail on left */}
                  <div className="relative flex-shrink-0 w-[50%] sm:w-[45%] max-w-sm">
                    <img
                      src={video.thumbnail}
                      alt={video.title || 'Video'}
                      className="w-full aspect-video object-cover rounded-lg"
                      crossOrigin="anonymous"
                    />
                    {/* Play overlay */}
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border border-white/10">
                        <Play className="w-4 h-4 text-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                  {/* Video info on right */}
                  <div className="flex-1 flex flex-col justify-center min-w-0">
                    <h3 className="text-white font-semibold text-sm sm:text-lg leading-relaxed mb-2">
                      {video.title || 'Untitled Video'}
                    </h3>
                    <div className="flex items-center gap-2">
                      {/* YouTube icon - RED */}
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#FF0000">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                      <span className="text-xs sm:text-sm text-gray-400">YouTube Video</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Premium Metric Card */}
            <div className="mb-3 rounded-xl p-4 border border-blue-500/20" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)', boxShadow: '0 4px 20px rgba(59, 130, 246, 0.15)' }}>
              <div className="flex items-center gap-4">
                {/* Big number on left - dominant focus */}
                <div className="flex-shrink-0 pr-4" style={{ borderRight: '1px solid rgba(59, 130, 246, 0.2)' }}>
                  <div className="text-6xl sm:text-7xl font-bold text-white" style={{ textShadow: '0 0 30px rgba(59, 130, 246, 0.3)' }}>
                    {video.total_clicks}
                  </div>
                  <div className="text-sm font-semibold text-blue-300 uppercase tracking-wide mt-1">
                    TOTAL CLICKS
                  </div>
                </div>
                {/* Supporting metrics on right - secondary */}
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <div className="text-lg font-medium text-gray-300 mb-0.5">
                      {formatCTR(video.conversion_rate)}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                      CTR
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-medium text-gray-300 mb-0.5">
                      {video.views !== null ? video.views.toLocaleString() : '—'}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                      Views
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-medium text-gray-300 mb-0.5">
                      {video.link_count}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                      Link{video.link_count > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* TRAFFIC SOURCES */}
            <div className="mb-3">
              <div className="rounded-xl p-3 border border-purple-500/20" style={{ background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(147, 51, 234, 0.05) 100%)', boxShadow: '0 4px 20px rgba(168, 85, 247, 0.15)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUpRight className="w-4 h-4" style={{ color: '#a78bfa' }} />
                  <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#a78bfa' }}>TRAFFIC SOURCES</p>
                </div>
                {convertingPlacements && convertingPlacements.length > 0 ? (
                  <div className="space-y-1.5">
                    {convertingPlacements.slice(0, 5).map((placement, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span className="text-gray-200 truncate font-medium">
                          {formatPlacementLabel(placement.source_code)}
                        </span>
                        <span className="text-purple-300 text-xs ml-2 font-semibold">
                          {placement.click_count} click{placement.click_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                    {convertingPlacements.length > 5 && (
                      <p className="text-gray-400 text-xs mt-1">
                        +{convertingPlacements.length - 5} more placement{convertingPlacements.length - 5 !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-400 text-xs">
                    Traffic source data not available
                  </p>
                )}
              </div>
            </div>

            {/* TRAFFIC SENT TO - Premium compact card */}
            <div className="mb-3">
              <div className="rounded-xl p-3 border border-blue-500/20" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)', boxShadow: '0 4px 20px rgba(59, 130, 246, 0.15)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <ExternalLink className="w-4 h-4" style={{ color: '#60a5fa' }} />
                  <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#60a5fa' }}>TRAFFIC SENT TO</p>
                </div>
                <p className="text-gray-200 text-sm font-semibold truncate pl-6">
                  {getHostname(destinationUrl) || destinationUrl || 'Destination not available'}
                </p>
              </div>
            </div>

            {/* Verification Footer */}
            <div className="pt-3 mt-3 border-t border-gray-700/50">
              <p className="text-[10px] text-center text-gray-400">
                Snapshot captured on {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              <p className="text-[10px] text-center text-gray-500 mt-1">
                Metrics locked at capture time • Verified by TubeLinkr
              </p>
            </div>
          </div>

          {/* Fixed Action Footer - Outside Scrollable Area */}
          <div className="p-4 sm:p-5 border-t border-gray-800/50 bg-gray-900 flex-shrink-0">
            {/* Primary Action Row */}
            <div className="flex gap-2 mb-3">
              {/* Share Proof (Native) */}
              {supportsNativeShare && (
                <button
                  onClick={handleNativeShare}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm shadow-green-500/20"
                >
                  <Share2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Share Proof</span>
                </button>
              )}
              
              {/* Save Image */}
              <button
                onClick={handleDownloadImage}
                disabled={downloading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Save Image</span>
              </button>
              
              {/* Copy Link */}
              <button
                onClick={handleCopyLink}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 bg-gray-700/80 hover:bg-gray-600/80 text-gray-300 text-sm font-medium rounded-lg transition-colors"
              >
                <Link2 className="w-4 h-4" />
                <span className="hidden sm:inline">{proofLinkCopied ? 'Copied!' : 'Copy Link'}</span>
              </button>
              
              {/* More Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 sm:py-3 bg-gray-700/80 hover:bg-gray-600/80 text-gray-300 text-sm font-medium rounded-lg transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                
                {/* Dropdown Menu */}
                {showMoreMenu && (
                  <div
                    ref={moreMenuRef}
                    className="absolute bottom-full right-0 mb-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-20"
                  >
                    {/* Share to X */}
                    <button
                      onClick={() => {
                        handleTwitterShare();
                        setShowMoreMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                      <Twitter className="w-4 h-4" />
                      Share to X
                    </button>
                    
                    {/* Copy Summary */}
                    <button
                      onClick={() => {
                        handleCopySummary();
                        setShowMoreMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-700 transition-colors border-t border-gray-700"
                    >
                      <Link2 className="w-4 h-4" />
                      Copy Summary
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Error Messages */}
            {downloadError && (
              <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-xs text-red-400 text-center">{downloadError}</p>
              </div>
            )}

            {proofLinkError && (
              <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p 
                  className="text-xs text-red-400 text-center"
                  dangerouslySetInnerHTML={{ __html: proofLinkError }}
                />
              </div>
            )}

            {copySuccessMessage && (
              <div className="p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-xs text-green-400 text-center">{copySuccessMessage}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
