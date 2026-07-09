import { getAuthenticatedUser } from '../auth-helper.js';

/**
 * Disable a proof share by token
 * 
 * POST /api/proof-shares/disable
 * 
 * Request body:
 * {
 *   public_token: string
 * }
 * 
 * Response:
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

    const { public_token } = await request.json();

    if (!public_token) {
      return new Response(JSON.stringify({ error: 'public_token is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify proof belongs to authenticated user
    const proof = await env.DB.prepare(
      'SELECT id, user_id FROM proof_shares WHERE public_token = ?'
    ).bind(public_token).first();

    if (!proof) {
      return new Response(JSON.stringify({ error: 'Proof not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (proof.user_id !== authUser.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Disable the proof (set is_enabled = 0)
    await env.DB.prepare(
      'UPDATE proof_shares SET is_enabled = 0 WHERE public_token = ?'
    ).bind(public_token).run();

    return new Response(JSON.stringify({
      success: true
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error disabling proof share:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
