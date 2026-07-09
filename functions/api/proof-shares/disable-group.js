import { getAuthenticatedUser } from '../auth-helper.js';

/**
 * Disable all active proofs in a group by proof_group_key
 *
 * POST /api/proof-shares/disable-group
 *
 * Request body:
 * {
 *   proof_group_key: string
 * }
 *
 * Response:
 * {
 *   success: true,
 *   disabled_count: number
 * }
 */

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Require authenticated user
    const authUser = await getAuthenticatedUser(request, env);
    if (!authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { proof_group_key } = await request.json();

    if (!proof_group_key) {
      return new Response(JSON.stringify({ error: 'proof_group_key is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Disable all active proofs in the group for the authenticated user
    const result = await env.DB.prepare(
      'UPDATE proof_shares SET is_enabled = 0 WHERE user_id = ? AND proof_group_key = ? AND is_enabled = 1'
    ).bind(authUser.id, proof_group_key).run();

    const disabledCount = result.meta.changes || 0;

    return new Response(JSON.stringify({
      success: true,
      disabled_count: disabledCount
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error disabling proof group:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
