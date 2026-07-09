import { getAuthenticatedUser } from './auth-helper.js';
import { hasEffectiveProAccess } from './entitlement-helper.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'GET') {
    return await getSections(context);
  } else if (request.method === 'PUT') {
    return await updateSections(context);
  } else {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function getSections(context) {
  const { request, env } = context;

  try {
    // Get authenticated user
    const authUser = await getAuthenticatedUser(request, env);

    if (!authUser) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check effective Pro access (paid Pro, referral Pro, or Founder)
    const userHasEffectiveProAccess = hasEffectiveProAccess(authUser);
    if (!userHasEffectiveProAccess) {
      return new Response(
        JSON.stringify({ error: 'Pro access required' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get existing sections for the user
    const sections = await env.DB.prepare(
      'SELECT id, user_id, section_slot, label, slug, is_enabled, display_order, created_at, updated_at FROM creator_hub_sections WHERE user_id = ? ORDER BY display_order ASC, section_slot ASC'
    ).bind(authUser.id).all();

    // If no sections exist, create default sections
    if (!sections.results || sections.results.length === 0) {
      const defaultSections = [
        { section_slot: 1, label: 'Tools', slug: 'tools', is_enabled: 1, display_order: 1 },
        { section_slot: 2, label: 'Gear', slug: 'gear', is_enabled: 1, display_order: 2 },
        { section_slot: 3, label: 'Projects', slug: 'projects', is_enabled: 1, display_order: 3 },
        { section_slot: 4, label: 'Downloads', slug: 'downloads', is_enabled: 1, display_order: 4 },
      ];

      const now = new Date().toISOString();

      for (const section of defaultSections) {
        await env.DB.prepare(
          'INSERT INTO creator_hub_sections (user_id, section_slot, label, slug, is_enabled, display_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(authUser.id, section.section_slot, section.label, section.slug, section.is_enabled, section.display_order, now, now).run();
      }

      // Fetch the newly created sections
      const newSections = await env.DB.prepare(
        'SELECT id, user_id, section_slot, label, slug, is_enabled, display_order, created_at, updated_at FROM creator_hub_sections WHERE user_id = ? ORDER BY display_order ASC, section_slot ASC'
      ).bind(authUser.id).all();

      return new Response(
        JSON.stringify({ sections: newSections.results || [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ sections: sections.results || [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching creator hub sections:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch sections' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function updateSections(context) {
  const { request, env } = context;

  try {
    // Get authenticated user
    const authUser = await getAuthenticatedUser(request, env);

    if (!authUser) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check effective Pro access (paid Pro, referral Pro, or Founder)
    const userHasEffectiveProAccess = hasEffectiveProAccess(authUser);
    if (!userHasEffectiveProAccess) {
      return new Response(
        JSON.stringify({ error: 'Pro access required' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { sections } = body;

    if (!sections || !Array.isArray(sections)) {
      return new Response(
        JSON.stringify({ error: 'Sections array required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (sections.length > 4) {
      return new Response(
        JSON.stringify({ error: 'Maximum 4 sections allowed' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const validSlots = [1, 2, 3, 4];
    const usedSlots = new Set();
    const slugs = new Set();
    const now = new Date().toISOString();

    // Validate each section
    for (const section of sections) {
      const { section_slot, label, slug, is_enabled, display_order } = section;

      // Validate section_slot
      if (!validSlots.includes(section_slot)) {
        return new Response(
          JSON.stringify({ error: `Invalid section_slot: ${section_slot}. Must be 1, 2, 3, or 4` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check for duplicate slots
      if (usedSlots.has(section_slot)) {
        return new Response(
          JSON.stringify({ error: `Duplicate section_slot: ${section_slot}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      usedSlots.add(section_slot);

      // Validate label length
      if (label && label.length > 40) {
        return new Response(
          JSON.stringify({ error: 'Label must be 40 characters or less' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Validate slug length
      if (slug && slug.length > 40) {
        return new Response(
          JSON.stringify({ error: 'Slug must be 40 characters or less' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Normalize slug if provided
      let normalizedSlug = null;
      if (slug && slug.trim()) {
        normalizedSlug = slug
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
          .replace(/-+/g, '-');

        // Check for duplicate slugs
        if (slugs.has(normalizedSlug)) {
          return new Response(
            JSON.stringify({ error: `Duplicate slug: ${normalizedSlug}` }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        slugs.add(normalizedSlug);
      }

      // Check for duplicate slugs in database (excluding current slot)
      if (normalizedSlug) {
        const existing = await env.DB.prepare(
          'SELECT id FROM creator_hub_sections WHERE user_id = ? AND slug = ? AND section_slot != ?'
        ).bind(authUser.id, normalizedSlug, section_slot).first();

        if (existing) {
          return new Response(
            JSON.stringify({ error: `Slug already in use: ${normalizedSlug}` }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      // Update or insert the section
      const existingSection = await env.DB.prepare(
        'SELECT id FROM creator_hub_sections WHERE user_id = ? AND section_slot = ?'
      ).bind(authUser.id, section_slot).first();

      if (existingSection) {
        await env.DB.prepare(
          'UPDATE creator_hub_sections SET label = ?, slug = ?, is_enabled = ?, display_order = ?, updated_at = ? WHERE user_id = ? AND section_slot = ?'
        ).bind(label || null, normalizedSlug, is_enabled !== undefined ? (is_enabled ? 1 : 0) : 1, display_order || 0, now, authUser.id, section_slot).run();
      } else {
        await env.DB.prepare(
          'INSERT INTO creator_hub_sections (user_id, section_slot, label, slug, is_enabled, display_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(authUser.id, section_slot, label || null, normalizedSlug, is_enabled !== undefined ? (is_enabled ? 1 : 0) : 1, display_order || 0, now, now).run();
      }
    }

    // Fetch updated sections
    const updatedSections = await env.DB.prepare(
      'SELECT id, user_id, section_slot, label, slug, is_enabled, display_order, created_at, updated_at FROM creator_hub_sections WHERE user_id = ? ORDER BY display_order ASC, section_slot ASC'
    ).bind(authUser.id).all();

    return new Response(
      JSON.stringify({ sections: updatedSections.results || [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating creator hub sections:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update sections' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
