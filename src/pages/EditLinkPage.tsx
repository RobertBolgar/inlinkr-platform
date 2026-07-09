import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, Link as LinkType } from '../lib/cloudflare';
import { cleanAutoTitle } from '../lib/utils';
import { Layout, PageContainer, PageHeader, SurfaceCard, SectionHeader, Input, Textarea, Button, StatusBanner } from '../components';
import { AlertTriangle, ChevronDown } from 'lucide-react';

export function EditLinkPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [link, setLink] = useState<LinkType | null>(null);
  const [originalUrl, setOriginalUrl] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [slugChanged, setSlugChanged] = useState(false);
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [youtubeVideos, setYoutubeVideos] = useState<any[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [youtubeVideosLoading, setYoutubeVideosLoading] = useState(false);
  const [youtubeVideosError, setYoutubeVideosError] = useState<string | null>(null);
  const [videoDropdownOpen, setVideoDropdownOpen] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [metadataSuccess, setMetadataSuccess] = useState(false);

  useEffect(() => {
    fetchLink();
  }, [id]);

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

  const fetchLink = async () => {
    if (!id) return;

    try {
      const link = await db.getLinkById(id);
      
      if (!link) {
        navigate('/links');
        return;
      }

      // Fix type mismatch: link.user_id is number, user.id is string
      if (String(link.user_id) !== String(user?.id)) {
        navigate('/links');
        return;
      }

      setLink(link);
      setOriginalUrl(link.original_url);
      setTitle(link.title || '');
      setSubtitle(link.subtitle || '');
      setSlug(link.slug);
      setSelectedVideoId(link.video_id || '');
      setFetchLoading(false);
    } catch (error) {
      console.error('Error fetching link:', error);
      navigate('/links');
    }
  };

  const sanitizeSlugForTyping = (value: string): string => {
    // For onChange: allow trailing dash while typing
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-');
  };

  const sanitizeSlugForSave = (value: string): string => {
    // For submit/save: remove leading/trailing dashes
    return sanitizeSlugForTyping(value)
      .replace(/^-|-$/g, '');
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeSlugForTyping(e.target.value);
    setSlug(sanitized);
    setSlugChanged(sanitized !== link?.slug);
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
        setTitle(cleanAutoTitle(data.title));
      }

      if (!subtitle && data.description) {
        setSubtitle(data.description);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

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

    if (slug.length < 2) {
      setError('Slug must be at least 2 characters');
      return;
    }

    // Sanitize for save (remove leading/trailing dashes)
    const finalSlug = sanitizeSlugForSave(slug);

    if (finalSlug.length < 2) {
      setError('Slug must be at least 2 characters');
      return;
    }

    setLoading(true);

    try {
      if (slugChanged) {
        const existingLinks = await db.getLinksByUserId(user!.id);
        const existingLink = existingLinks.find((l: any) => l.slug === finalSlug && l.id !== id);

        if (existingLink) {
          setError('A link with this slug already exists');
          setLoading(false);
          return;
        }
      }

      await db.updateLink(id!, {
        original_url: originalUrl,
        title: title || null,
        subtitle: subtitle || null,
        slug: finalSlug,
        video_id: selectedVideoId || null,
      });

      navigate('/links');
    } catch (error: any) {
      setError(error.message || 'Failed to update link');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this link? This action cannot be undone.')) {
      return;
    }

    try {
      await db.updateLink(id!, { is_active: false });
      navigate('/links');
    } catch (error: any) {
      setError(error.message || 'Failed to delete link');
    }
  };

  if (fetchLoading) {
    return (
      <Layout>
        <PageContainer>
          <div className="text-gray-400">Loading...</div>
        </PageContainer>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageContainer>
        <PageHeader title="Edit Link" subtitle="Update your link settings" />

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <StatusBanner variant="error">{error}</StatusBanner>
          )}

          {slugChanged && (
            <StatusBanner variant="warning" className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium mb-1">Warning: URL will change</div>
                <div>
                  Changing the slug will change your public URL. Links already shared in videos,
                  descriptions, or comments will break.
                </div>
              </div>
            </StatusBanner>
          )}

          <SurfaceCard>
            <SectionHeader 
              label="Destination URL" 
              description="Required"
            />
            <Input
              id="originalUrl"
              name="originalUrl"
              type="url"
              required
              value={originalUrl}
              onChange={(e) => setOriginalUrl(e.target.value)}
              placeholder="https://example.com/your-long-url"
              className="mb-3"
            />
            
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
                'Auto-fill details'
              )}
            </button>
            
            {metadataError && (
              <div className="mt-2 px-3 py-2 bg-red-900/20 border border-red-800/50 rounded-lg">
                <p className="text-xs text-red-400">{metadataError}</p>
              </div>
            )}
            
            {metadataSuccess && (
              <div className="mt-2 px-3 py-2 bg-green-900/20 border border-green-800/50 rounded-lg">
                <p className="text-xs text-green-400">Details found</p>
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard>
            <SectionHeader label="Add this link to a video" />
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
                      onClick={() => { setSelectedVideoId(''); setVideoDropdownOpen(false); }}
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
          </SurfaceCard>

          <SurfaceCard className="space-y-4">
            <SectionHeader label="Smart Link Details" />
            <Input
              id="title"
              name="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              label="Title"
              helperText="Shown on your creator hub"
              placeholder="My Awesome Product"
            />

            <Textarea
              id="subtitle"
              name="subtitle"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              label="Subtitle"
              helperText="Optional"
              placeholder="See the full walkthrough before you continue."
              rows={2}
            />
          </SurfaceCard>

          
          
          <SurfaceCard>
            <SectionHeader label="Smart Link Preview" description="This is what your Smart Link will look like" />
            <div className="flex items-stretch">
              <span className="px-3 py-2.5 bg-gray-950 border border-gray-700 border-r-0 rounded-l-lg text-gray-500 text-xs whitespace-nowrap flex items-center">
                {window.location.host}/{user?.username}/
              </span>
              <input
                id="slug"
                name="slug"
                type="text"
                value={slug}
                onChange={handleSlugChange}
                autoComplete="off"
                spellCheck="false"
                className="flex-1 min-w-0 px-4 py-2.5 bg-gray-950 border border-gray-700 rounded-r-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-600 text-sm transition-all"
                placeholder="my-link"
              />
            </div>
          </SurfaceCard>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => navigate('/links')}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-300 transition-colors rounded-xl border border-gray-800 hover:border-gray-700"
            >
              Cancel
            </button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="flex-1 py-2.5"
            >
              Save Changes
            </Button>
          </div>

          <div className="bg-gray-900 border border-red-900/40 rounded-xl p-4 sm:p-5">
            <div className="text-xs font-semibold text-red-500/70 uppercase tracking-wide mb-1">Danger Zone</div>
            <p className="text-xs text-gray-500 mb-3">Deleting this Smart Link is permanent and cannot be undone. All analytics history will be lost.</p>
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 border border-red-800/60 hover:border-red-700 rounded-xl transition-colors"
            >
              Delete Smart Link
            </button>
          </div>
        </form>
      </PageContainer>
    </Layout>
  );
}
