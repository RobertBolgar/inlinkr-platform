import { hasEffectiveProAccess } from './entitlement-helper.js';

export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    // Get subdomain from query parameter
    const url = new URL(request.url);
    const subdomain = url.searchParams.get('subdomain');
    
    if (!subdomain) {
      return new Response(
        JSON.stringify({ error: 'Subdomain parameter is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Find user by subdomain with plan and referral fields (including founder access)
    const user = await env.DB.prepare(
      'SELECT id, username, subdomain, display_name, plan, subscription_status, referral_reward_active, referral_reward_plan, referral_reward_expires_at, EXISTS(SELECT 1 FROM founder_access WHERE user_id = users.id) as has_founder_access FROM users WHERE subdomain = ? AND is_active = 1'
    ).bind(subdomain).first();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check effective Pro access (paid Pro, referral Pro, or Founder)
    const userHasEffectiveProAccess = hasEffectiveProAccess(user);
    if (!userHasEffectiveProAccess) {
      return new Response(
        JSON.stringify({ error: 'Pro access required' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get creator hub settings if they exist
    const hubSettings = await env.DB.prepare(
      'SELECT creator_tagline, creator_bio, featured_link_id, featured_video_id, featured_title_override, featured_description_override, featured_cta_text, show_resources, show_videos, show_metrics, custom_section_title FROM creator_hub_settings WHERE user_id = ?'
    ).bind(user.id).first();

    // Get active, non-system links for the user with video_id
    const links = await env.DB.prepare(
      'SELECT id, slug, title, subtitle, original_url, video_id FROM links WHERE user_id = ? AND is_active = 1 AND COALESCE(is_system, 0) = 0 ORDER BY created_at DESC'
    ).bind(user.id).all();

    // Get creator hub sections
    const sections = await env.DB.prepare(
      'SELECT id, user_id, section_slot, label, slug, is_enabled, display_order FROM creator_hub_sections WHERE user_id = ? ORDER BY display_order ASC, section_slot ASC'
    ).bind(user.id).all();

    // Get link assignments
    const assignments = await env.DB.prepare(
      'SELECT id, user_id, link_id, section_slot, display_order, is_active FROM creator_hub_link_assignments WHERE user_id = ? AND is_active = 1 ORDER BY section_slot ASC, display_order ASC'
    ).bind(user.id).all();

    // Fetch YouTube channel avatar and video metadata if user has YouTube connection
    let channelAvatarUrl = null;
    let videoMetadataMap = new Map();
    let featuredVideo = null;
    let moreVideos = [];

    try {
      const connection = await env.DB.prepare(
        'SELECT access_token, refresh_token, youtube_channel_id FROM youtube_connections WHERE user_id = ? AND is_active = 1'
      ).bind(user.id).first();

      if (connection) {
        let accessToken = connection.access_token;
        const refreshToken = connection.refresh_token;

        // Helper function to refresh access token
        const refreshAccessToken = async () => {
          const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
          const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;

          if (!clientId || !clientSecret) {
            throw new Error('Google OAuth not configured');
          }

          const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: refreshToken,
              grant_type: 'refresh_token',
            }),
          });

          if (!refreshResponse.ok) {
            throw new Error('Failed to refresh access token');
          }

          const refreshData = await refreshResponse.json();
          return refreshData.access_token;
        };

        // Fetch channel avatar
        try {
          let channelResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${connection.youtube_channel_id}&key=${env.GOOGLE_API_KEY}`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            }
          );

          // Try refreshing token if needed
          if (!channelResponse.ok && channelResponse.status === 401) {
            try {
              accessToken = await refreshAccessToken();
              channelResponse = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${connection.youtube_channel_id}&key=${env.GOOGLE_API_KEY}`,
                {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                  },
                }
              );
            } catch (refreshError) {
              console.error('Token refresh error:', refreshError);
            }
          }

          if (channelResponse.ok) {
            const channelData = await channelResponse.json();
            const channel = channelData.items?.[0];
            if (channel?.snippet?.thumbnails) {
              channelAvatarUrl = channel.snippet.thumbnails.high?.url || channel.snippet.thumbnails.medium?.url || channel.snippet.thumbnails.default?.url || null;
            }
          }
        } catch (channelError) {
          console.error('Error fetching channel avatar:', channelError);
        }

        // Fetch video metadata for links with video_id
        const videoIds = new Set();
        (links.results || []).forEach(link => {
          if (link.video_id) {
            videoIds.add(link.video_id);
          }
        });

        if (videoIds.size > 0) {
          try {
            const videoIdList = Array.from(videoIds).join(',');
            let videosResponse = await fetch(
              `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${videoIdList}&key=${env.GOOGLE_API_KEY}`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                },
              }
            );

            // Try refreshing token if needed
            if (!videosResponse.ok && videosResponse.status === 401) {
              try {
                accessToken = await refreshAccessToken();
                videosResponse = await fetch(
                  `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${videoIdList}&key=${env.GOOGLE_API_KEY}`,
                  {
                    headers: {
                      'Authorization': `Bearer ${accessToken}`,
                    },
                  }
                );
              } catch (refreshError) {
                console.error('Token refresh error:', refreshError);
              }
            }

            if (videosResponse.ok) {
              const videosData = await videosResponse.json();
              // Only store metadata for public videos to prevent unlisted videos from appearing in links
              (videosData.items || []).forEach(item => {
                if (item.status?.privacyStatus === 'public') {
                  videoMetadataMap.set(item.id, {
                    title: item.snippet?.title || null,
                    thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || null,
                  });
                }
              });
            }
          } catch (videoError) {
            console.error('Error fetching video metadata:', videoError);
          }
        }

        // Fetch featured video metadata if featured_video_id is set
        if (hubSettings?.featured_video_id) {
          try {
            const featuredVideoId = hubSettings.featured_video_id;
            let videosResponse = await fetch(
              `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${featuredVideoId}&key=${env.GOOGLE_API_KEY}`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                },
              }
            );

            // Try refreshing token if needed
            if (!videosResponse.ok && videosResponse.status === 401) {
              try {
                accessToken = await refreshAccessToken();
                videosResponse = await fetch(
                  `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${featuredVideoId}&key=${env.GOOGLE_API_KEY}`,
                  {
                    headers: {
                      'Authorization': `Bearer ${accessToken}`,
                    },
                  }
                );
              } catch (refreshError) {
                console.error('Token refresh error for featured video:', refreshError);
              }
            }

            if (videosResponse.ok) {
              const videosData = await videosResponse.json();
              const video = videosData.items?.[0];
              // Only display featured video if it is public
              if (video && video.status?.privacyStatus === 'public') {
                featuredVideo = {
                  video_id: video.id,
                  title: video.snippet?.title || null,
                  thumbnail: video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url || null,
                };
              }
            }
          } catch (error) {
            console.error('Error fetching featured video metadata:', error);
          }
        }

        // Fetch latest channel uploads for More Videos
        try {
          // First get the uploads playlist ID
          let channelsResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            }
          );

          // Try refreshing token if needed
          if (!channelsResponse.ok && channelsResponse.status === 401) {
            try {
              accessToken = await refreshAccessToken();
              channelsResponse = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true`,
                {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                  },
                }
              );
            } catch (refreshError) {
              console.error('Token refresh error for channel uploads:', refreshError);
            }
          }

          if (channelsResponse.ok) {
            const channelsData = await channelsResponse.json();
            const channel = channelsData.items?.[0];
            if (channel?.contentDetails?.relatedPlaylists?.uploads) {
              const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;

              // Fetch videos from uploads playlist (max 10 to have room to exclude featured)
              let playlistItemsResponse = await fetch(
                `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=10`,
                {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                  },
                }
              );

              // Try refreshing token if needed
              if (!playlistItemsResponse.ok && playlistItemsResponse.status === 401) {
                try {
                  accessToken = await refreshAccessToken();
                  playlistItemsResponse = await fetch(
                    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=10`,
                    {
                      headers: {
                        'Authorization': `Bearer ${accessToken}`,
                      },
                    }
                  );
                } catch (refreshError) {
                  console.error('Token refresh error for playlist items:', refreshError);
                }
              }

              if (playlistItemsResponse.ok) {
                const playlistItemsData = await playlistItemsResponse.json();
                const videoIds = (playlistItemsData.items || [])
                  .map((item) => item.snippet?.resourceId?.videoId)
                  .filter(Boolean);

                // Exclude featured video if set
                const filteredVideoIds = hubSettings?.featured_video_id
                  ? videoIds.filter((id) => id !== hubSettings.featured_video_id)
                  : videoIds;

                // Take up to 6 videos
                const videoIdsToFetch = filteredVideoIds.slice(0, 6);

                if (videoIdsToFetch.length > 0) {
                  // Fetch video details with statistics
                  let videosResponse = await fetch(
                    `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,status&id=${videoIdsToFetch.join(',')}&key=${env.GOOGLE_API_KEY}`,
                    {
                      headers: {
                        'Authorization': `Bearer ${accessToken}`,
                      },
                    }
                  );

                  // Try refreshing token if needed
                  if (!videosResponse.ok && videosResponse.status === 401) {
                    try {
                      accessToken = await refreshAccessToken();
                      videosResponse = await fetch(
                        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,status&id=${videoIdsToFetch.join(',')}&key=${env.GOOGLE_API_KEY}`,
                        {
                          headers: {
                            'Authorization': `Bearer ${accessToken}`,
                          },
                        }
                      );
                    } catch (refreshError) {
                      console.error('Token refresh error for more videos:', refreshError);
                    }
                  }

                  if (videosResponse.ok) {
                    const videosData = await videosResponse.json();
                    // Filter to only include public videos
                    moreVideos = (videosData.items || [])
                      .filter((item) => item.status?.privacyStatus === 'public')
                      .map((item) => ({
                        video_id: item.id,
                        title: item.snippet?.title || null,
                        thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || null,
                        views: parseInt(item.statistics?.viewCount || '0', 10),
                      }));
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('Error fetching more videos:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching YouTube data:', error);
      // Continue without YouTube data if fetch fails
    }

    // Enrich links with video metadata
    const enrichedLinks = (links.results || []).map(link => {
      const metadata = videoMetadataMap.get(link.video_id);
      return {
        ...link,
        video_title: metadata?.title || null,
        video_thumbnail: metadata?.thumbnail || null,
      };
    });

    // Fetch click counts for all links
    let linkClickCounts = {};
    if (enrichedLinks.length > 0) {
      const linkIds = enrichedLinks.map(link => link.id);
      const placeholders = linkIds.map(() => '?').join(',');
      const clickResults = await env.DB.prepare(
        `SELECT link_id, COUNT(*) as click_count FROM click_events WHERE link_id IN (${placeholders}) GROUP BY link_id`
      ).bind(...linkIds).all();
      linkClickCounts = Object.fromEntries(
        (clickResults.results || []).map(r => [r.link_id, r.click_count])
      );
    }

    // Reorder links if featured_link_id is set, otherwise auto-select best performer
    let orderedLinks = enrichedLinks;
    let isAutoFeatured = false;
    if (hubSettings?.featured_link_id) {
      // Manual override: use the manually selected featured link
      const featuredLink = enrichedLinks.find(link => link.id === hubSettings.featured_link_id);
      const otherLinks = enrichedLinks.filter(link => link.id !== hubSettings.featured_link_id);
      if (featuredLink) {
        orderedLinks = [featuredLink, ...otherLinks];
      }
    } else if (enrichedLinks.length > 0) {
      // Auto-select: choose the link with highest click count
      // Prefer links with public videos over links without videos or with non-public videos
      const linkWithClicks = enrichedLinks.map(link => ({
        ...link,
        click_count: linkClickCounts[link.id] || 0,
        has_public_video: link.video_id && videoMetadataMap.has(link.video_id)
      }));

      // Separate into links with public videos and links without
      const linksWithPublicVideo = linkWithClicks.filter(link => link.has_public_video);
      const linksWithoutPublicVideo = linkWithClicks.filter(link => !link.has_public_video);

      let autoFeatured;
      if (linksWithPublicVideo.length > 0) {
        // Prefer links with public videos, sorted by click count
        const sortedByClicks = [...linksWithPublicVideo].sort((a, b) => {
          if (b.click_count !== a.click_count) {
            return b.click_count - a.click_count;
          }
          return 0;
        });
        autoFeatured = sortedByClicks[0];
      } else if (linksWithoutPublicVideo.length > 0) {
        // Fallback to links without public videos (no video or non-public video)
        const sortedByClicks = [...linksWithoutPublicVideo].sort((a, b) => {
          if (b.click_count !== a.click_count) {
            return b.click_count - a.click_count;
          }
          return 0;
        });
        autoFeatured = sortedByClicks[0];
      } else {
        // Should not happen since enrichedLinks.length > 0
        autoFeatured = linkWithClicks[0];
      }

      const otherLinks = enrichedLinks.filter(link => link.id !== autoFeatured.id);
      orderedLinks = [autoFeatured, ...otherLinks];
      isAutoFeatured = true;
    }

    // Organize sections with assigned links
    let hubSections = [];
    const hasAssignments = (assignments.results || []).length > 0;

    if (hasAssignments) {
      // Section-based rendering: organize links by section
      const enabledSections = (sections.results || []).filter(s => s.is_enabled === 1);
      
      hubSections = enabledSections.map(section => {
        const sectionAssignments = (assignments.results || []).filter(
          a => a.section_slot === section.section_slot
        );
        const sectionLinks = sectionAssignments.map(assignment => {
          const link = enrichedLinks.find(l => l.id === assignment.link_id);
          return link ? { ...link, display_order: assignment.display_order } : null;
        }).filter(Boolean);

        // Sort by display_order, then by title as fallback
        sectionLinks.sort((a, b) => {
          if (a.display_order !== b.display_order) {
            return a.display_order - b.display_order;
          }
          return (a.title || a.slug || '').localeCompare(b.title || b.slug || '');
        });

        return {
          section_slot: section.section_slot,
          label: section.label,
          slug: section.slug,
          is_enabled: section.is_enabled === 1,
          display_order: section.display_order,
          links: sectionLinks
        };
      }).filter(section => section.links.length > 0); // Only return sections with links
    }

    // Return the hub data with YouTube metadata, settings, and sections
    return new Response(
      JSON.stringify({
        username: user.username,
        display_name: user.display_name,
        subdomain: user.subdomain,
        channel_avatar_url: channelAvatarUrl,
        featured_video: featuredVideo,
        more_videos: moreVideos,
        links: orderedLinks,
        is_auto_featured: isAutoFeatured,
        hub_settings: hubSettings ? {
          creator_tagline: hubSettings.creator_tagline,
          creator_bio: hubSettings.creator_bio,
          featured_title_override: hubSettings.featured_title_override,
          featured_description_override: hubSettings.featured_description_override,
          featured_cta_text: hubSettings.featured_cta_text,
          show_resources: hubSettings.show_resources === 1,
          show_videos: hubSettings.show_videos === 1,
          show_metrics: hubSettings.show_metrics === 1,
          custom_section_title: hubSettings.custom_section_title
        } : null,
        hub_sections: hasAssignments ? hubSections : null
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30' // 30 seconds cache
        }
      }
    );

  } catch (error) {
    console.error('Error fetching public links by subdomain:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
