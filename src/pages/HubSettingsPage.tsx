import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { hasProAccess } from '../lib/plan';
import { buildSmartLinkUrl } from '../lib/smart-link-url';

export function HubSettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [hubSettings, setHubSettings] = useState<any>(null);
  const [youtubeVideos, setYoutubeVideos] = useState<any[]>([]);
  const [hubLoading, setHubLoading] = useState(false);
  const [hubSuccess, setHubSuccess] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [sectionsSuccess, setSectionsSuccess] = useState(false);
  const [sectionsError, setSectionsError] = useState('');
  const [assignableLinks, setAssignableLinks] = useState<any[]>([]);
  const [sectionsWithLinks, setSectionsWithLinks] = useState<any[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsSuccess, setAssignmentsSuccess] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState('');
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const userHasProAccess = hasProAccess(user);

  // Redirect non-Pro users to settings
  useEffect(() => {
    if (user && !userHasProAccess) {
      navigate('/settings');
    }
  }, [user, userHasProAccess, navigate]);

  useEffect(() => {
    const fetchHubSettings = async () => {
      if (!user || !userHasProAccess) return;

      try {
        const clerk = (window as any).Clerk;
        let headers: HeadersInit = { 'Content-Type': 'application/json' };

        if (clerk && clerk.session) {
          const token = await clerk.session.getToken();
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        }

        const response = await fetch('/api/creator-hub-settings', {
          method: 'GET',
          headers,
        });

        if (response.ok) {
          const data = await response.json();
          setHubSettings(data.settings);
          setYoutubeVideos(data.youtube_videos || []);
        }
      } catch (err) {
        console.error('Failed to fetch hub settings:', err);
      }
    };

    fetchHubSettings();
  }, [user, userHasProAccess]);

  useEffect(() => {
    const fetchSections = async () => {
      if (!user || !userHasProAccess) return;

      try {
        const clerk = (window as any).Clerk;
        let headers: HeadersInit = { 'Content-Type': 'application/json' };

        if (clerk && clerk.session) {
          const token = await clerk.session.getToken();
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        }

        const response = await fetch('/api/creator-hub-sections', {
          method: 'GET',
          headers,
        });

        if (response.ok) {
          const data = await response.json();
          setSections(data.sections || []);
        }
      } catch (err) {
        console.error('Failed to fetch sections:', err);
      }
    };

    fetchSections();
  }, [user, userHasProAccess]);

  useEffect(() => {
    const fetchAssignments = async () => {
      if (!user || !userHasProAccess) return;

      try {
        const clerk = (window as any).Clerk;
        let headers: HeadersInit = { 'Content-Type': 'application/json' };

        if (clerk && clerk.session) {
          const token = await clerk.session.getToken();
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        }

        const response = await fetch('/api/creator-hub-link-assignments', {
          method: 'GET',
          headers,
        });

        if (response.ok) {
          const data = await response.json();
          setSectionsWithLinks(data.sections || []);
          setAssignableLinks(data.links || []);
        }
      } catch (err) {
        console.error('Failed to fetch assignments:', err);
      }
    };

    fetchAssignments();
  }, [user, userHasProAccess]);

  const handleSaveHubSettings = async () => {
    setError('');
    setHubSuccess(false);
    setHubLoading(true);

    try {
      const clerk = (window as any).Clerk;
      let headers: HeadersInit = { 'Content-Type': 'application/json' };

      if (clerk && clerk.session) {
        const token = await clerk.session.getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch('/api/creator-hub-settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify(hubSettings),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update hub settings');
      }

      setHubSuccess(true);
      setTimeout(() => setHubSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update hub settings');
    } finally {
      setHubLoading(false);
    }
  };

  const handleSaveSections = async () => {
    setSectionsError('');
    setSectionsSuccess(false);
    setSectionsLoading(true);

    try {
      const clerk = (window as any).Clerk;
      let headers: HeadersInit = { 'Content-Type': 'application/json' };

      if (clerk && clerk.session) {
        const token = await clerk.session.getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      // Sanitize slugs for save (remove leading/trailing dashes)
      const sanitizedSections = sections.map(section => ({
        ...section,
        slug: sanitizeSlugForSave(section.slug || '')
      }));

      const response = await fetch('/api/creator-hub-sections', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ sections: sanitizedSections }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update sections');
      }

      setSectionsSuccess(true);
      setTimeout(() => setSectionsSuccess(false), 3000);
    } catch (err) {
      setSectionsError(err instanceof Error ? err.message : 'Failed to update sections');
    } finally {
      setSectionsLoading(false);
    }
  };

  const updateSection = (sectionSlot: number, field: string, value: any) => {
    setSections(sections.map(section => 
      section.section_slot === sectionSlot 
        ? { ...section, [field]: value }
        : section
    ));
  };

  const handleAddLink = (linkId: number, sectionSlot: number) => {
    setAssignmentsError('');
    
    const linkToAdd = assignableLinks.find(l => Number(l.id) === Number(linkId));
    if (!linkToAdd) return;

    setSectionsWithLinks(prevSections => 
      prevSections.map(section => {
        if (section.section_slot === sectionSlot) {
          const newAssignedLinks = [...(section.assigned_links || []), linkToAdd];
          return { ...section, assigned_links: newAssignedLinks };
        }
        return section;
      })
    );
    
    setHasUnsavedChanges(true);
  };

  const handleRemoveLink = (linkId: number, sectionSlot: number) => {
    setAssignmentsError('');
    
    setSectionsWithLinks(prevSections => 
      prevSections.map(section => {
        if (section.section_slot === sectionSlot) {
          const newAssignedLinks = (section.assigned_links || []).filter(
            (link: any) => Number(link.id) !== Number(linkId)
          );
          return { ...section, assigned_links: newAssignedLinks };
        }
        return section;
      })
    );
    
    setHasUnsavedChanges(true);
  };

  const handleSaveAssignments = async () => {
    setAssignmentsError('');
    setAssignmentsLoading(true);

    try {
      const clerk = (window as any).Clerk;
      let headers: HeadersInit = { 'Content-Type': 'application/json' };

      if (clerk && clerk.session) {
        const token = await clerk.session.getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      // Build sections payload with link_ids arrays
      const sectionsPayload = sectionsWithLinks
        .filter(s => s.is_enabled !== 0)
        .map(section => ({
          section_slot: section.section_slot,
          link_ids: (section.assigned_links || []).map((link: any) => Number(link.id))
        }));

      const response = await fetch('/api/creator-hub-link-assignments', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ sections: sectionsPayload }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save assignments');
      }

      const data = await response.json();
      setSectionsWithLinks(data.sections || []);
      setHasUnsavedChanges(false);
      setAssignmentsSuccess(true);
      setTimeout(() => setAssignmentsSuccess(false), 3000);
    } catch (err) {
      setAssignmentsError(err instanceof Error ? err.message : 'Failed to save assignments');
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const sanitizeSlugForTyping = (value: string): string => {
    // For onChange: allow trailing dash while typing
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
      .slice(0, 40);
  };

  const sanitizeSlugForSave = (value: string): string => {
    // For submit/save: remove leading/trailing dashes
    return sanitizeSlugForTyping(value)
      .replace(/^-|-$/g, '');
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(label);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6 sm:px-6 lg:px-8 overflow-x-hidden space-y-3">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Creator Hub</h1>
            <p className="text-gray-500 mt-0.5 text-sm">Customize your public creator hub, featured content, resources, and jump links.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/settings')}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              Back to Settings
            </button>
            {user?.subdomain && (
              <button
                onClick={() => window.location.href = `/hub/${user.subdomain}`}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                View Public Hub
              </button>
            )}
          </div>
        </div>

        {/* ── CARD: Hub Profile ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Hub Profile</div>

          <div className="space-y-3">
            <div>
              <label htmlFor="creatorTagline" className="block text-xs text-gray-500 mb-1.5">Creator Tagline</label>
              <input
                id="creatorTagline"
                type="text"
                value={hubSettings?.creator_tagline || ''}
                onChange={(e) => setHubSettings({ ...hubSettings, creator_tagline: e.target.value })}
                disabled={hubLoading}
                maxLength={120}
                className="w-full px-4 py-2.5 bg-gray-950 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-600 disabled:opacity-50 text-sm transition-all"
                placeholder="e.g., Tech creator & educator"
              />
              <p className="mt-1 text-xs text-gray-600">{(hubSettings?.creator_tagline || '').length}/120 characters</p>
            </div>

            <div>
              <label htmlFor="creatorBio" className="block text-xs text-gray-500 mb-1.5">Creator Bio</label>
              <textarea
                id="creatorBio"
                value={hubSettings?.creator_bio || ''}
                onChange={(e) => setHubSettings({ ...hubSettings, creator_bio: e.target.value })}
                disabled={hubLoading}
                maxLength={240}
                rows={2}
                className="w-full px-4 py-2.5 bg-gray-950 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-600 disabled:opacity-50 text-sm transition-all resize-none"
                placeholder="Brief description of your content and what you offer"
              />
              <p className="mt-1 text-xs text-gray-600">{(hubSettings?.creator_bio || '').length}/240</p>
            </div>
          </div>
        </div>

        {/* ── CARD: Featured Content ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Featured Content</div>

          <div className="space-y-3">
            <div>
              <label htmlFor="featuredVideo" className="block text-xs text-gray-500 mb-1.5">Featured Video</label>
              {youtubeVideos.length === 0 ? (
                <p className="text-xs text-gray-500">
                  Connect YouTube in <span className="text-blue-400">Settings</span> to select a featured video.
                </p>
              ) : (
                <select
                  id="featuredVideo"
                  value={hubSettings?.featured_video_id || ''}
                  onChange={(e) => setHubSettings({ ...hubSettings, featured_video_id: e.target.value || null })}
                  disabled={hubLoading}
                  className="w-full px-4 py-2.5 bg-gray-950 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-600 disabled:opacity-50 text-sm transition-all"
                >
                  <option value="">No featured video</option>
                  {youtubeVideos.map((video) => (
                    <option key={video.video_id} value={video.video_id}>
                      {video.title}
                    </option>
                  ))}
                </select>
              )}
              <p className="mt-1 text-xs text-gray-600">Select a YouTube video to feature on your hub</p>
            </div>

            <div>
              <label htmlFor="featuredTitle" className="block text-xs text-gray-500 mb-1.5">Featured Title Override</label>
              <input
                id="featuredTitle"
                type="text"
                value={hubSettings?.featured_title_override || ''}
                onChange={(e) => setHubSettings({ ...hubSettings, featured_title_override: e.target.value })}
                disabled={hubLoading}
                maxLength={120}
                className="w-full px-4 py-2.5 bg-gray-950 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-600 disabled:opacity-50 text-sm transition-all"
                placeholder="Override the featured link title"
              />
              <p className="mt-1 text-xs text-gray-600">{(hubSettings?.featured_title_override || '').length}/120 characters</p>
            </div>

            <div>
              <label htmlFor="featuredDescription" className="block text-xs text-gray-500 mb-1.5">Featured Description Override</label>
              <textarea
                id="featuredDescription"
                value={hubSettings?.featured_description_override || ''}
                onChange={(e) => setHubSettings({ ...hubSettings, featured_description_override: e.target.value })}
                disabled={hubLoading}
                maxLength={240}
                rows={2}
                className="w-full px-4 py-2.5 bg-gray-950 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-600 disabled:opacity-50 text-sm transition-all resize-none"
                placeholder="Override the featured link description"
              />
              <p className="mt-1 text-xs text-gray-600">{(hubSettings?.featured_description_override || '').length}/240 characters</p>
            </div>

            <div>
              <label htmlFor="featuredCta" className="block text-xs text-gray-500 mb-1.5">Featured CTA Text</label>
              <input
                id="featuredCta"
                type="text"
                value={hubSettings?.featured_cta_text || ''}
                onChange={(e) => setHubSettings({ ...hubSettings, featured_cta_text: e.target.value })}
                disabled={hubLoading}
                maxLength={40}
                className="w-full px-4 py-2.5 bg-gray-950 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-600 disabled:opacity-50 text-sm transition-all"
                placeholder="e.g., Watch Now, Explore, Learn More"
              />
              <p className="mt-1 text-xs text-gray-600">{(hubSettings?.featured_cta_text || '').length}/40 characters</p>
            </div>
          </div>
        </div>

        {/* ── CARD: Hub Sections ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Hub Sections</div>
          <p className="text-xs text-gray-600 mb-3">Create up to four labeled sections for your public Creator Hub.</p>

          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 px-2">
              <div className="col-span-2">Section</div>
              <div className="col-span-3">Label</div>
              <div className="col-span-3">Slug</div>
              <div className="col-span-2">Enabled</div>
            </div>
            
            {[1, 2, 3, 4].map((slot) => {
              const section = sections.find(s => s.section_slot === slot) || { section_slot: slot, label: '', slug: '', is_enabled: 1 };
              return (
                <div key={slot} className="grid grid-cols-12 gap-2 items-center px-2 py-2 rounded-lg hover:bg-gray-800/30 transition-colors">
                  <div className="col-span-2 text-xs text-gray-400 font-medium">Section {slot}</div>
                  
                  <div className="col-span-3">
                    <input
                      id={`section-${slot}-label`}
                      type="text"
                      value={section.label || ''}
                      onChange={(e) => updateSection(slot, 'label', e.target.value)}
                      disabled={sectionsLoading}
                      maxLength={40}
                      className="w-full px-2 py-1.5 bg-gray-950 border border-gray-700 rounded-md text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-600 disabled:opacity-50 text-xs transition-all"
                      placeholder="Tools"
                    />
                  </div>

                  <div className="col-span-3">
                    <input
                      id={`section-${slot}-slug`}
                      type="text"
                      value={section.slug || ''}
                      onChange={(e) => updateSection(slot, 'slug', sanitizeSlugForTyping(e.target.value))}
                      disabled={sectionsLoading}
                      maxLength={40}
                      className="w-full px-2 py-1.5 bg-gray-950 border border-gray-700 rounded-md text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-600 disabled:opacity-50 text-xs transition-all"
                      placeholder="tools"
                    />
                  </div>

                  <div className="col-span-2 flex items-center">
                    <input
                      id={`section-${slot}-enabled`}
                      type="checkbox"
                      checked={section.is_enabled !== 0}
                      onChange={(e) => updateSection(slot, 'is_enabled', e.target.checked ? 1 : 0)}
                      disabled={sectionsLoading}
                      className="w-4 h-4 rounded border-gray-700 bg-gray-950 text-blue-600 focus:ring-blue-600 focus:ring-offset-gray-900"
                    />
                  </div>
                </div>
              );
            })}

            {sectionsError && (
              <div className="px-4 py-2.5 bg-red-900/20 border border-red-800/50 rounded-lg">
                <p className="text-sm text-red-400">{sectionsError}</p>
              </div>
            )}

            {sectionsSuccess && (
              <div className="px-4 py-2.5 bg-green-900/20 border border-green-800/50 rounded-lg">
                <p className="text-sm text-green-400">Sections updated successfully!</p>
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveSections}
              disabled={sectionsLoading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {sectionsLoading ? 'Saving...' : 'Save Sections'}
            </button>
          </div>
        </div>

        {/* ── CARD: Hub Resources ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Hub Resources</div>
          <p className="text-xs text-gray-600 mb-3">Assign your existing TubeLinkr links to Creator Hub sections.</p>
          <p className="text-xs text-gray-500 mb-3">Video links appear automatically in More Videos. Resource sections are for non-video links.</p>

          {hasUnsavedChanges && (
            <div className="px-4 py-2.5 bg-yellow-900/20 border border-yellow-800/50 rounded-lg mb-3">
              <p className="text-sm text-yellow-400">You have unsaved resource changes.</p>
            </div>
          )}

          {assignmentsError && (
            <div className="px-4 py-2.5 bg-red-900/20 border border-red-800/50 rounded-lg mb-3">
              <p className="text-sm text-red-400">{assignmentsError}</p>
            </div>
          )}

          {assignmentsSuccess && (
            <div className="px-4 py-2.5 bg-green-900/20 border border-green-800/50 rounded-lg mb-3">
              <p className="text-sm text-green-400">Assignments saved successfully!</p>
            </div>
          )}

          <div className="space-y-3">
            {sectionsWithLinks.filter(s => s.is_enabled !== 0).map((section) => (
              <div key={section.section_slot} className="border border-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-white">
                    {section.label || `Section ${section.section_slot}`} <span className="text-gray-500">({section.assigned_links?.length || 0})</span>
                  </div>
                  <select
                    value=""
                    onChange={(e) => {
                      const linkId = parseInt(e.target.value);
                      if (linkId) {
                        handleAddLink(linkId, section.section_slot);
                        e.target.value = '';
                      }
                    }}
                    disabled={assignmentsLoading}
                    className="px-2 py-1.5 bg-gray-950 border border-gray-700 rounded-md text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-600 disabled:opacity-50 transition-all"
                  >
                    <option value="">Add Link</option>
                    {assignableLinks
                      .filter(link => !section.assigned_links?.some((assigned: any) => Number(assigned.id) === Number(link.id)))
                      .map((link) => (
                      <option key={link.id} value={link.id}>
                        {link.title || link.slug}
                      </option>
                    ))}
                  </select>
                </div>

                {section.assigned_links && section.assigned_links.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {section.assigned_links.map((link: any) => (
                      <div 
                        key={link.id} 
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-800/50 border border-gray-700"
                      >
                        <div className="text-xs text-white truncate max-w-[150px]">{link.title || link.slug}</div>
                        <button
                          onClick={() => handleRemoveLink(link.id, section.section_slot)}
                          disabled={assignmentsLoading}
                          className="text-gray-500 hover:text-red-400 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-600 italic">
                    No links assigned
                  </div>
                )}
              </div>
            ))}

            {assignableLinks.length === 0 && (
              <div className="text-center py-4 text-gray-500 text-xs">
                No links available. Create links to assign them to sections.
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveAssignments}
              disabled={assignmentsLoading || !hasUnsavedChanges}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {assignmentsLoading ? 'Saving...' : 'Save Resource Assignments'}
            </button>
          </div>
        </div>

        {/* ── CARD: Display Options ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Display Options</div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                id="showMetrics"
                type="checkbox"
                checked={hubSettings?.show_metrics !== 0}
                onChange={(e) => setHubSettings({ ...hubSettings, show_metrics: e.target.checked ? 1 : 0 })}
                disabled={hubLoading}
                className="w-4 h-4 rounded border-gray-700 bg-gray-950 text-blue-600 focus:ring-blue-600 focus:ring-offset-gray-900"
              />
              <label htmlFor="showMetrics" className="text-sm text-gray-300">Show metrics strip on public hub</label>
            </div>
          </div>
        </div>

        {/* ── CARD: Public Hub Links ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Public Hub Links</div>

          <div className="space-y-4">
            {user?.subdomain ? (
              <>
                <div className="flex items-center justify-between p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 mb-1">Main Hub URL</div>
                    <div className="text-sm text-white truncate">{buildSmartLinkUrl({ slug: '', username: user?.username }, user).replace(/\/$/, '')}</div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <button
                      onClick={() => window.location.href = `/hub/${user.subdomain}`}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleCopy(buildSmartLinkUrl({ slug: '', username: user?.username }, user).replace(/\/$/, ''), 'hub')}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      {copySuccess === 'hub' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                {sectionsWithLinks.filter(s => s.is_enabled !== 0 && s.slug).length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-500">Section Jump Links</div>
                    {sectionsWithLinks.filter(s => s.is_enabled !== 0 && s.slug).map((section) => (
                      <div key={section.section_slot} className="flex items-center justify-between p-2 bg-gray-800/30 border border-gray-700/50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-400">{section.label || `Section ${section.section_slot}`}</div>
                          <div className="text-sm text-white truncate">{buildSmartLinkUrl({ slug: '', username: user?.username }, user).replace(/\/$/, '')}/#{section.slug}</div>
                        </div>
                        <button
                          onClick={() => handleCopy(`${buildSmartLinkUrl({ slug: '', username: user?.username }, user).replace(/\/$/, '')}/#${section.slug}`, section.label || `section-${section.section_slot}`)}
                          className="ml-3 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          {copySuccess === (section.label || `section-${section.section_slot}`) ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4 text-gray-500 text-xs">
                Set up a subdomain to enable public hub links.
              </div>
            )}
          </div>
        </div>

        {/* ── CARD: Actions ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Actions</div>

          <div className="space-y-3">
            {error && (
              <div className="px-4 py-2.5 bg-red-900/20 border border-red-800/50 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {hubSuccess && (
              <div className="px-4 py-2.5 bg-green-900/20 border border-green-800/50 rounded-lg">
                <p className="text-sm text-green-400">Hub settings updated successfully!</p>
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveHubSettings}
              disabled={hubLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {hubLoading ? 'Saving...' : 'Save Hub Settings'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
