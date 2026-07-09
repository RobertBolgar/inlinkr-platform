/**
 * Send a transactional email using Resend API
 * @param {Object} env - Cloudflare environment variables
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML content
 * @returns {Promise<Object>} - Resend API response
 */
export async function sendTransactionalEmail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'TubeLinkr <hello@notify.tubelinkr.com>',
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Resend API error: ${response.status} ${errorData}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending transactional email:', error.message);
    throw error;
  }
}
