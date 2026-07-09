import { getAuthenticatedUser } from './auth-helper.js';
import { hasEffectiveProAccess } from './entitlement-helper.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'GET') {
    return await getAssignments(context);
  } else if (request.method === 'PUT') {
    return await updateAssignments(context);
  } else {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function getAssignments(context) {
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

    // Get sections for the user
    const sections = await env.DB.prepare(
      'SELECT id, user_id, section_slot, label, slug, is_enabled, display_order FROM creator_hub_sections WHERE user_id = ? ORDER BY display_order ASC, section_slot ASC'
    ).bind(authUser.id).all();

    // Get active non-system links for the user
    const links = await env.DB.prepare(
      'SELECT id, slug, title, subtitle, video_id FROM links WHERE user_id = ? AND is_active = 1 AND COALESCE(is_system, 0) = 0 ORDER BY created_at DESC'
    ).bind(authUser.id).all();

    // Get existing assignments
    const assignments = await env.DB.prepare(
      'SELECT id, user_id, link_id, section_slot, display_order, is_active FROM creator_hub_link_assignments WHERE user_id = ? AND is_active = 1 ORDER BY section_slot ASC, display_order ASC'
    ).bind(authUser.id).all();

    // Organize assignments by section
    const sectionsWithLinks = (sections.results || []).map(section => {
      const sectionAssignments = (assignments.results || []).filter(
        a => a.section_slot === section.section_slot
      );
      const assignedLinks = sectionAssignments.map(assignment => {
        const link = (links.results || []).find(l => l.id === assignment.link_id);
        return link ? { ...link, assignment_id: assignment.id, display_order: assignment.display_order } : null;
      }).filter(Boolean);

      return {
        ...section,
        assigned_links: assignedLinks
      };
    });

    return new Response(
      JSON.stringify({
        sections: sectionsWithLinks,
        links: links.results || []
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching creator hub link assignments:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch assignments' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function updateAssignments(context) {
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
        JSON.stringify({ error: 'sections array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const validSlots = [1, 2, 3, 4];
    const now = new Date().toISOString();
    const normalizedUserId = Number(authUser.id);

    // Validate sections and collect all link_ids
    const allLinkIds = new Set();
    const sectionData = [];

    for (const section of sections) {
      const sectionSlot = Number(section.section_slot);
      const linkIds = (section.link_ids || []).map((id) => Number(id));

      if (!validSlots.includes(sectionSlot)) {
        return new Response(
          JSON.stringify({ error: `Invalid section_slot: ${section.section_slot}. Must be 1, 2, 3, or 4` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (!Array.isArray(linkIds)) {
        return new Response(
          JSON.stringify({ error: `link_ids must be an array for section ${sectionSlot}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Dedupe link_ids within same section
      const uniqueLinkIds = [...new Set(linkIds)];
      sectionData.push({ section_slot: sectionSlot, link_ids: uniqueLinkIds });
      uniqueLinkIds.forEach(id => allLinkIds.add(id));
    }

    // Verify all links belong to user, are active, and not system
    if (allLinkIds.size > 0) {
      const linkIdsArray = Array.from(allLinkIds);
      const placeholders = linkIdsArray.map(() => '?').join(',');
      
      const links = await env.DB.prepare(
        `SELECT id, user_id, is_active, is_system, video_id FROM links WHERE id IN (${placeholders})`
      ).bind(...linkIdsArray).all();

      const foundLinkIds = new Set((links.results || []).map(l => Number(l.id)));

      for (const linkId of linkIdsArray) {
        const link = (links.results || []).find(l => Number(l.id) === linkId);
        
        if (!link) {
          return new Response(
            JSON.stringify({ error: `Link not found: ${linkId}` }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (link.user_id !== normalizedUserId) {
          return new Response(
            JSON.stringify({ error: `You do not own link ${linkId}` }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (link.is_active !== 1) {
          return new Response(
            JSON.stringify({ error: `Link ${linkId} is inactive` }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (link.is_system === 1) {
          return new Response(
            JSON.stringify({ error: `Link ${linkId} is a system link` }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Delete all existing assignments for this user
    await env.DB.prepare(
      'DELETE FROM creator_hub_link_assignments WHERE user_id = ?'
    ).bind(normalizedUserId).run();

    // Insert new assignments
    for (const section of sectionData) {
      for (let i = 0; i < section.link_ids.length; i++) {
        const linkId = section.link_ids[i];
        const displayOrder = i + 1;
        
        await env.DB.prepare(
          'INSERT INTO creator_hub_link_assignments (user_id, link_id, section_slot, display_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)'
        ).bind(normalizedUserId, linkId, section.section_slot, displayOrder, now, now).run();
      }
    }

    // Fetch updated data
    const dbSections = await env.DB.prepare(
      'SELECT id, user_id, section_slot, label, slug, is_enabled, display_order FROM creator_hub_sections WHERE user_id = ? ORDER BY display_order ASC, section_slot ASC'
    ).bind(normalizedUserId).all();

    const dbLinks = await env.DB.prepare(
      'SELECT id, slug, title, subtitle, video_id FROM links WHERE user_id = ? AND is_active = 1 AND COALESCE(is_system, 0) = 0 ORDER BY created_at DESC'
    ).bind(normalizedUserId).all();

    const dbAssignments = await env.DB.prepare(
      'SELECT id, user_id, link_id, section_slot, display_order, is_active FROM creator_hub_link_assignments WHERE user_id = ? AND is_active = 1 ORDER BY section_slot ASC, display_order ASC'
    ).bind(normalizedUserId).all();

    // Organize assignments by section
    const sectionsWithLinks = (dbSections.results || []).map(section => {
      const sectionAssignments = (dbAssignments.results || []).filter(
        a => a.section_slot === section.section_slot
      );
      const assignedLinks = sectionAssignments.map(assignment => {
        const link = (dbLinks.results || []).find(l => l.id === assignment.link_id);
        return link ? { ...link, assignment_id: assignment.id, display_order: assignment.display_order } : null;
      }).filter(Boolean);

      return {
        ...section,
        assigned_links: assignedLinks
      };
    });

    return new Response(
      JSON.stringify({
        sections: sectionsWithLinks,
        links: dbLinks.results || []
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating creator hub link assignments:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update assignments' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
