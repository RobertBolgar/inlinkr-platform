import { sendTransactionalEmail } from '../email-helper.js';
import { getFeatureFlag, captureReferralOnSignup, checkAndGrantReferralRewards } from '../referral-helper.js';
import { getAuthenticatedUserForSync } from '../auth-helper.js';
import { logActivityEvent } from '../activity-helper.js';

// Helper function to normalize referred_by values for consistent comparison
function normalizeReferredBy(referredBy) {
  if (!referredBy || referredBy === null) {
    return null;
  }
  // Convert to string, then to integer to handle both "8.0" and "8" consistently
  return String(parseInt(referredBy));
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Verify JWT authentication first - do not trust body-provided identity
    const authenticatedUser = await getAuthenticatedUserForSync(request, env);
    if (!authenticatedUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Extract body fields - clerk_user_id from body is optional and must match authenticated user
    // Email from body is NOT trusted - will be fetched from Clerk API
    const { clerk_user_id: bodyClerkUserId, first_name: requestFirstName, referralCode } = await request.json();
    const now = new Date().toISOString();

    // Use authenticated user's clerk_user_id as the source of truth
    const clerkUserId = authenticatedUser.clerk_user_id;

    // If body provides clerk_user_id, verify it matches for compatibility
    if (bodyClerkUserId && bodyClerkUserId !== clerkUserId) {
      return new Response(
        JSON.stringify({ error: 'User ID mismatch' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch email and first_name from Clerk API as the source of truth
    let email = null;
    let firstName = requestFirstName;
    if (clerkUserId) {
      try {
        const clerkResponse = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, {
          headers: {
            'Authorization': `Bearer ${env.CLERK_SECRET_KEY}`,
          },
        });
        if (clerkResponse.ok) {
          const clerkData = await clerkResponse.json();
          email = clerkData.email_addresses?.[0]?.email_address || null;
          if (!firstName) {
            firstName = clerkData.first_name || null;
          }
        }
      } catch (clerkError) {
        // Log error but continue with null email/first_name
        console.error('Failed to fetch user data from Clerk API:', clerkError);
      }
    }

    // If email could not be fetched from Clerk, reject the request
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Unable to verify email from Clerk' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Extract email local part for personalization fallback (e.g., silentshavings@gmail.com -> "Silentshavings")
    const emailLocalPart = email.split('@')[0];
    const emailLocalPartCapitalized = emailLocalPart.charAt(0).toUpperCase() + emailLocalPart.slice(1);
    
    // Check if user already exists by clerk_user_id
    let user = await env.DB.prepare(
      `SELECT 
        u.id, u.email, u.username, u.display_name, u.clerk_user_id, u.first_name, u.created_at, u.updated_at, 
        u.is_active, u.username_confirmed_by_user, u.plan, u.subscription_status, u.subscription_current_period_end, 
        u.stripe_customer_id, u.referral_reward_active, u.referral_reward_plan, u.referral_reward_expires_at, 
        u.subdomain, u.referred_by,
        EXISTS(SELECT 1 FROM founder_access WHERE user_id = u.id) as has_founder_access
       FROM users u
       WHERE u.clerk_user_id = ?`
    ).bind(clerkUserId).first();

    if (user) {
      // Check for expired referral rewards and downgrade if necessary (new model only - Phase 2C-2)
      const newModelExpired = user.referral_reward_active &&
        user.referral_reward_expires_at &&
        new Date(user.referral_reward_expires_at) < new Date();

      if (newModelExpired) {
        console.log("[REFERRAL EXPIRATION] Expired referral reward for user");

        await env.DB.prepare(`
          UPDATE users
          SET referral_reward_active = 0,
              referral_reward_plan = NULL,
              referral_reward_expires_at = NULL
          WHERE id = ?
        `).bind(user.id).run();

        user.referral_reward_active = 0;
        user.referral_reward_plan = null;
        user.referral_reward_expires_at = null;
      }

      // Update existing user
      await env.DB.prepare(
        'UPDATE users SET email = ?, updated_at = ? WHERE clerk_user_id = ?'
      ).bind(email, now, clerkUserId).run();

      // Update first_name if missing and Clerk has one
      if (!user.first_name && firstName) {
        await env.DB.prepare(
          'UPDATE users SET first_name = ?, updated_at = ? WHERE clerk_user_id = ?'
        ).bind(firstName, now, clerkUserId).run();
        user.first_name = firstName;
      }

      // Capture referral for existing user if they have no referred_by and referralCode is provided
      try {
        const normalizedReferredBy = normalizeReferredBy(user.referred_by);
        if (referralCode && user.id && !normalizedReferredBy) {
          const referralsEnabled = await getFeatureFlag(env, 'referrals_enabled');
          if (referralsEnabled) {
            await captureReferralOnSignup(env, user.id.toString(), referralCode, request);
          }
        }
      } catch (referralError) {
        console.error('Failed to capture referral for existing user:', referralError);
        // Don't break user sync
      }

      // AUTO-REPAIR: If user has no active reward, check if they have qualified referrals that should trigger a grant
      if (!user.referral_reward_active) {
        try {
          const repairResult = await checkAndGrantReferralRewards(env, user.id.toString());
          if (repairResult.totalGranted > 0) {
            console.log(`[SYNC REPAIR] Repaired missing reward for user:`, repairResult);
            // Refresh user state from DB after repair
            const refreshed = await env.DB.prepare(
              'SELECT referral_reward_active, referral_reward_plan, referral_reward_expires_at FROM users WHERE id = ?'
            ).bind(user.id).first();
            if (refreshed) {
              user.referral_reward_active = refreshed.referral_reward_active;
              user.referral_reward_plan = refreshed.referral_reward_plan;
              user.referral_reward_expires_at = refreshed.referral_reward_expires_at;
            }
          }
        } catch (repairError) {
          console.error('[SYNC REPAIR] Failed to repair reward for existing user:', repairError);
          // Don't break user sync
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        data: user
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Check if user exists by email
    user = await env.DB.prepare(
      `SELECT 
        u.id, u.email, u.username, u.display_name, u.clerk_user_id, u.first_name, u.plan, u.subscription_status, 
        u.subscription_current_period_end, u.stripe_customer_id, u.referral_reward_active, u.referral_reward_plan, 
        u.referral_reward_expires_at, u.subdomain, u.referred_by,
        EXISTS(SELECT 1 FROM founder_access WHERE user_id = u.id) as has_founder_access
       FROM users u
       WHERE u.email = ? AND u.is_active = 1`
    ).bind(email).first();

    if (user) {
      // Update existing user with clerk_user_id
      await env.DB.prepare(
        'UPDATE users SET clerk_user_id = ?, updated_at = ? WHERE id = ?'
      ).bind(clerkUserId, now, user.id).run();

      // Update first_name if missing and Clerk has one
      if (!user.first_name && firstName) {
        await env.DB.prepare(
          'UPDATE users SET first_name = ?, updated_at = ? WHERE id = ?'
        ).bind(firstName, now, user.id).run();
        user.first_name = firstName;
      }

      // Capture referral for existing user if they have no referred_by and referralCode is provided
      try {
        const normalizedReferredBy = normalizeReferredBy(user.referred_by);
        if (referralCode && user.id && !normalizedReferredBy) {
          const referralsEnabled = await getFeatureFlag(env, 'referrals_enabled');
          if (referralsEnabled) {
            await captureReferralOnSignup(env, user.id.toString(), referralCode, request);
          }
        }
      } catch (referralError) {
        console.error('Failed to capture referral for existing user:', referralError);
        // Don't break user sync
      }

      user.clerk_user_id = clerkUserId;
      user.updated_at = now;
      
      return new Response(JSON.stringify({
        success: true,
        data: user
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Generate a valid username from email
    const emailPrefix = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '');
    let username = emailPrefix;
    
    // Check if username is already taken
    let existingUsername = await env.DB.prepare(
      'SELECT id FROM users WHERE username = ? AND is_active = 1'
    ).bind(username).first();
    
    if (existingUsername) {
      // Append timestamp to ensure uniqueness
      const timestamp = Date.now().toString().slice(-6);
      username = `${emailPrefix}${timestamp}`;
      
      // Double check the new username
      existingUsername = await env.DB.prepare(
        'SELECT id FROM users WHERE username = ? AND is_active = 1'
      ).bind(username).first();
      
      if (existingUsername) {
        // If still taken, use random suffix
        const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        username = `${emailPrefix}${randomSuffix}`;
      }
    }
    
    // Create new user with generated username and subdomain
    const result = await env.DB.prepare(
      `INSERT INTO users (email, username, clerk_user_id, first_name, subdomain, created_at, updated_at, is_active, username_confirmed_by_user)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(email, username, clerkUserId, firstName || null, username, now, now, 1, 0).run();

    const newUser = {
      id: result.meta.last_row_id,
      email,
      username,
      clerk_user_id: clerkUserId,
      first_name: firstName || null,
      subdomain: username,
      created_at: now,
      updated_at: now,
      is_active: 1,
      username_confirmed_by_user: 0,
      plan: 'free',
      subscription_status: null,
      subscription_current_period_end: null
    };

    // Log user signup event (non-blocking)
    try {
      await logActivityEvent(env, {
        event_type: 'user_signed_up',
        target_user_id: newUser.id,
        event_title: 'New user registered',
        event_description: `User ${email} signed up`,
        metadata_json: JSON.stringify({
          email: newUser.email,
          username: newUser.username,
          referral_code: referralCode || null
        }),
        severity: 'info',
        visibility_scope: 'owner'
      });
    } catch (activityError) {
      // Activity logging is non-blocking - log error but don't fail user creation
      console.error('Failed to log user signup activity event:', activityError);
    }

    // Capture referral if provided and referrals are enabled
    try {
      if (referralCode && newUser.id) {
        const referralsEnabled = await getFeatureFlag(env, 'referrals_enabled');
        if (referralsEnabled) {
          await captureReferralOnSignup(env, newUser.id.toString(), referralCode, request);
        }
      }
    } catch (referralError) {
      console.error('Failed to capture referral for new user:', referralError);
    }

    // Send welcome email for new users only
    try {
      if (email) {
        // Use firstName from Clerk, fallback to email local part, then "there"
        const firstName = newUser.first_name || emailLocalPartCapitalized || 'there';
        await sendTransactionalEmail(env, {
          to: email,
          subject: `You're in, ${firstName} — here's your first move 🎯`,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
              <h2>Hey ${firstName},</h2>

              <p>You can now see exactly which placements are driving clicks — description, pinned comment, bio, Shorts… all of it.</p>

              <p><strong>One thing to do right now:</strong></p>

              <p>
                <a href="https://tubelinkr.com/links/new"
                   style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">
                  Create your first link →
                </a>
              </p>

              <p>— TubeLinkr</p>
            </div>
          `
        });
      }
    } catch (emailError) {
      // Log error but don't break user creation
      console.error('Failed to send welcome email:', emailError);
    }

    return new Response(JSON.stringify({
      success: true,
      data: newUser
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error syncing Clerk user:', error);
    return new Response(JSON.stringify({ error: 'Failed to sync user' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestGet(context) {
  return new Response(JSON.stringify({ error: 'Use POST method for sync' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}
