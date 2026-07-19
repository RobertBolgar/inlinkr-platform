import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Link as LinkIcon, Loader2, ExternalLink, Star, Play, Layers, Clock, CheckCircle, TrendingUp, Zap } from 'lucide-react';
import { buildSmartLinkUrl } from '../lib/smart-link-url';

interface LinkData {
  id: string;
  slug: string;
  title: string | null;
  subtitle: string | null;
  original_url: string;
  video_id?: string | null;
  video_title?: string | null;
  video_thumbnail?: string | null;
}

interface FeaturedVideo {
  video_id: string;
  title: string | null;
  thumbnail: string | null;
}

interface MoreVideo {
  video_id: string;
  title: string | null;
  thumbnail: string | null;
  views: number;
}

interface HubData {
  username: string;
  display_name?: string;
  subdomain: string;
  channel_avatar_url?: string | null;
  featured_video?: FeaturedVideo | null;
  more_videos?: MoreVideo[] | null;
  links: LinkData[];
  is_auto_featured?: boolean;
  hub_settings?: {
    creator_tagline?: string | null;
    creator_bio?: string | null;
    featured_title_override?: string | null;
    featured_description_override?: string | null;
    featured_cta_text?: string | null;
    show_resources?: boolean;
    show_videos?: boolean;
    show_metrics?: boolean;
    custom_section_title?: string | null;
  } | null;
  hub_sections?: {
    section_slot: number;
    label: string;
    slug: string;
    is_enabled: boolean;
    display_order: number;
    links: LinkData[];
  }[] | null;
}

