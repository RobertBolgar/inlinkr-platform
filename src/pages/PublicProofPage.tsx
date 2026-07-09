import { useState, useEffect, useRef } from 'react';
import { Toast } from '../components/ui';
import { useParams, useNavigate } from 'react-router-dom';
import { ExternalLink, ArrowUpRight, Share2, Twitter, Link2, MoreVertical, Download, Lock, Play } from 'lucide-react';
import { getSponsorPlacementLabel } from '../lib/placement-intelligence';
import { generateShareText, generateTwitterShareUrl } from '../lib/share-text';
import { generateProofOGMetadata, updateDocumentMetaTags, resetDocumentMetaTags } from '../lib/og-metadata';

export function PublicProofPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [proof, setProof] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; variant: 'success' | 'error'; message: string }>({ visible: false, variant: 'success', message: '' });

  const showToast = (variant: 'success' | 'error', message: string) => {
    setToast({ visible: true, variant, message });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 2500);
  };
  const [downloading, setDownloading] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const proofCardRef = useRef<HTMLDivElement>(null);

  // Detect native share support
  const supportsNativeShare = typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator;

  const currentUrl = window.location.href;

  useEffect(() => {
    const fetchProof = async () => {
      if (!token) {
        setError('Invalid proof link');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/proof-shares/${token}`);
        const data = await response.json();

        if (response.ok) {
          setProof(data.proof);
          
          // Update OG metadata for social sharing
          const proofUrl = window.location.href;
          const ogMetadata = generateProofOGMetadata(data.proof, proofUrl);
          updateDocumentMetaTags(ogMetadata);
        } else {
          setError(data.error || 'Proof not found');
        }
      } catch (err) {
        setError('Failed to load proof');
      } finally {
        setLoading(false);
      }
    };

    fetchProof();

    // Cleanup: reset meta tags when leaving the page
    return () => {
      resetDocumentMetaTags();
    };
  }, [token]);

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

  // Native share handler
  const handleNativeShare = async () => {
    if (!supportsNativeShare || !proof) return;

    const shareText = generateShareText({
      title: proof.title,
      clicks: proof.clicks,
      converting_placements: proof.converting_placements,
      proofUrl: currentUrl,
    });

    try {
      if (navigator.canShare && navigator.canShare({ title: 'TubeLinkr Proof', text: shareText, url: currentUrl })) {
        await navigator.share({
          title: 'TubeLinkr Proof',
          text: shareText,
          url: currentUrl,
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
  const handleTwitterShare = () => {
    if (!proof) return;

    const shareText = generateShareText({
      title: proof.title,
      clicks: proof.clicks,
      converting_placements: proof.converting_placements,
      proofUrl: currentUrl,
    });

    const twitterUrl = generateTwitterShareUrl(shareText, currentUrl);
    window.open(twitterUrl, '_blank', 'noopener,noreferrer,width=600,height=400');
  };

  // Copy link handler
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setCopyError(null);
      showToast('success', 'Proof link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
      setCopyError('Unable to copy link');
      showToast('error', 'Unable to copy link');
      setTimeout(() => setCopyError(null), 2000);
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

  // Download image handler
  const handleDownloadImage = async () => {
    if (!proofCardRef.current) return;

    setDownloading(true);

    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(proofCardRef.current, {
        backgroundColor: '#111827',
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
      });

      canvas.toBlob((blob) => {
        if (!blob) return;
        const fileName = `tubelinkr-proof-${token}.png`;
        const link = document.createElement('a');
        link.download = fileName;
        link.href = canvas.toDataURL('image/png');
        link.click();
        setDownloading(false);
      }, 'image/png');
    } catch (error) {
      console.error('Error generating proof image:', error);
      setDownloading(false);
    }
  };

  // Copy summary handler
  const handleCopySummary = () => {
    const shareText = generateShareText({
      title: proof.title,
      clicks: proof.clicks,
      converting_placements: proof.converting_placements,
      proofUrl: currentUrl,
    });
    navigator.clipboard.writeText(shareText);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-white">Loading proof...</div>
      </div>
    );
  }

  if (error || !proof) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Proof not found'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Go to TubeLinkr
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <Toast visible={toast.visible} variant={toast.variant} message={toast.message} />
      <div className="max-w-4xl mx-auto">

        {/* Proof Card Container for Image Generation */}
        <div
          ref={proofCardRef}
          className="rounded-2xl p-5 mb-5 border border-gray-600/30 shadow-2xl"
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
              {proof.proof_mode === 'snapshot' && proof.snapshot_generated_at && (
                <div className="flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-800/60 text-gray-300 border border-gray-600/40">
                  {new Date(proof.snapshot_generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              )}
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
              <span className="font-bold text-white text-lg">{proof.clicks}</span> Click{proof.clicks !== 1 ? 's' : ''} Sent to <span className="font-bold text-blue-400">{proof.destination_domain || 'tracked destination'}</span>
            </p>
          </div>

          {/* Video Section - Premium media card */}
          {proof.thumbnail && (
            <div className="mb-3 rounded-xl overflow-hidden border border-gray-600/30 p-3" style={{ background: 'rgba(15, 23, 42, 0.6)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)' }}>
              <div className="flex gap-4 max-w-3xl mx-auto">
                {/* Thumbnail on left */}
                <div className="relative flex-shrink-0 w-[50%] sm:w-[45%] max-w-sm">
                  <img
                    src={proof.thumbnail}
                    alt={proof.title || 'Video'}
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
                    {proof.title || 'Untitled Video'}
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
                  {proof.clicks}
                </div>
                <div className="text-sm font-semibold text-blue-300 uppercase tracking-wide mt-1">
                  TOTAL CLICKS
                </div>
              </div>
              {/* Supporting metrics on right - secondary */}
              <div className="flex-1 grid grid-cols-3 gap-2">
                <div className="text-center">
                  <div className="text-lg font-medium text-gray-300 mb-0.5">
                    {formatCTR(proof.ctr)}
                  </div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide">
                    CTR
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-medium text-gray-300 mb-0.5">
                    {proof.views !== null ? proof.views.toLocaleString() : '—'}
                  </div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide">
                    Views
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-medium text-gray-300 mb-0.5">
                    {proof.link_count}
                  </div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide">
                    Link{proof.link_count > 1 ? 's' : ''}
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
              {proof.converting_placements && proof.converting_placements.length > 0 ? (
                <div className="space-y-1.5">
                  {proof.converting_placements.slice(0, 5).map((placement: { source_code: string; click_count: number }, index: number) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-gray-200 truncate font-medium">
                        {formatPlacementLabel(placement.source_code)}
                      </span>
                      <span className="text-purple-300 text-xs ml-2 font-semibold">
                        {placement.click_count} click{placement.click_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                  {proof.converting_placements.length > 5 && (
                    <p className="text-gray-400 text-xs mt-1">
                      +{proof.converting_placements.length - 5} more placement{proof.converting_placements.length - 5 !== 1 ? 's' : ''}
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
                {proof.destination_domain || 'Tracked destination'}
              </p>
            </div>
          </div>

          {/* Verification Footer */}
          <div className="pt-3 mt-3 border-t border-gray-700/50">
            <p className="text-[10px] text-center text-gray-400">
              Snapshot captured on {proof.proof_mode === 'snapshot' && proof.snapshot_generated_at ? new Date(proof.snapshot_generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Live'}
            </p>
            <p className="text-[10px] text-center text-gray-400 mt-1">
              Metrics locked at capture time • Verified by TubeLinkr
            </p>
          </div>
        </div>

        {/* Primary Action Row */}
        <div className="flex gap-2 justify-center mt-6">
            {/* Share Proof (Native) */}
            {supportsNativeShare && (
              <button
                onClick={handleNativeShare}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors max-w-[140px]"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Share</span>
              </button>
            )}
            
            {/* Save Image */}
            <button
              onClick={handleDownloadImage}
              disabled={downloading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed max-w-[140px]"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Save</span>
            </button>
            
            {/* Copy Link */}
            <button
              onClick={handleCopyLink}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors max-w-[140px]"
            >
              <Link2 className="w-4 h-4" />
              <span className="hidden sm:inline">{copied ? 'Proof link copied' : copyError ? 'Unable to copy link' : 'Copy'}</span>
            </button>
            
            {/* More Menu */}
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
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

        {/* Bottom CTA - Lightweight */}
        <div className="text-center mt-6 pb-8">
          <p className="text-gray-500 text-sm">
            Track what drives your clicks. <a href="/" className="text-blue-400 hover:text-blue-300 transition-colors">Start free at TubeLinkr.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
