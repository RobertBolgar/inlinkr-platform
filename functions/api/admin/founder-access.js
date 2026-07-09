import { getAuthenticatedUser } from '../auth-helper.js';
import { sendTransactionalEmail } from '../email-helper.js';

/**
 * Admin endpoint for manual Founder Access management
 * 
 * SECURITY REQUIREMENTS (ALL must pass for production access):
 * 1. Authenticated user with valid Clerk JWT
 * 2. User email must match ADMIN_EMAIL_ALLOWLIST
 * 3. Valid ADMIN_TEST_KEY header
 * 
 * USAGE (set ADMIN_EMAIL_ALLOWLIST and ADMIN_TEST_KEY in your environment):
 * 
 * # Check founder status:
 * curl -X POST https://tubelinkr.com/api/admin/founder-access \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_CLERK_JWT" \
 *   -H "x-admin-test-key: YOUR_ADMIN_TEST_KEY" \
 *   -d '{"action": "status", "email": "user@example.com"}'
 * 
 * # Grant founder access (comped, does not count toward 50-paid cap):
 * curl -X POST https://tubelinkr.com/api/admin/founder-access \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_CLERK_JWT" \
 *   -H "x-admin-test-key: YOUR_ADMIN_TEST_KEY" \
 *   -d '{"action": "grant", "email": "user@example.com"}'
 * 
 * # Revoke founder access:
 * curl -X POST https://tubelinkr.com/api/admin/founder-access \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_CLERK_JWT" \
 *   -H "x-admin-test-key: YOUR_ADMIN_TEST_KEY" \
 *   -d '{"action": "revoke", "email": "user@example.com"}'
 */

