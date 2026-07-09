import { getAuthenticatedUser } from './auth-helper.js';
import { sendTransactionalEmail } from './email-helper.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Get authenticated user
    const user = await getAuthenticatedUser(request, env);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Use email from authenticated user record
    const userEmail = user.email;

    if (!userEmail) {
      return new Response(JSON.stringify({ error: 'No email found for authenticated user' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Send test email
    await sendTransactionalEmail(env, {
      to: userEmail,
      subject: 'TubeLinkr email test',
      html: '<p>Transactional email is working for TubeLinkr.</p>',
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Test email sent successfully',
      to: userEmail,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Test email error:', error);
    // Return sanitized error without exposing API key
    const errorMessage = error.message || 'Failed to send test email';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