export function PublicLinkHubPage() {
  const { subdomain: routeSubdomain } = useParams<{ subdomain: string }>();
  const [hubData, setHubData] = useState<HubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get subdomain from route param or hostname
  const getSubdomain = (): string | null => {
    // First try route param (for /hub/:subdomain)
    if (routeSubdomain) {
      return routeSubdomain;
    }
    
    // Then try hostname (for subdomain.tubelinkr.com)
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const hostnameParts = hostname.split('.');
      if (hostnameParts.length >= 2 && hostnameParts[1] === 'tubelinkr' && hostnameParts[2] === 'com') {
        return hostnameParts[0];
      }
    }
    
    return null;
  };

  const subdomain = getSubdomain();

  useEffect(() => {
    const fetchHubData = async () => {
      if (!subdomain) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/public-links-by-subdomain?subdomain=${subdomain}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Hub not found');
          } else {
            setError('Failed to load hub');
          }
          return;
        }

        const data = await response.json();
        setHubData(data);
      } catch (err) {
        setError('Failed to load hub');
        console.error('Error fetching hub data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHubData();
  }, [subdomain]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <div className="text-gray-400">Loading hub...</div>
        </div>
      </div>
    );
  }

  if (error || !hubData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-8">
            <LinkIcon className="w-16 h-16 text-gray-600 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-white mb-4">Hub Not Found</h1>
            <p className="text-gray-400 mb-6 leading-relaxed">
              {error || 'This hub is not available or does not exist.'}
            </p>
            <a
              href="https://tubelinkr.com"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary text-white font-medium rounded-xl transition-all duration-200 hover:scale-105"
            >
              Visit TubeLinkr
            </a>
          </div>
        </div>
      </div>
    );
  }

  const getDisplayTitle = (title: string | null, slug: string) => {
    return title || slug;
  };

  const formatSubtitle = (subtitle?: string | null) => {
    if (!subtitle || subtitle.trim() === "") return "";

    const clean = subtitle.trim().replace(/\s+/g, " ");

    if (clean.length <= 90) return clean;

    return clean.slice(0, 87).trimEnd() + "...";
  };

  const getLinkUrl = (slug: string) => {
    return buildSmartLinkUrl({
      slug,
      username: hubData.username,
    }, null);
  };

  const getYouTubeUrl = (videoId: string) => {
    return `https://www.youtube.com/watch?v=${videoId}`;
  };

  const getCreatorInitials = () => {
    const name = hubData.display_name || hubData.username || hubData.subdomain;
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  };

  const getCreatorTagline = () => {
    // Use custom tagline if set, otherwise fallback to auto-generated
    if (hubData.hub_settings?.creator_tagline) {
      return hubData.hub_settings.creator_tagline;
    }
    if (hubData.display_name) {
      return `@${hubData.username}`;
    }
    return hubData.username || hubData.subdomain;
  };

  const getCreatorBio = () => {
    // Use custom bio if set, otherwise generate tasteful fallback
    if (hubData.hub_settings?.creator_bio) {
      return hubData.hub_settings.creator_bio;
    }
    // Generate tasteful fallback bio based on available data
    const videoCount = hubData.links.filter(link => hasVideoData(link)).length;
    const totalLinks = hubData.links.length;

    if (videoCount > 0) {
      return `Creator sharing ${videoCount} video${videoCount > 1 ? 's' : ''} and ${totalLinks} resource${totalLinks > 1 ? 's' : ''}`;
    }
    return `Creator sharing ${totalLinks} resource${totalLinks > 1 ? 's' : ''}`;
  };

  const hasVideoData = (link: LinkData) => {
    return link.video_id || link.video_title || link.video_thumbnail;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 overflow-x-hidden">
      <div className="mx-auto px-4 sm:px-6 py-8 md:py-16 max-w-4xl w-full">
        {/* Premium Creator Header */}
        <div className="text-center mb-8 md:mb-16">
          {/* Avatar with blue glow */}
          <div className="relative inline-flex items-center justify-center mb-4 md:mb-6">
            <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-3xl"></div>
            {hubData.channel_avatar_url ? (
              <img
                src={hubData.channel_avatar_url}
                alt=""
                className="relative w-20 h-20 md:w-28 md:h-28 rounded-full object-cover border-4 border-blue-400/30 shadow-2xl"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextElementSibling) {
                    (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                  }
                }}
              />
            ) : null}
            <div className={`relative w-20 h-20 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl md:text-4xl font-bold border-4 border-blue-400/30 shadow-2xl ${hubData.channel_avatar_url ? 'hidden' : ''}`}>
              {getCreatorInitials()}
            </div>
          </div>

          {/* Creator name with verified badge */}
          <div className="flex items-center justify-center gap-2 mb-2 md:mb-3">
            <h1 className="text-3xl md:text-5xl font-bold text-white bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text text-transparent">
              {hubData.display_name || hubData.username || hubData.subdomain}
            </h1>
            <CheckCircle className="w-5 h-5 md:w-7 md:h-7 text-blue-400" />
          </div>

          {/* Creator tagline */}
          <p className="text-base md:text-xl text-gray-400 mb-1.5 md:mb-2">
            {getCreatorTagline()}
          </p>

          {/* Creator bio */}
          <p className="text-gray-500 text-xs md:text-base max-w-2xl mx-auto mb-3 md:mb-4">
            {getCreatorBio()}
          </p>

          {/* Creator metadata */}
          <div className="flex items-center justify-center gap-3 md:gap-6 text-xs md:text-sm text-gray-600">
            <div className="flex items-center gap-1.5">
              <Play className="w-3 h-3 md:w-4 md:h-4 text-purple-400" />
              <span>{hubData.links.filter(link => hasVideoData(link)).length} videos tracked</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Layers className="w-3 h-3 md:w-4 md:h-4 text-blue-400" />
              <span>{hubData.links.length} creator resources</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 md:w-4 md:h-4 text-green-400" />
              <span>Active hub</span>
            </div>
          </div>
        </div>

        {/* Links Section */}
        {hubData.links.length === 0 && !hubData.featured_video ? (
          <div className="text-center py-16">
            <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-12 max-w-md mx-auto">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-800 rounded-full mb-6">
                <LinkIcon className="w-10 h-10 text-gray-600" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">No Public Links Yet</h2>
              <p className="text-gray-400 leading-relaxed">
                This creator has not added any public links yet.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-8 md:space-y-10">
            {/* Featured Video - Cinematic Hero */}
            {hubData.featured_video ? (
              <div className="mb-16">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <Star className="w-6 h-6 text-yellow-500" />
                  Featured Video
                </h2>
                {(() => {
                  const featuredVideo = hubData.featured_video;

                  // Use overrides if set, otherwise use video data
                  const displayTitle = hubData.hub_settings?.featured_title_override
                    ? hubData.hub_settings.featured_title_override
                    : featuredVideo.title;

                  const displayDescription = hubData.hub_settings?.featured_description_override || '';

                  const displayCta = hubData.hub_settings?.featured_cta_text || 'Watch Now';

                  return (
                    <div
                      onClick={() => window.location.href = getYouTubeUrl(featuredVideo.video_id)}
                      className="group relative min-h-[280px] md:min-h-[380px] rounded-3xl overflow-hidden cursor-pointer shadow-2xl hover:shadow-blue-500/50 hover:shadow-2xl transition-all duration-[250ms] ease-[cubic-bezier(0.19,1,0.22,1)] hover:-translate-y-1 w-full"
                    >
                      {/* Thumbnail Background */}
                      {featuredVideo.thumbnail ? (
                        <img
                          src={featuredVideo.thumbnail}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-[250ms] ease-[cubic-bezier(0.19,1,0.22,1)] brightness-85 contrast-105"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/40 to-purple-600/40"></div>
                      )}

                      {/* Premium Gradient Overlays for Cinematic Feel */}
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-950/98 via-gray-950/70 via-gray-950/30 to-transparent"></div>
                      <div className="absolute inset-0 bg-gradient-to-r from-gray-950/90 via-gray-950/50 to-transparent"></div>
                      <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-[250ms] ease-[cubic-bezier(0.19,1,0.22,1)]"></div>

                      {/* Content */}
                      <div className="relative h-full flex flex-col justify-end p-5 md:p-10">
                        <div className="max-w-full">
                          {/* Video Badge */}
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/95 backdrop-blur-md rounded-full mb-4 md:mb-5 shadow-xl shadow-blue-500/20">
                            <Play className="w-4 h-4 text-white" />
                            <span className="text-white text-xs font-semibold tracking-wide">VIDEO</span>
                          </div>

                          {/* Title */}
                          <h3 className="text-xl md:text-4xl font-bold text-white mb-2 md:mb-4 leading-tight drop-shadow-lg line-clamp-2 tracking-tight">
                            {displayTitle}
                          </h3>

                          {/* Subtitle */}
                          {displayDescription && (
                            <p className="text-gray-200 text-sm md:text-lg leading-relaxed mb-4 md:mb-8 line-clamp-2 drop-shadow max-w-2xl">
                              {displayDescription}
                            </p>
                          )}

                          {/* CTAs */}
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="inline-flex items-center gap-2 px-6 py-3 md:px-7 md:py-3.5 bg-primary hover:bg-primary text-white text-sm font-semibold rounded-xl transition-all duration-[250ms] ease-[cubic-bezier(0.19,1,0.22,1)] hover:scale-105 shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50">
                              <Play className="w-4 h-4" />
                              {displayCta}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900/60 backdrop-blur-sm rounded-lg border border-gray-700/50 opacity-70 group-hover:opacity-100 transition-opacity duration-[250ms]">
                              <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                              <span className="text-gray-400 text-xs font-medium">Featured Video</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              /* Fallback: Featured Link (if no featured_video) */
              hubData.links.length > 0 && (
                <div className="mb-16">
                  <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <Star className="w-6 h-6 text-yellow-500" />
                    Featured
                    {hubData.is_auto_featured && (
                      <span className="text-xs font-normal text-gray-500 ml-2">
                        Top Performing
                      </span>
                    )}
                  </h2>
                  {(() => {
                    const featuredLink = hubData.links[0];
                    const formattedSubtitle = formatSubtitle(featuredLink.subtitle);
                    const isVideo = hasVideoData(featuredLink);

                    // Use overrides if set, otherwise use link data
                    const displayTitle = hubData.hub_settings?.featured_title_override
                      ? hubData.hub_settings.featured_title_override
                      : (isVideo && featuredLink.video_title
                        ? featuredLink.video_title
                        : getDisplayTitle(featuredLink.title, featuredLink.slug));

                    const displayDescription = hubData.hub_settings?.featured_description_override
                      ? hubData.hub_settings.featured_description_override
                      : formattedSubtitle;

                    const displayCta = hubData.hub_settings?.featured_cta_text
                      ? hubData.hub_settings.featured_cta_text
                      : (isVideo ? 'Watch Now' : 'Explore');

                    return (
                      <div
                        key={featuredLink.id}
                        onClick={() => window.location.href = getLinkUrl(featuredLink.slug)}
                        className="group relative min-h-[280px] md:min-h-[380px] rounded-3xl overflow-hidden cursor-pointer shadow-2xl hover:shadow-blue-500/50 hover:shadow-2xl transition-all duration-[250ms] ease-[cubic-bezier(0.19,1,0.22,1)] hover:-translate-y-1 w-full"
                      >
                        {/* Thumbnail Background */}
                        {isVideo && featuredLink.video_thumbnail ? (
                          <img
                            src={featuredLink.video_thumbnail}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-[250ms] ease-[cubic-bezier(0.19,1,0.22,1)] brightness-85 contrast-105"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/40 to-purple-600/40"></div>
                        )}

                        {/* Premium Gradient Overlays for Cinematic Feel */}
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-950/98 via-gray-950/70 via-gray-950/30 to-transparent"></div>
                        <div className="absolute inset-0 bg-gradient-to-r from-gray-950/90 via-gray-950/50 to-transparent"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-[250ms] ease-[cubic-bezier(0.19,1,0.22,1)]"></div>

                        {/* Content */}
                        <div className="relative h-full flex flex-col justify-end p-5 md:p-10">
                          <div className="max-w-full">
                            {/* Video Badge */}
                            {isVideo && (
                              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/95 backdrop-blur-md rounded-full mb-4 md:mb-5 shadow-xl shadow-blue-500/20">
                                <Play className="w-4 h-4 text-white" />
                                <span className="text-white text-xs font-semibold tracking-wide">VIDEO</span>
                              </div>
                            )}

                            {/* Title */}
                            <h3 className="text-xl md:text-4xl font-bold text-white mb-2 md:mb-4 leading-tight drop-shadow-lg line-clamp-2 tracking-tight">
                              {displayTitle}
                            </h3>

                            {/* Subtitle */}
                            {displayDescription && (
                              <p className="text-gray-200 text-sm md:text-lg leading-relaxed mb-4 md:mb-8 line-clamp-2 drop-shadow max-w-2xl">
                                {displayDescription}
                              </p>
                            )}

                            {/* CTAs */}
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="inline-flex items-center gap-2 px-6 py-3 md:px-7 md:py-3.5 bg-primary hover:bg-primary text-white text-sm font-semibold rounded-xl transition-all duration-[250ms] ease-[cubic-bezier(0.19,1,0.22,1)] hover:scale-105 shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50">
                                <ExternalLink className="w-4 h-4" />
                                {displayCta}
                              </span>
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900/60 backdrop-blur-sm rounded-lg border border-gray-700/50 opacity-70 group-hover:opacity-100 transition-opacity duration-[250ms]">
                                <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                                <span className="text-gray-400 text-xs font-medium">Featured Resource</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )
            )}

            {/* Metrics Strip */}
            {hubData.links.length > 0 && hubData.hub_settings?.show_metrics !== false && (
              <div className="mb-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                  <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-3 md:p-4 hover:bg-gray-800/60 hover:border-blue-500/20 transition-all duration-[250ms] ease-[cubic-bezier(0.19,1,0.22,1)]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Layers className="w-4 h-4 text-blue-400" />
                      </div>
                      <span className="text-gray-500 text-xs font-medium">Resources</span>
                    </div>
                    <div className="text-xl md:text-2xl font-bold text-white">
                      {hubData.links.length}
                    </div>
                  </div>

                  <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-3 md:p-4 hover:bg-gray-800/60 hover:border-purple-500/20 transition-all duration-[250ms] ease-[cubic-bezier(0.19,1,0.22,1)]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Play className="w-4 h-4 text-purple-400" />
                      </div>
                      <span className="text-gray-500 text-xs font-medium">Videos</span>
                    </div>
                    <div className="text-xl md:text-2xl font-bold text-white">
                      {hubData.links.filter(link => hasVideoData(link)).length}
                    </div>
                  </div>

                  <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-3 md:p-4 hover:bg-gray-800/60 hover:border-green-500/20 transition-all duration-[250ms] ease-[cubic-bezier(0.19,1,0.22,1)]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <Star className="w-4 h-4 text-green-400" />
                      </div>
                      <span className="text-gray-500 text-xs font-medium">Featured</span>
                    </div>
                    <div className="text-xl md:text-2xl font-bold text-white">
                      1
                    </div>
                  </div>

                  <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-3 md:p-4 hover:bg-gray-800/60 hover:border-orange-500/20 transition-all duration-[250ms] ease-[cubic-bezier(0.19,1,0.22,1)]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                        <Clock className="w-4 h-4 text-orange-400" />
                      </div>
                      <span className="text-gray-500 text-xs font-medium">Updated</span>
                    </div>
                    <div className="text-base md:text-lg font-bold text-white">
                      {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Smart Sections */}
            {hubData.more_videos && hubData.more_videos.length > 0 && (
              <div>
                {/* More Videos - Always render if videos exist and show_videos is enabled */}
                {(() => {
                  if (hubData.hub_settings?.show_videos === false) return null;

                  return (
                    <div className="mb-10">
                      <h2 className="text-lg font-semibold text-white/90 mb-4 flex items-center gap-2">
                        <Play className="w-4 h-4 text-purple-400" />
                        {hubData.hub_settings?.custom_section_title || (hubData.more_videos.length === 1 ? 'Latest Video' : 'More Videos')}
                      </h2>
                      <div className="grid gap-3 md:grid-cols-2 min-w-0 w-full">
                        {hubData.more_videos.map((video) => {
                          return (
                            <div
                              key={video.video_id}
                              onClick={() => window.location.href = getYouTubeUrl(video.video_id)}
                              className="group relative bg-gray-900/60 border border-gray-800/80 rounded-2xl overflow-hidden hover:bg-gray-800/70 hover:border-purple-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-[250ms] ease-[cubic-bezier(0.19,1,0.22,1)] cursor-pointer shadow-lg hover:shadow-purple-500/20"
                            >
                              {/* Thumbnail Background */}
                              {video.thumbnail && (
                                <div className="absolute inset-0">
                                  <img
                                    src={video.thumbnail}
                                    alt=""
                                    className="w-full h-full object-cover opacity-30 group-hover:opacity-45 transition-opacity duration-[250ms] ease-[cubic-bezier(0.19,1,0.22,1)] brightness-90"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/60 to-transparent"></div>
                                </div>
                              )}

                              <div className="relative p-4">
                                <div className="flex items-start gap-3">
                                  {/* Play Icon */}
                                  <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-purple-500/30 border border-purple-500/30 flex items-center justify-center backdrop-blur-sm group-hover:bg-purple-500/40 group-hover:border-purple-500/50 transition-all duration-[250ms] ease-[cubic-bezier(0.19,1,0.22,1)]">
                                    <Play className="w-5 h-5 text-purple-300" />
                                  </div>

                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                    <h3 className="text-sm md:text-base font-semibold text-white mb-1.5 truncate group-hover:text-purple-200 transition-colors duration-[250ms]">
                                      {video.title || 'Untitled Video'}
                                    </h3>
                                    <div className="flex items-center gap-2">
                                      <span className="text-purple-400 text-xs font-semibold group-hover:text-purple-300 transition-colors duration-[250ms]">
                                        Watch Now
                                      </span>
                                      {video.views > 0 && (
                                        <span className="text-gray-500 text-xs">
                                          {video.views.toLocaleString()} views
                                        </span>
                                      )}
                                    </div>
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

                {/* Section-based rendering (if hub_sections exists) */}
                {hubData.hub_sections && hubData.hub_sections.length > 0 ? (
                  <div className="space-y-10">
                    {hubData.hub_sections.map((section) => (
                      <div key={section.section_slot} id={section.slug || undefined}>
                        <h2 className="text-lg font-semibold text-white/90 mb-4 flex items-center gap-2">
                          <Layers className="w-4 h-4 text-blue-400" />
                          {section.label}
                        </h2>
                        <div className="grid gap-3 md:grid-cols-2 min-w-0 w-full">
                          {section.links.map((link) => {
                            const formattedSubtitle = formatSubtitle(link.subtitle);

                            return (
                              <div
                                key={link.id}
                                onClick={() => {
                                  window.location.href = getLinkUrl(link.slug);
                                }}
                                className="group relative bg-gray-900/60 border border-gray-800/80 rounded-2xl overflow-hidden hover:bg-gray-800/70 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-[250ms] ease-[cubic-bezier(0.19,1,0.22,1)] cursor-pointer shadow-lg hover:border-blue-500/40 hover:shadow-blue-500/20"
                              >
                                <div className="relative p-4">
                                  <div className="flex items-start gap-3">
                                    {/* Icon */}
                                    <div className="flex-shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center backdrop-blur-sm transition-all duration-[250ms] ease-[cubic-bezier(0.19,1,0.22,1)] bg-gradient-to-br from-blue-500/30 to-cyan-500/30 border-blue-500/30 group-hover:from-blue-500/40 group-hover:to-cyan-500/40 group-hover:border-blue-500/40">
                                      <LinkIcon className="w-5 h-5 text-blue-400" />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                      <h3 className="text-sm md:text-base font-semibold text-white mb-1.5 truncate transition-colors duration-[250ms] group-hover:text-blue-200">
                                        {getDisplayTitle(link.title, link.slug)}
                                      </h3>
                                      {formattedSubtitle && (
                                        <p className="text-gray-400 text-xs leading-relaxed mb-2 line-clamp-2">
                                          {formattedSubtitle}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold transition-colors duration-[250ms] text-blue-400 group-hover:text-blue-300">
                                          Explore
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Fallback: Original rendering for hubs without sections */
                  <>
                    {/* Video Resources Section */}
                    {(() => {
                      const videoLinks = hubData.links.slice(1).filter(link => hasVideoData(link));
                      if (videoLinks.length === 0) return null;
                      if (hubData.hub_settings?.show_videos === false) return null;

                      return (
                        <div className="mb-10">
                          <h2 className="text-lg font-semibold text-white/90 mb-4 flex items-center gap-2">
                            <Play className="w-4 h-4 text-purple-400" />
                            {hubData.hub_settings?.custom_section_title || (videoLinks.length === 1 ? 'Latest Video' : 'More Videos')}
                          </h2>
                          <div className="grid gap-3 md:grid-cols-2 min-w-0 w-full">
                            {videoLinks.map((link) => {
                              const formattedSubtitle = formatSubtitle(link.subtitle);
                              const isVideo = hasVideoData(link);

                              return (
                                <div
                                  key={link.id}
                                  onClick={() => {
                                    if (link.video_id) {
                                      window.location.href = getYouTubeUrl(link.video_id);
                                    } else {
                                      window.location.href = getLinkUrl(link.slug);
                                    }
                                  }}
                                  className="group relative bg-gray-900/60 border border-gray-800/80 rounded-2xl overflow-hidden hover:bg-gray-800/70 hover:border-purple-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-[250ms] ease-[cubic-bezier(0.19,1,0.22,1)] cursor-pointer shadow-lg hover:shadow-purple-500/20"
                                >
                                  {/* Thumbnail Background */}
                                  {isVideo && link.video_thumbnail && (
                                    <div className="absolute inset-0">
                                      <img
                                        src={link.video_thumbnail}
                                        alt=""
                                        className="w-full h-full object-cover opacity-30 group-hover:opacity-45 transition-opacity duration-[250ms] ease-[cubic-bezier(0.19,1,0.22,1)] brightness-90"
                                      />
                                      <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/60 to-transparent"></div>
                                    </div>
                                  )}

                                  <div className="relative p-4">
                                    <div className="flex items-start gap-3">
                                      {/* Play Icon */}
                                      <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-purple-500/30 border border-purple-500/30 flex items-center justify-center backdrop-blur-sm group-hover:bg-purple-500/40 group-hover:border-purple-500/50 transition-all duration-[250ms] ease-[cubic-bezier(0.19,1,0.22,1)]">
                                        <Play className="w-5 h-5 text-purple-300" />
                                      </div>

                                      {/* Content */}
                                      <div className="flex-1 min-w-0">
                                        <h3 className="text-sm md:text-base font-semibold text-white mb-1.5 truncate group-hover:text-purple-200 transition-colors duration-[250ms]">
                                          {isVideo && link.video_title
                                            ? link.video_title
                                            : getDisplayTitle(link.title, link.slug)
                                          }
                                        </h3>
                                        {formattedSubtitle && (
                                          <p className="text-gray-400 text-xs leading-relaxed mb-2 line-clamp-2">
                                            {formattedSubtitle}
                                          </p>
                                        )}
                                        <div className="flex items-center gap-2">
                                          <span className="text-purple-400 text-xs font-semibold group-hover:text-purple-300 transition-colors duration-[250ms]">
                                            Watch Now
                                          </span>
                                        </div>
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

                    {/* Other Resources Section */}
                    {(() => {
                      const otherLinks = hubData.links.slice(1).filter(link => !hasVideoData(link));
                      if (otherLinks.length === 0) return null;
                      if (hubData.hub_settings?.show_resources === false) return null;

                      return (
                        <div>
                          <h2 className="text-lg font-semibold text-white/80 mb-4 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-blue-400" />
                            {hubData.hub_settings?.custom_section_title || (otherLinks.length === 1 ? 'Recommended' : 'Creator Resources')}
                          </h2>
                          <div className="grid gap-3 md:grid-cols-2 min-w-0 w-full">
                            {otherLinks.map((link) => {
                              const formattedSubtitle = formatSubtitle(link.subtitle);

                              return (
                                <div
                                  key={link.id}
                                  onClick={() => window.location.href = getLinkUrl(link.slug)}
                                  className="group bg-gray-900/60 border border-gray-800/80 rounded-2xl p-4 hover:bg-gray-800/70 hover:border-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-[250ms] ease-[cubic-bezier(0.19,1,0.22,1)] cursor-pointer shadow-lg hover:shadow-blue-500/20 overflow-hidden"
                                >
                                  <div className="flex items-start gap-3">
                                    {/* Icon */}
                                    <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/30 to-cyan-500/30 border border-blue-500/30 flex items-center justify-center group-hover:from-blue-500/40 group-hover:to-cyan-500/40 group-hover:border-blue-500/40 transition-all duration-[250ms] ease-[cubic-bezier(0.19,1,0.22,1)]">
                                      <LinkIcon className="w-5 h-5 text-blue-400" />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                      <h3 className="text-sm md:text-base font-semibold text-white mb-1.5 truncate group-hover:text-blue-200 transition-colors duration-[250ms]">
                                        {getDisplayTitle(link.title, link.slug)}
                                      </h3>
                                      {formattedSubtitle && (
                                        <p className="text-gray-400 text-xs leading-relaxed mb-2 line-clamp-2">
                                          {formattedSubtitle}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-2">
                                        <span className="text-blue-400 text-xs font-semibold group-hover:text-blue-300 transition-colors duration-[250ms]">
                                          Explore
                                        </span>
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
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-16 md:mt-20 pt-8 border-t border-gray-800/50">
          <p className="text-gray-600 text-sm">
            Track what content actually drives clicks with{' '}
            <a
              href="https://tubelinkr.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              InLinkr Creator Hubs
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