export async function onRequest(context) {
  const { request, env } = context;

  // SAFEGUARD A: Verify authenticated user
  const user = await getAuthenticatedUser(request, env);
  if (!user) {
    console.warn('ADMIN FOUNDER-ACCESS: Unauthorized - no valid authenticated user');
    return new Response(JSON.stringify({ error: 'Unauthorized - authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // SAFEGUARD B: Verify admin email allowlist
  if (!env.ADMIN_EMAIL_ALLOWLIST) {
    console.error('ADMIN FOUNDER-ACCESS: ADMIN_EMAIL_ALLOWLIST not configured');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const allowedEmails = env.ADMIN_EMAIL_ALLOWLIST.split(',').map(e => e.trim().toLowerCase());
  if (!allowedEmails.includes(user.email.toLowerCase())) {
    console.warn(`ADMIN FOUNDER-ACCESS: Forbidden - user email ${user.email} not in allowlist`);
    return new Response(JSON.stringify({ error: 'Forbidden - admin access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // SAFEGUARD C: Verify admin test key
  const adminKey = request.headers.get('x-admin-test-key');
  if (!adminKey || adminKey !== env.ADMIN_TEST_KEY) {
    console.warn(`ADMIN FOUNDER-ACCESS: Unauthorized - invalid admin key from user ${user.email}`);
    return new Response(JSON.stringify({ error: 'Unauthorized - invalid admin key' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Log authorized access
  console.log(`ADMIN FOUNDER-ACCESS: Authorized access by ${user.email}`);

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { action, email } = await request.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!action || !['status', 'grant', 'revoke'].includes(action)) {
      return new Response(JSON.stringify({ error: 'action must be "status", "grant", or "revoke"' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Find user by email
    const user = await env.DB.prepare(
      'SELECT id, email, username FROM users WHERE email = ? AND is_active = 1'
    ).bind(email).first();

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check current founder access status
    const founderAccess = await env.DB.prepare(
      'SELECT id, is_comped, granted_at, source FROM founder_access WHERE user_id = ?'
    ).bind(user.id).first();

    const hasFounderAccess = !!founderAccess;

    if (action === 'status') {
      // Return current founder status
      return new Response(JSON.stringify({
        success: true,
        action: 'status',
        user: {
          id: user.id,
          email: user.email,
          username: user.username
        },
        founderAccess: hasFounderAccess ? {
          is_comped: founderAccess.is_comped === 1,
          granted_at: founderAccess.granted_at,
          source: founderAccess.source
        } : null
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'grant') {
      // Grant founder access (comped)
      const now = new Date().toISOString();
      
      await env.DB.prepare(`
        INSERT OR IGNORE INTO founder_access 
        (user_id, is_comped, source, granted_at, granted_by)
        VALUES (?, 1, 'admin_comp', ?, 'admin_dev')
      `).bind(user.id, now).run();

      // Refresh founder status
      const refreshed = await env.DB.prepare(
        'SELECT id, is_comped, granted_at, source FROM founder_access WHERE user_id = ?'
      ).bind(user.id).first();

      console.log(`ADMIN FOUNDER-ACCESS: Granted founder access to user ${user.email} (id: ${user.id}) by admin ${user.email}`);

      // Send Founder welcome email
      try {
        // Fetch user email and first_name for personalization
        const userData = await env.DB.prepare(
          'SELECT email, first_name, founder_welcome_email_sent_at FROM users WHERE id = ?'
        ).bind(user.id).first();

        if (userData && userData.email && !userData.founder_welcome_email_sent_at) {
          const firstName = userData.first_name || 'there';

          await sendTransactionalEmail(env, {
            to: userData.email,
            subject: 'Welcome, Founder 🎉',
            html: `
              <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
                <h2>Welcome, ${firstName} 🎉</h2>
                <p>Founder Access Activated</p>

                <p>Thank you for supporting TubeLinkr early.</p>

                <p>Founder members help shape the future of the platform, and your support directly helps us continue building creator tools.</p>

                <p>Your Founder access is now active.</p>

                <p>You now have access to:</p>

                <ul>
                  <li>✓ Creator Hub</li>
                  <li>✓ Branded creator links</li>
                  <li>✓ Video attribution insights</li>
                  <li>✓ Advanced analytics</li>
                  <li>✓ Founder status</li>
                </ul>

                <p><strong>Next steps:</strong></p>

                <ol>
                  <li>Finish your TubeLinkr setup if needed</li>
                  <li>Connect your YouTube channel</li>
                  <li>Customize your Creator Hub</li>
                  <li>Set up your branded creator link</li>
                </ol>

                <p>After you complete the core setup, TubeLinkr will guide you through your Founder creator tools automatically.</p>

                <p>
                  <a href="https://tubelinkr.com/dashboard"
                     style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">
                    Open Your Dashboard
                  </a>
                </p>

                <p>— TubeLinkr</p>
              </div>
            `
          });

          // Update founder_welcome_email_sent_at after successful send
          await env.DB.prepare(
            'UPDATE users SET founder_welcome_email_sent_at = ? WHERE id = ?'
          ).bind(new Date().toISOString(), user.id).run();

          console.log(`ADMIN FOUNDER-ACCESS: Founder welcome email sent to user ${user.email} (id: ${user.id})`);
        }
      } catch (emailError) {
        // Log error but don't break admin workflow
        console.error('ADMIN FOUNDER-ACCESS: Failed to send Founder welcome email:', emailError);
      }

      return new Response(JSON.stringify({
        success: true,
        action: 'grant',
        user: {
          id: user.id,
          email: user.email,
          username: user.username
        },
        founderAccess: refreshed ? {
          is_comped: refreshed.is_comped === 1,
          granted_at: refreshed.granted_at,
          source: refreshed.source
        } : null,
        message: 'Founder access granted (comped, does not count toward 50-paid cap)'
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'revoke') {
      // Revoke founder access
      await env.DB.prepare(
        'DELETE FROM founder_access WHERE user_id = ?'
      ).bind(user.id).run();

      console.log(`ADMIN FOUNDER-ACCESS: Revoked founder access from user ${user.email} (id: ${user.id}) by admin ${user.email}`);

      return new Response(JSON.stringify({
        success: true,
        action: 'revoke',
        user: {
          id: user.id,
          email: user.email,
          username: user.username
        },
        founderAccess: null,
        message: 'Founder access revoked'
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Admin founder-access error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
