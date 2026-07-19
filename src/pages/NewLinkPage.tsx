import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/cloudflare';
import { cleanAutoTitle } from '../lib/utils';
import { Layout } from '../components';
import { hasProAccess } from '../lib/plan';
import { getAllPlacementKinds, getPlacementLabel } from '../lib/placement-intelligence';
import { PlacementBehaviorHint } from '../components/placements/PlacementBehaviorHint';
import { AlignLeft, MessageSquareDot, User as UserIcon, Zap, Video, MoreHorizontal, Wand2, ChevronDown, Copy, Check, ExternalLink } from 'lucide-react';

export function NewLinkPage() {
  const { user } = useAuth();
  const userHasProAccess = useMemo(() => hasProAccess(user), [user]);
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'create' | 'attach'>('create');
  const [originalUrl, setOriginalUrl] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [slugError, setSlugError] = useState('');
  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [debouncedSlug, setDebouncedSlug] = useState('');
  const [createdLink, setCreatedLink] = useState<{ id: string; slug: string; public_code?: string; placement_public_code?: string; createdPlacements?: Array<{ public_code: string; source_code: string; name: string; type: string }> } | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [copiedPlacementKey, setCopiedPlacementKey] = useState<string | null>(null);
  const [selectedPlacements, setSelectedPlacements] = useState<string[]>([]);
  const [lastSelectedPlacement, setLastSelectedPlacement] = useState<string | null>(null);
  const [customPlacement, setCustomPlacement] = useState('');
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [youtubeVideos, setYoutubeVideos] = useState<any[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [youtubeVideosLoading, setYoutubeVideosLoading] = useState(false);
  const [youtubeVideosError, setYoutubeVideosError] = useState<string | null>(null);
  const [videoDropdownOpen, setVideoDropdownOpen] = useState(false);
  const [userLinks, setUserLinks] = useState<any[]>([]);
  const [selectedExistingLinkId, setSelectedExistingLinkId] = useState<string>('');
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [metadataSuccess, setMetadataSuccess] = useState(false);

  const placementOptions = getAllPlacementKinds()
    .filter(kind => kind !== 'direct' && kind !== 'video')
    .map(kind => ({
      value: kind,
      label: getPlacementLabel(kind),
    }));

  const togglePlacement = (value: string) => {
    setSelectedPlacements((prev) => {
      if (prev.includes(value)) {
        return prev.filter((v) => v !== value);
      } else {
        setLastSelectedPlacement(value);
        return [...prev, value];
      }
    });
  };

  const copyLinkToClipboard = async () => {
    if (!createdLink || !user) return;

    // In attach mode, copy the placement tracking URL
    // In create mode, copy the branded link for Pro/Founder, otherwise smart short link
    let linkUrl: string;
    if (mode === 'attach' && createdLink.placement_public_code) {
      // Attach mode: placement tracking URL
      linkUrl = createdLink?.public_code
        ? `https://go-dev.inlinkr.com/${createdLink?.public_code}/${createdLink.placement_public_code}`
        : `https://go-dev.inlinkr.com/${user?.username}/${createdLink?.slug}/${createdLink.placement_public_code}`;
    } else {
      // Create mode: branded link for Pro/Founder, smart short link for Free
      if (userHasProAccess) {
        linkUrl = `https://${user?.subdomain || user?.username}.tubelinkr.com/${createdLink?.slug}`;
      } else {
        linkUrl = createdLink?.public_code
          ? `https://go-dev.inlinkr.com/${createdLink?.public_code}`
          : `https://go-dev.inlinkr.com/${user?.username}/${createdLink?.slug}`;
      }
    }

    try {
      await navigator.clipboard.writeText(linkUrl);
      setCopiedPlacementKey('main');
      setTimeout(() => setCopiedPlacementKey(null), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const resetForm = () => {
    setMode('create');
    setOriginalUrl('');
    setTitle('');
    setSubtitle('');
    setSlug('');
    setError('');
    setSlugError('');
    setSlugSuggestions([]);
    setSelectedPlacements([]);
    setCustomPlacement('');
    setSelectedVideoId('');
    setSelectedExistingLinkId('');
    setMetadataError(null);
    setMetadataSuccess(false);
    setShowSuccess(false);
    setCopiedPlacementKey(null);
  };

  const sanitizeSlugForTyping = (value: string): string => {
    // For onChange: allow trailing dash while typing
    // Test: "Test link" → "test-link"
    // Test: "Testing main" → "testing-main"
    // Test: "My Awesome Link" → "my-awesome-link"
    // Test: "example-" → "example-" (keeps trailing dash)
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
      .slice(0, 50);
  };

  const sanitizeSlugForSave = (value: string): string => {
    // For submit/save: remove leading/trailing dashes
    return sanitizeSlugForTyping(value)
      .replace(/^-|-$/g, '');
  };

  const generateSlugFromTitle = (titleText: string): string => {
    return sanitizeSlugForSave(titleText);
  };

  
  const validateSlug = (value: string): { valid: boolean; error: string } => {
    if (!value) {
      return { valid: true, error: '' };
    }
    if (value.length < 3) {
      return { valid: false, error: 'Too short (min 3 characters)' };
    }
    if (value.length > 50) {
      return { valid: false, error: 'Too long (max 50 characters)' };
    }
    if (!/^[a-z0-9-]+$/.test(value)) {
      return { valid: false, error: 'Invalid characters (use a-z, 0-9, hyphens only)' };
    }
    if (/^-/.test(value) || /-$/.test(value)) {
      return { valid: false, error: 'Cannot start or end with hyphen' };
    }
    return { valid: true, error: '' };
  };

  const generateSlugSuggestions = (baseSlug: string): string[] => {
    const suggestions = [
      `${baseSlug}-1`,
      `${baseSlug}-deal`,
      `${baseSlug}-yt`,
      `${baseSlug}-link`,
      `${baseSlug}-2026`
    ];
    return suggestions.slice(0, 3);
  };

  const checkSlugAvailability = async (value: string) => {
    if (!value || !user) {
      setSlugSuggestions([]);
      return;
    }
    
    const validation = validateSlug(value);
    if (!validation.valid) {
      setSlugError(validation.error);
      setSlugSuggestions([]);
      return;
    }
    
    setSlugError('');
    
    try {
      const existingLinks = await db.getLinksByUserId(user.id);
      const existingLink = existingLinks.find((l: any) => l.slug === value);
      
      if (existingLink) {
        setSlugError('Slug already exists');
        setSlugSuggestions(generateSlugSuggestions(value));
      } else {
        setSlugSuggestions([]);
      }
    } catch (err) {
      console.error('Error checking slug availability:', err);
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeSlugForTyping(e.target.value);
    setSlug(sanitized);
    
    // Only mark as manually edited if the user actually typed something
    // If they cleared the field, allow auto-generation to resume
    if (sanitized) {
      setIsSlugManuallyEdited(true);
    } else {
      setIsSlugManuallyEdited(false);
    }
    
    const validation = validateSlug(sanitized);
    if (!validation.valid) {
      setSlugError(validation.error);
    } else {
      setSlugError('');
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    
    if (newTitle && !isSlugManuallyEdited) {
      const generatedSlug = generateSlugFromTitle(newTitle);
      setSlug(generatedSlug);
    }
  };

  const selectSlugSuggestion = (suggestion: string) => {
    setSlug(suggestion);
    setSlugError('');
    setSlugSuggestions([]);
  };

  const fetchLinkMetadata = async () => {
    if (!originalUrl) {
      setMetadataError('Please enter a destination URL first');
      return;
    }

    setFetchingMetadata(true);
    setMetadataError(null);
    setMetadataSuccess(false);

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

      const response = await fetch('/api/fetch-link-metadata', {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: originalUrl }),
      });

      const data = await response.json();

      // Handle success === false responses (friendly blocked messages)
      if (data.success === false) {
        setMetadataError(data.error || 'Could not fetch link details. You can still enter them manually.');
        setTimeout(() => setMetadataError(null), 5000); // Hide error message after 5 seconds
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch metadata');
      }

      // Only populate fields if they're empty or auto-generated
      if (!title && data.title) {
        const cleanedTitle = cleanAutoTitle(data.title);
        setTitle(cleanedTitle);
        // Update slug if it hasn't been manually edited
        if (!isSlugManuallyEdited) {
          const generatedSlug = generateSlugFromTitle(cleanedTitle);
          setSlug(generatedSlug);
        }
      }

      if (!subtitle && data.description) {
        setSubtitle(data.description);
      }

      if (!slug && data.slug && !isSlugManuallyEdited) {
        setSlug(data.slug);
      }

      setMetadataSuccess(true);
      setTimeout(() => setMetadataSuccess(false), 5000); // Hide success message after 5 seconds

    } catch (error) {
      console.error('Error fetching metadata:', error);
      setMetadataError(error instanceof Error ? error.message : 'Could not fetch link details. You can still enter them manually.');
      setTimeout(() => setMetadataError(null), 5000); // Hide error message after 5 seconds
    } finally {
      setFetchingMetadata(false);
    }
  };

  const createPlacementsForLink = async (linkId: string) => {
    if (selectedPlacements.length === 0) {
      return [];
    }

    try {
      const placementPromises = selectedPlacements.map(async (placement) => {
        let placementName = placementOptions.find((p) => p.value === placement)?.label || placement;
        let placementType = placement;

        if (placement === 'other' && customPlacement.trim()) {
          placementName = customPlacement.trim();
        }

        // For custom placements, let the backend generate the short source_code (c1, c2, c3...)
        // For standard placements, let the backend use fixed codes (d, p, b, v)
        const data = await db.createPlacement({
          link_id: parseInt(linkId),
          name: placementName,
          type: placementType,
          // source_code is optional - backend will generate it
        });
        
        if (!data.success) {
          console.error('Failed to create placement:', placement, 'Error:', data.error);
          return null;
        }
        
        return data;
      });

      const results = await Promise.all(placementPromises);
      return results.filter((r): r is NonNullable<typeof r> => r !== null && r.data);
    } catch (error) {
      console.error('Error creating placements:', error);
      return [];
    }
  };

  // Debounced slug availability check
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSlug(slug);
    }, 500);

    return () => clearTimeout(timer);
  }, [slug]);

  useEffect(() => {
    if (debouncedSlug && !isSlugManuallyEdited) {
      checkSlugAvailability(debouncedSlug);
    }
  }, [debouncedSlug, isSlugManuallyEdited]);

  // Reset form when navigating to /links/new (e.g., clicking "New Smart Link" from success screen)
  useEffect(() => {
    resetForm();
  }, [location.key]);

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
    const fetchYouTubeVideos = async () => {
      if (!user || !youtubeConnected) return;

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
  }, [user, youtubeConnected]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (videoDropdownOpen) {
        const target = event.target as HTMLElement;
        if (!target.closest('.video-dropdown-container')) {
          setVideoDropdownOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [videoDropdownOpen]);

  // Fetch user links for limit checking
  useEffect(() => {
    const fetchUserLinks = async () => {
      if (!user) return;
      
      try {
        const links = await db.getLinksByUserId(user.id);
        setUserLinks(links || []);
      } catch (err) {
        console.error('Error fetching user links:', err);
      }
    };

    fetchUserLinks();
  }, [user]);

  // Filter out system links and invite links for limit checking (only active links count toward cap)
  const nonSystemLinks = useMemo(() => 
    userLinks.filter((l: any) => !l.is_system && l.slug !== 'invite' && l.slug !== 'my-invite' && l.is_active !== false && l.is_active !== 0),
    [userLinks]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'attach') {
      // Attach existing destination flow
      if (!selectedExistingLinkId) {
        setError('Please select an existing destination link');
        return;
      }

      // Parse and validate link ID
      const selectedLinkIdNumber = Number(selectedExistingLinkId);
      if (Number.isNaN(selectedLinkIdNumber) || selectedLinkIdNumber <= 0) {
        setError('Please choose a valid existing destination link');
        return;
      }

      setLoading(true);

      try {
        if (!user) {
          setError('User not authenticated');
          return;
        }

        const selectedLink = userLinks.find((l: any) => Number(l.id) === selectedLinkIdNumber);
        if (!selectedLink) {
          setError('Selected link not found');
          return;
        }

        // Require placement selection for attach mode
        if (selectedPlacements.length === 0) {
          setError('Choose a placement so TubeLinkr can create a unique Smart Link for this video.');
          return;
        }

        // Create placement for the existing link
        let createdPlacementPublicCode: string | undefined;
        let createdPlacementSourceCode: string | undefined;
        let createdPlacementName: string | undefined;
        let createdPlacementType: string | undefined;

        const placementType = selectedPlacements[0];
        let placementName = placementOptions.find((p) => p.value === placementType)?.label || placementType;

        if (placementType === 'other' && customPlacement.trim()) {
          placementName = customPlacement.trim();
        }

        // Create placement for the existing link with youtube_video_id for video context association
        const placementResult = await db.createPlacement({
          link_id: selectedLinkIdNumber,
          name: placementName,
          type: placementType,
          youtube_video_id: selectedVideoId || undefined,
        });

        if (placementResult && placementResult.success && placementResult.data) {
          createdPlacementPublicCode = placementResult.data.public_code;
          createdPlacementSourceCode = placementResult.data.source_code;
          createdPlacementName = placementName;
          createdPlacementType = placementType;
        } else {
          throw new Error(placementResult?.error || 'Failed to create placement');
        }

        // Create link_usage with placement info
        await db.createLinkUsage({
          link_id: selectedLinkIdNumber,
          youtube_video_id: selectedVideoId || undefined,
          placement_type: createdPlacementType,
          placement_name: createdPlacementName,
          public_code: createdPlacementPublicCode,
          source_code: createdPlacementSourceCode,
        });

        // Show success with the placement tracking URL (not base link)
        // createdPlacementPublicCode is the placement suffix (p/d/b/d2/c1/etc)
        setCreatedLink({ id: selectedLink.id, slug: selectedLink.slug, public_code: selectedLink.public_code, placement_public_code: createdPlacementPublicCode });
        setShowSuccess(true);
      } catch (error: any) {
        setError(error.message || 'Failed to attach destination to video');
      } finally {
        setLoading(false);
      }
    } else {
      // Normal create link flow
      if (!originalUrl) {
        setError('Original URL is required');
        return;
      }

      try {
        new URL(originalUrl);
      } catch {
        setError('Please enter a valid URL');
        return;
      }

      let finalSlug = slug;
      if (!finalSlug && title) {
        finalSlug = generateSlugFromTitle(title);
      }

      // Sanitize for save (remove leading/trailing dashes)
      finalSlug = sanitizeSlugForSave(finalSlug);

      if (!finalSlug) {
        setError('Please provide a title or custom slug');
        return;
      }

      const validation = validateSlug(finalSlug);
      if (!validation.valid) {
        setError(validation.error);
        return;
      }

      // Check link limit for Free users (exclude system links and invite links)
      if (!userHasProAccess && nonSystemLinks.length >= 5) {
        setError("Ready for more? Upgrade to Pro for unlimited links and deeper traffic insights.");
        return;
      }

      setLoading(true);

      try {
        if (!user) {
          setError('User not authenticated');
          return;
        }

        // For Pro/Founder users: check slug uniqueness before submission
        // For Free users: backend auto-generates internal slug, no need to check
        if (userHasProAccess) {
          const existingLinks = await db.getLinksByUserId(user.id);
          const existingLink = existingLinks.find((l: any) => l.slug === finalSlug);

          if (existingLink) {
            setError('A link with this slug already exists');
            setLoading(false);
            return;
          }
        }

        const newLink = await db.createLink({
          slug: finalSlug,
          original_url: originalUrl,
          title: title || undefined,
          subtitle: subtitle || null,
          video_id: selectedVideoId || null,
        });

        // Extract the actual link data from the API response
        const linkData = newLink.data || newLink;
        const linkId = linkData.id;

        // Defensive guard: ensure linkId exists before creating placements
        if (!linkId) {
          setError('Link could not be created. Please try a different slug or title.');
          setLoading(false);
          return;
        }

        // Create placements for selected options
        const createdPlacements = await createPlacementsForLink(linkId);

        // Set createdLink with public_code from API response for smart short URL display
        setCreatedLink({ 
          id: linkId, 
          slug: finalSlug, 
          public_code: linkData.public_code,
          createdPlacements: createdPlacements.map(p => p.data)
        });
        setShowSuccess(true);
      } catch (error: any) {
        // Handle 409 (duplicate slug) specifically
        if (error.message && error.message.includes('already in use')) {
          setError('That link slug already exists. Please choose a different one.');
        } else {
          setError(error.message || 'Failed to create link');
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const placementIcons: Record<string, React.ReactNode> = {
    description: <AlignLeft className="w-3.5 h-3.5" />,
    pinned: <MessageSquareDot className="w-3.5 h-3.5" />,
    bio: <UserIcon className="w-3.5 h-3.5" />,
    short: <Zap className="w-3.5 h-3.5" />,
    video: <Video className="w-3.5 h-3.5" />,
    other: <MoreHorizontal className="w-3.5 h-3.5" />,
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6 sm:px-6 lg:px-8 overflow-x-hidden space-y-3">

        {showSuccess ? (
          /* ── SUCCESS STATE ── */
          <div className="space-y-4">
            <div className="text-center pt-1">
              <div className="text-4xl mb-2">🚀</div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                {mode === 'attach' ? 'Destination attached' : 'Your Smart Link is ready'}
              </h1>
              <p className="text-gray-500 text-sm">
                {mode === 'attach' ? 'Destination attached. Use this new Smart Link for this placement.' : (userHasProAccess ? 'Your branded Smart Link is ready.' : 'Start sharing it anywhere you create content')}
              </p>
            </div>

            {/* Placement links (prioritized when placements were selected) */}
            {mode === 'create' && createdLink?.createdPlacements && createdLink.createdPlacements.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-2">
                  {createdLink.createdPlacements.length === 1 ? 'Your placement link' : 'Your placement links'}
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  Use the placement link where you selected it so TubeLinkr can attribute the click correctly.
                </p>
                {createdLink.createdPlacements.map((placement, index) => {
                  const placementUrl = createdLink?.public_code
                    ? `https://go-dev.inlinkr.com/${createdLink?.public_code}/${placement.public_code}`
                    : `https://go-dev.inlinkr.com/${user?.username}/${createdLink?.slug}/${placement.public_code}`;
                  return (
                    <div key={placement.public_code} className={index > 0 ? 'mt-2' : ''}>
                      <div className="font-mono text-sm text-blue-400 break-all bg-gray-950 border border-blue-900/50 rounded-lg px-3 py-2 select-all mb-2">
                        {placementUrl}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(placementUrl);
                              setCopiedPlacementKey(placement.public_code);
                              setTimeout(() => setCopiedPlacementKey(null), 2000);
                            } catch (err) {
                              console.error('Failed to copy link:', err);
                            }
                          }}
                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {copiedPlacementKey === placement.public_code ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy {placement.name} link</>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Main Smart Link (shown as secondary when placements exist, primary when none) */}
            <div className={`bg-gray-900 border border-gray-800 rounded-xl p-4 ${mode === 'create' && createdLink?.createdPlacements && createdLink.createdPlacements.length > 0 ? 'border-gray-700' : ''}`}>
              <div className="text-xs text-gray-500 mb-2">
                {mode === 'create' && createdLink?.createdPlacements && createdLink.createdPlacements.length > 0
                  ? 'Main Smart Link'
                  : (userHasProAccess ? 'Your branded Smart Link' : 'Your Smart Link')
                }
              </div>
              <div className="font-mono text-sm text-blue-400 break-all bg-gray-950 border border-blue-900/50 rounded-lg px-3 py-2 select-all mb-3">
                {mode === 'attach' && createdLink?.placement_public_code ? (
                  // Attach mode: placement tracking URL
                  createdLink?.public_code
                    ? `https://go-dev.inlinkr.com/${createdLink?.public_code}/${createdLink.placement_public_code}`
                    : `https://go-dev.inlinkr.com/${user?.username}/${createdLink?.slug}/${createdLink.placement_public_code}`
                ) : (
                  // Create mode: branded link for Pro/Founder, smart short link for Free
                  userHasProAccess
                    ? `https://${user?.subdomain || user?.username}.tubelinkr.com/${createdLink?.slug}`
                    : (createdLink?.public_code
                        ? `https://go-dev.inlinkr.com/${createdLink?.public_code}`
                        : `https://go-dev.inlinkr.com/${user?.username}/${createdLink?.slug}`)
                )}
              </div>
              {(!createdLink?.createdPlacements || createdLink.createdPlacements.length === 0) && (
                <button
                  onClick={copyLinkToClipboard}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {copiedPlacementKey === 'main' ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy link</>}
                </button>
              )}
            </div>

            {userHasProAccess && mode === 'create' && (
              <p className="text-xs text-gray-500 text-center">
                Share your branded link across YouTube, TikTok, and Instagram.
              </p>
            )}

            {!userHasProAccess && (
              <p className="text-xs text-gray-500 text-center">
                {mode === 'attach'
                  ? 'Paste into your YouTube description, pinned comment, or bio to track clicks from this video. You can reuse this link on other videos too.'
                  : 'Paste into your YouTube description, pinned comment, or bio to start tracking clicks. This link can be reused across multiple videos.'
                }
              </p>
            )}

            <div className="space-y-2">
              <button
                onClick={() => window.open("https://studio.youtube.com", "_blank")}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open YouTube Studio
              </button>
              <button
                onClick={() => {
                  // In attach mode, open the placement tracking URL
                  // In create mode, open branded link for Pro/Founder, smart short link for Free
                  let linkUrl: string;
                  if (mode === 'attach' && createdLink?.placement_public_code) {
                    // Attach mode: placement tracking URL
                    linkUrl = createdLink?.public_code
                      ? `https://go-dev.inlinkr.com/${createdLink?.public_code}/${createdLink.placement_public_code}`
                      : `https://go-dev.inlinkr.com/${user?.username}/${createdLink?.slug}/${createdLink.placement_public_code}`;
                  } else {
                    // Create mode: branded link for Pro/Founder, smart short link for Free
                    if (userHasProAccess) {
                      linkUrl = `https://${user?.subdomain || user?.username}.tubelinkr.com/${createdLink?.slug}`;
                    } else {
                      linkUrl = createdLink?.public_code
                        ? `https://go-dev.inlinkr.com/${createdLink?.public_code}`
                        : `https://go-dev.inlinkr.com/${user?.username}/${createdLink?.slug}`;
                    }
                  }
                  window.open(linkUrl, "_blank");
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open your link
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={resetForm}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {mode === 'attach' ? 'Attach another' : 'Create another Smart Link'}
              </button>
              {createdLink && (
                <button
                  onClick={() => navigate(`/links/${createdLink.id}/placements`)}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Add placement
                </button>
              )}
            </div>
          </div>

        ) : (
          /* ── CREATE FORM ── */
          <>
            {/* Header */}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Create Smart Link</h1>
              <p className="text-gray-500 mt-0.5 text-sm">Create a reusable Smart Link for your destination</p>
            </div>

            {/* Mode Toggle */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-1.5 flex gap-1">
              <button
                type="button"
                onClick={() => setMode('create')}
                className={`flex-1 py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  mode === 'create'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
              >
                Create New Smart Link
              </button>
              <button
                type="button"
                onClick={() => setMode('attach')}
                className={`flex-1 py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  mode === 'attach'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
              >
                Attach Existing Destination
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* ── SECTION: Select Existing Link (attach mode only) ── */}
              {mode === 'attach' && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <label htmlFor="existingLink" className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Select Destination Link <span className="text-blue-500">*</span>
                  </label>
                  <select
                    id="existingLink"
                    value={selectedExistingLinkId}
                    onChange={(e) => setSelectedExistingLinkId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-950 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-600 transition-all text-sm"
                    required
                  >
                    <option value="">Choose a link...</option>
                    {userLinks
                      .filter((l: any) => l.is_active !== false && l.is_active !== 0 && !l.is_system)
                      .map((link: any) => (
                        <option key={link.id} value={link.id}>
                          {link.title || link.slug} - {link.original_url}
                        </option>
                      ))}
                  </select>
                  {userLinks.filter((l: any) => l.is_active !== false && l.is_active !== 0 && !l.is_system).length === 0 && (
                    <p className="mt-2 text-xs text-gray-500">No active Smart Links found. Create a new Smart Link first.</p>
                  )}
                </div>
              )}

              {/* ── SECTION: Destination URL (create mode only) ── */}
              {mode === 'create' && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4">
                  <label htmlFor="originalUrl" className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Destination URL <span className="text-blue-500">*</span>
                  </label>
                  <input
                    type="url"
                    id="originalUrl"
                    value={originalUrl}
                    onChange={(e) => setOriginalUrl(e.target.value)}
                    placeholder="https://example.com/your-content"
                    className="w-full px-4 py-2.5 bg-gray-950 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-600 transition-all text-sm"
                    required
                  />
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={fetchLinkMetadata}
                      disabled={!originalUrl || fetchingMetadata}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 text-xs font-medium rounded-lg transition-colors border border-gray-700"
                    >
                      {fetchingMetadata ? (
                        <>
                          <div className="w-3 h-3 border-2 border-gray-500 border-t-blue-400 rounded-full animate-spin" />
                          Fetching...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-3 h-3" />
                          Auto-fill details
                        </>
                      )}
                    </button>
                    {metadataSuccess && (
                      <span className="text-xs text-green-500 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Details found
                      </span>
                    )}
                  </div>
                  {metadataError && (
                    <div className="mt-2 px-3 py-2 bg-red-900/20 border border-red-800/50 rounded-lg">
                      <p className="text-xs text-red-400">{metadataError}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── SECTION: Link Details (create mode only) ── */}
              {mode === 'create' && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4 space-y-3">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Smart Link Details</div>

                  {/* Title */}
                  <div>
                    <label htmlFor="title" className="block text-xs text-gray-500 mb-1.5">
                      Title <span className="text-gray-600">(shown on your Creator Hub)</span>
                    </label>
                    <input
                      type="text"
                      id="title"
                      value={title}
                      onChange={handleTitleChange}
                      placeholder="My Awesome Link"
                      className="w-full px-4 py-2.5 bg-gray-950 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-600 text-sm transition-all"
                    />
                  </div>

                  {/* Subtitle */}
                  <div>
                    <label htmlFor="subtitle" className="block text-xs text-gray-500 mb-1.5">
                      Subtitle <span className="text-gray-600">(optional)</span>
                    </label>
                    <textarea
                      id="subtitle"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      placeholder="See the full walkthrough before you continue."
                      rows={2}
                      className="w-full px-4 py-2.5 bg-gray-950 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-600 text-sm transition-all resize-none"
                    />
                  </div>
                </div>
              )}

              {/* ── SECTION: Slug / Live Preview (create mode only) ── */}
              {mode === 'create' && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Smart Link Preview</div>

                  {/* Slug input - only for Pro/Founder users */}
                  {userHasProAccess && (
                    <div className="flex items-stretch mb-2">
                      <div className="flex items-center px-3 bg-gray-800/80 border border-r-0 border-gray-700 rounded-l-lg text-gray-500 text-xs whitespace-nowrap font-mono select-none">
                        {user?.subdomain || user?.username}.tubelinkr.com/
                      </div>
                      <input
                        type="text"
                        id="slug"
                        value={slug}
                        onChange={handleSlugChange}
                        autoComplete="off"
                        spellCheck="false"
                        placeholder="my-link"
                        className={`flex-1 min-w-0 px-3 py-2.5 bg-gray-950 border rounded-r-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:border-transparent text-sm font-mono transition-all ${
                          slugError ? 'border-red-500/70 focus:ring-red-500/40' : 'border-gray-700 focus:ring-blue-500/60'
                        }`}
                      />
                    </div>
                  )}

                  {/* Live preview pill */}
                  {userHasProAccess ? (
                    slug && !slugError && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/10 border border-blue-800/30 rounded-lg mt-2">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0" />
                        <span className="text-xs text-blue-300 font-mono truncate">
                          {`https://${user?.subdomain || user?.username}.tubelinkr.com/${slug}`}
                        </span>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/10 border border-blue-800/30 rounded-lg">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0" />
                      <span className="text-xs text-blue-300 font-mono">
                        https://go-dev.inlinkr.com/[smart-code]
                      </span>
                    </div>
                  )}

                  {userHasProAccess && slugError && (
                    <p className="mt-1.5 text-xs text-red-400">{slugError}</p>
                  )}
                  {userHasProAccess && slugSuggestions.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-600 mb-1.5">Try instead:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {slugSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => selectSlugSuggestion(suggestion)}
                            className="px-2.5 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-blue-400 border border-gray-700 rounded-full transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── SECTION: Placements ── */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4">
                <div className="mb-3">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Placements</div>
                  <div className="text-xs text-gray-600">Select where you'll use this Smart Link</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {placementOptions.map((option) => {
                    const isSelected = selectedPlacements.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => togglePlacement(option.value)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          isSelected
                            ? 'bg-blue-600/20 border-blue-500/60 text-blue-300 shadow-[0_0_0_1px_rgba(59,130,246,0.3)]'
                            : 'bg-gray-800/60 border-gray-700/60 text-gray-400 hover:text-gray-200 hover:border-gray-600 hover:bg-gray-700/60'
                        }`}
                      >
                        {placementIcons[option.value]}
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {lastSelectedPlacement && (
                  <PlacementBehaviorHint placementType={lastSelectedPlacement} />
                )}
                {selectedPlacements.includes('other') && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={customPlacement}
                      onChange={(e) => setCustomPlacement(e.target.value)}
                      placeholder="Custom placement name"
                      className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-600 text-sm transition-all"
                    />
                  </div>
                )}
              </div>

              {/* ── SECTION: YouTube Video ── */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Add this link to a video</div>
                <p className="text-xs text-gray-500 mb-3">
                  This Smart Link can be reused across multiple videos, descriptions, comments, and creator placements.
                </p>
                {!youtubeConnected ? (
                  <p className="text-xs text-gray-500">
                    Connect YouTube in <span className="text-blue-400">Settings</span> to add this link to your videos.
                  </p>
                ) : youtubeVideosLoading ? (
                  <div className="text-xs text-gray-500">Loading videos...</div>
                ) : youtubeVideosError ? (
                  <div className="text-xs text-red-400">{youtubeVideosError}</div>
                ) : youtubeVideos.length > 0 ? (
                  <div className="relative video-dropdown-container">
                    <button
                      type="button"
                      onClick={() => setVideoDropdownOpen(!videoDropdownOpen)}
                      className="w-full px-3 py-2.5 bg-gray-950 border border-gray-700 rounded-lg text-left text-white hover:border-gray-600 transition-colors flex items-center gap-3"
                    >
                      {selectedVideoId ? (() => {
                        const selectedVideo = youtubeVideos.find(v => v.video_id === selectedVideoId);
                        return (
                          <>
                            {selectedVideo?.thumbnail ? (
                              <img src={selectedVideo.thumbnail} alt={selectedVideo.title} className="w-9 h-7 rounded object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-9 h-7 rounded bg-gray-700 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-white text-xs font-medium truncate">{selectedVideo?.title}</div>
                              <div className="text-gray-500 text-xs">{selectedVideo?.views.toLocaleString()} views</div>
                            </div>
                          </>
                        );
                      })() : (
                        <span className="text-gray-500 text-sm flex-1">Select a video...</span>
                      )}
                      <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    </button>
                    {videoDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-gray-900 border border-gray-800 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => { setSelectedVideoId(''); setTitle(''); if (!isSlugManuallyEdited) setSlug(''); setVideoDropdownOpen(false); }}
                          className="w-full px-4 py-2.5 text-left hover:bg-gray-800 transition-colors border-b border-gray-800"
                        >
                          <span className="text-gray-500 text-sm">Select a video...</span>
                        </button>
                        {youtubeVideos.map((video) => (
                          <button
                            key={video.video_id}
                            type="button"
                            onClick={() => { setSelectedVideoId(video.video_id); setVideoDropdownOpen(false); }}
                            className="w-full px-4 py-2.5 text-left hover:bg-gray-800 transition-colors border-b border-gray-800 last:border-b-0"
                          >
                            <div className="flex items-center gap-3">
                              {video.thumbnail ? (
                                <img src={video.thumbnail} alt={video.title} className="w-10 h-7 rounded object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-10 h-7 rounded bg-gray-700 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-white text-xs font-medium truncate">{video.title}</div>
                                <div className="text-gray-500 text-xs">{video.views.toLocaleString()} views</div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">No videos found</div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-900/20 border border-red-800/50 rounded-xl px-4 py-3">
                  <p className="text-sm text-red-400">{error}</p>
                  {!userHasProAccess && nonSystemLinks.length >= 5 && (
                    <button
                      onClick={() => navigate('/upgrade')}
                      className="mt-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      Upgrade to Pro
                    </button>
                  )}
                </div>
              )}

              {/* ── ACTION BUTTONS ── */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => navigate('/links')}
                  className="px-5 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || (!userHasProAccess && nonSystemLinks.length >= 5)}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {mode === 'attach' ? 'Attaching...' : 'Creating...'}
                    </span>
                  ) : mode === 'attach' ? 'Attach to Video' : 'Create Smart Link'}
                </button>
              </div>

            </form>
          </>
        )}
      </div>
    </Layout>
  );
}
