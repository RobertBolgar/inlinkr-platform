import { sendTransactionalEmail } from './email-helper.js';
import { checkRateLimit, getIpRateLimitKey, createRateLimitResponse, RATE_LIMITS } from './rate-limit-helper.js';

/**
 * Public support form submission endpoint
 * Accepts unauthenticated support requests and sends them via email
 */
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Rate limit by IP to prevent spam
    const ipKey = getIpRateLimitKey(request);
    const rateLimitResult = await checkRateLimit(env, ipKey, RATE_LIMITS.ANONYMOUS_POST);
    
    if (!rateLimitResult.success) {
      return createRateLimitResponse('Too many support requests. Please try again later.');
    }

    // Parse request body
    const body = await request.json();
    const { name, email, category, subject, message, website } = body;

    // Honeypot check - if website field is filled, it's a bot
    if (website && website.trim() !== '') {
      // Return success to fool bots, but don't actually process
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Server-side validation
    const errors = {};

    // Name validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      errors.name = 'Name is required';
    } else if (name.trim().length > 100) {
      errors.name = 'Name is too long';
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      errors.email = 'Email is required';
    } else if (!emailRegex.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    } else if (email.trim().length > 255) {
      errors.email = 'Email is too long';
    }

    // Category validation (whitelist)
    const allowedCategories = ['Account Issues', 'Billing', 'YouTube Connection', 'Smart Links', 'Creator Hub', 'Other'];
    if (!category || typeof category !== 'string' || !allowedCategories.includes(category)) {
      errors.category = 'Please select a valid category';
    }

    // Subject validation
    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      errors.subject = 'Subject is required';
    } else if (subject.trim().length > 200) {
      errors.subject = 'Subject is too long';
    }

    // Message validation
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      errors.message = 'Message is required';
    } else if (message.trim().length < 10) {
      errors.message = 'Message must be at least 10 characters';
    } else if (message.trim().length > 5000) {
      errors.message = 'Message is too long';
    }

    // Return validation errors
    if (Object.keys(errors).length > 0) {
      return new Response(JSON.stringify({ success: false, errors }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Sanitize inputs (basic text sanitization)
    const sanitizedName = name.trim().slice(0, 100);
    const sanitizedEmail = email.trim().slice(0, 255);
    const sanitizedCategory = category;
    const sanitizedSubject = subject.trim().slice(0, 200);
    const sanitizedMessage = message.trim().slice(0, 5000);

    // Get client IP for reference
    const clientIP = request.headers.get('CF-Connecting-IP') || 'Unknown';

    // Send support email to internal support address
    const supportEmail = env.SUPPORT_EMAIL || 'support@tubelinkr.com';
    
    const emailHtml = `
      <h2>TubeLinkr Support Request</h2>
      <p><strong>From:</strong> ${sanitizedName} &lt;${sanitizedEmail}&gt;</p>
      <p><strong>Category:</strong> ${sanitizedCategory}</p>
      <p><strong>Subject:</strong> ${sanitizedSubject}</p>
      <p><strong>IP Address:</strong> ${clientIP}</p>
      <hr>
      <h3>Message:</h3>
      <p>${sanitizedMessage.replace(/\n/g, '<br>')}</p>
    `;

    await sendTransactionalEmail(env, {
      to: supportEmail,
      subject: `[${sanitizedCategory}] ${sanitizedSubject} - TubeLinkr Support`,
      html: emailHtml,
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Support request sent successfully',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Support form submission error:', error);
    
    // Return sanitized error without exposing internal details
    const errorMessage = error.message || 'Failed to send support request';
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
