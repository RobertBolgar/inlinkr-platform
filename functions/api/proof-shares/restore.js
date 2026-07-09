import { getAuthenticatedUser } from '../auth-helper.js';

/**
 * Restore a disabled proof share
 * 
 * POST /api/proof-shares/restore
 * 
 * Body:
 * {
 *   public_token: string
 * }
 * 
 * Returns:
 * {
 *   success: true
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

    const body = await request.json();
    const { public_token } = body;

    if (!public_token) {
      return new Response(JSON.stringify({ error: 'public_token is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify proof belongs to authenticated user
    const proofShare = await env.DB.prepare(
      `SELECT id, user_id, is_enabled FROM proof_shares WHERE public_token = ?`
    ).bind(public_token).first();

    if (!proofShare) {
      return new Response(JSON.stringify({ error: 'Proof not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (proofShare.user_id !== authUser.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Restore proof by setting is_enabled = 1
    await env.DB.prepare(
      `UPDATE proof_shares SET is_enabled = 1 WHERE id = ?`
    ).bind(proofShare.id).run();

    return new Response(JSON.stringify({
      success: true
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error restoring proof share:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
