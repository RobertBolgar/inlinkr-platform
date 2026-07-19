/**
 * Cloudflare Worker for handling clean public redirect URLs
 *
 * This Worker handles:
 * - go.inlinkr.com/{public_code} (InLinkr global smart short link)
 * - go.inlinkr.com/{public_code}/{placementCode} (InLinkr placement link)
 * - {username}.inlinkr.com/{slug} (InLinkr branded Smart Link)
 * - {username}.inlinkr.com/{slug}/{placementCode} (InLinkr branded placement link)
 * - go.tubelinkr.com/{public_code} / {username}/{slug} (TubeLinkr legacy)
 * - {subdomain}.tubelinkr.com/{slug} (TubeLinkr creator hub / branded link)
 *
 * Deployed to: tubelinkr-go (go.inlinkr.com, *.inlinkr.com, go.tubelinkr.com, *.tubelinkr.com)
 */

/**
 * Hash IP address for anti-abuse protection (SHA-256)
 * @param {string} ipAddress - The IP address to hash
 * @returns {Promise<string>} Hashed IP address
 */
async function hashIpAddress(ipAddress) {
  if (!ipAddress) return null;

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(ipAddress);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (error) {
    console.error('Error hashing IP address:', error);
    return null;
  }
}

/**
 * Send transactional email via Resend API
 * @param {Object} env - Cloudflare environment
 * @param {Object} emailData - Email data with to, subject, html
 * @returns {Promise<boolean>} - true if sent successfully
 */
async function sendTransactionalEmail(env, emailData) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'TubeLinkr <hello@notify.tubelinkr.com>',
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
      }),
    });

    if (!response.ok) {
      console.error('Resend API error:', response.status, response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send email:', error.message);
    return false;
  }
}

/**
 * Check if user should receive first meaningful click email and send it
 * This is called after a successful click event is recorded
 * @param {Object} env - Cloudflare environment with DB binding
 * @param {number} userId - The user ID who owns the clicked link
 * @returns {Promise<void>}
 */
async function checkAndSendFirstMeaningfulClickEmail(env, userId) {
  try {
    // Fetch user's first_name and email guard
    const userData = await env.DB.prepare(
      'SELECT id, email, first_name, first_meaningful_click_email_sent_at FROM users WHERE id = ?'
    ).bind(userId).first();

    if (userData && userData.first_meaningful_click_email_sent_at === null) {
      // Count total clicks across all links owned by this user
      const clickCountResult = await env.DB.prepare(
        'SELECT COUNT(*) as total_clicks FROM click_events ce JOIN links l ON ce.link_id = l.id WHERE l.user_id = ?'
      ).bind(userId).first();

      const totalClicks = clickCountResult?.total_clicks || 0;

      if (totalClicks >= 2) {
        const firstName = userData.first_name || 'there';
        const emailSent = await sendTransactionalEmail(env, {
          to: userData.email,
          subject: 'Your TubeLinkr links are getting clicks 🎯',
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
              <p>Hi ${firstName},</p>

              <p>Good news — your TubeLinkr tracking is working.</p>

              <p>Your links are starting to get clicks, which means TubeLinkr can now help show which placements are driving traffic.</p>

              <p>Check your dashboard here:
              <a href="https://tubelinkr.com/dashboard">https://tubelinkr.com/dashboard</a></p>

              <p>— TubeLinkr</p>
            </div>
          `
        });

        if (emailSent) {
          // Update guard only if email was sent successfully
          const emailTimestamp = new Date().toISOString();
          await env.DB.prepare(
            'UPDATE users SET first_meaningful_click_email_sent_at = ? WHERE id = ?'
          ).bind(emailTimestamp, userId).run();
        }
      }
    }
  } catch (error) {
    // Log error but do not throw - caller should handle this gracefully
    console.error('WORKER Failed to send first meaningful click email - stage: helper_internal, userId:', userId, 'error:', error.message);
  }
}

// Reserved subdomains that should never be treated as usernames/branded Smart Links
const RESERVED_SUBDOMAINS = new Set([
  "app",
  "www",
  "api",
  "docs",
  "status",
  "support",
  "accounts",
  "clerk",
  "free-dev",
  "pro-dev",
  "dev",
  "staging",
  "preview",
  "test",
  "localhost"
]);

// Redirect entry-point subdomains that are not usernames
const REDIRECT_SUBDOMAINS = new Set(["go", "go-dev"]);

/**
 * Generate an HTML unavailable response for subdomains without access
 * @param {string} reason - The reason for unavailability
 * @param {number} status - HTTP status code (403 or 404)
 * @returns {Response} - HTML response
 */
function getUnavailableResponse(reason, status = 403) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hub Unavailable - TubeLinkr</title>
  <style>
    body {
      background: #0a0a0a;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .container {
      text-align: center;
      max-width: 400px;
    }
    h1 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #fff;
    }
    p {
      font-size: 14px;
      color: #888;
      line-height: 1.5;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${reason}</h1>
    <p>This TubeLinkr hub is currently unavailable. The creator may need to reactivate Pro access.</p>
  </div>
</body>
</html>
  `;

  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

/**
 * Try to qualify a referral if conditions are met (Worker-compatible version)
 * This is a Worker-adapted version of the logic from referral-helper.js
 * @param {Object} env - Cloudflare environment with DB binding
 * @param {string} referredUserId - The user ID to qualify
 * @returns {Promise<Object>} Result object with qualification status and details
 */
async function tryQualifyReferralInWorker(env, referredUserId) {
  try {
    // Normalize user ID for consistent string comparison
    const cleanReferredUserId = String(parseInt(referredUserId, 10));
    console.log(`[WORKER REFERRAL QUALIFY] tryQualifyReferral for user: ${referredUserId} -> clean: ${cleanReferredUserId}`);

    // Check if referrals are enabled
    const { results: flagResult } = await env.DB.prepare(`
      SELECT enabled FROM feature_flags WHERE key = ?
    `).bind('referrals_enabled').all();

    const referralsEnabled = flagResult.length > 0 ? flagResult[0].enabled === 1 : false;
    if (!referralsEnabled) {
      console.log(`[WORKER REFERRAL QUALIFY] referrals_enabled flag is OFF`);
      return { attempted: true, qualified: false, reason: 'flag_off' };
    }

    // Check if referral relationship exists
    const { results: referral } = await env.DB.prepare(`
      SELECT referrer_user_id, is_qualified FROM referrals WHERE referred_user_id = ?
    `).bind(cleanReferredUserId).all();

    console.log(`[WORKER REFERRAL QUALIFY] referral lookup result:`, referral);

    if (referral.length === 0) {
      console.log(`[WORKER REFERRAL QUALIFY] no referral row found for user ${cleanReferredUserId}`);
      return { attempted: true, qualified: false, reason: 'no_referral_row' };
    }

    if (referral[0].is_qualified === 1) {
      console.log(`[WORKER REFERRAL QUALIFY] user ${cleanReferredUserId} already qualified`);
      return { attempted: true, qualified: false, reason: 'already_qualified' };
    }

    // Check if referred user has at least 1 link
    const { results: linkCheck } = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM links WHERE user_id = ?
    `).bind(cleanReferredUserId).all();

    const linkCount = linkCheck[0]?.count || 0;
    console.log(`[WORKER REFERRAL QUALIFY] link count for user ${cleanReferredUserId}: ${linkCount}`);

    if (linkCount < 1) {
      return { attempted: true, qualified: false, reason: 'not_enough_links', linkCount };
    }

    // Check if referred user has >= 2 click events
    const { results: clickCheck } = await env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM click_events ce
      JOIN links l ON ce.link_id = l.id
      WHERE l.user_id = ?
    `).bind(cleanReferredUserId).all();

    const clickCount = clickCheck[0]?.count || 0;
    console.log(`[WORKER REFERRAL QUALIFY] click count for user ${cleanReferredUserId}: ${clickCount}`);

    if (clickCount < 2) {
      return { attempted: true, qualified: false, reason: 'not_enough_clicks', linkCount, clickCount };
    }

    // IP check if enabled
    const { results: ipFlagResult } = await env.DB.prepare(`
      SELECT enabled FROM feature_flags WHERE key = ?
    `).bind('referrals_ip_check_enabled').all();

    const ipCheckEnabled = ipFlagResult.length > 0 ? ipFlagResult[0].enabled === 1 : false;
    if (ipCheckEnabled) {
      console.log(`[WORKER REFERRAL QUALIFY] IP check enabled, performing validation`);
      // Get referrer signup IP hash
      const { results: referrerIp } = await env.DB.prepare(`
        SELECT signup_ip_hash FROM users WHERE id = ?
      `).bind(referral[0].referrer_user_id).all();

      if (referrerIp.length > 0 && referrerIp[0].signup_ip_hash) {
        // Get click event IP hashes for referred user
        const { results: clickIps } = await env.DB.prepare(`
          SELECT DISTINCT ip_hash
          FROM click_events ce
          JOIN links l ON ce.link_id = l.id
          WHERE l.user_id = ? AND ip_hash IS NOT NULL
        `).bind(cleanReferredUserId).all();

        // click_events stores hashed IPs, signup_ip_hash is hashed
        // Direct comparison is correct
        const hasDifferentIp = clickIps.some(click =>
          click.ip_hash !== referrerIp[0].signup_ip_hash
        );

        if (!hasDifferentIp) {
          console.log(`[WORKER REFERRAL QUALIFY] IP check failed - all clicks from same IP`);
          return { attempted: true, qualified: false, reason: 'ip_check_failed', linkCount, clickCount };
        }
      }
    }

    // Update referral as qualified
    const result = await env.DB.prepare(`
      UPDATE referrals
      SET is_qualified = 1, qualified_at = CURRENT_TIMESTAMP
      WHERE referred_user_id = ?
    `).bind(cleanReferredUserId).run();

    console.log(`[WORKER REFERRAL QUALIFY] qualification update result:`, result);

    if (result.success && result.changes > 0) {
      console.log(`[WORKER REFERRAL QUALIFY] user ${cleanReferredUserId} successfully qualified!`);

      // Get referrer_user_id from the referral row to check rewards
      const { results: referralInfo } = await env.DB.prepare(`
        SELECT referrer_user_id FROM referrals WHERE referred_user_id = ?
      `).bind(cleanReferredUserId).all();

      if (referralInfo.length > 0) {
        const referrerUserId = referralInfo[0].referrer_user_id;
        console.log(`[WORKER REFERRAL QUALIFY] Checking rewards for referrer: ${referrerUserId}`);

        // Check and grant rewards (non-blocking)
        try {
          const rewardResult = await checkAndGrantReferralRewardsInWorker(env, referrerUserId);
          console.log(`[WORKER REFERRAL QUALIFY] Reward check result:`, rewardResult);
        } catch (rewardError) {
          console.error('[WORKER REFERRAL QUALIFY] Reward check failed:', rewardError);
          // Don't fail qualification if reward check fails
        }
      }

      return { attempted: true, qualified: true, reason: 'qualified', linkCount, clickCount };
    } else {
      console.log(`[WORKER REFERRAL QUALIFY] qualification update failed for user ${cleanReferredUserId}`);
      return { attempted: true, qualified: false, reason: 'update_failed', linkCount, clickCount };
    }
  } catch (error) {
    console.error('[WORKER REFERRAL QUALIFY] Error qualifying referral:', error);
    return { attempted: true, qualified: false, reason: 'error', error: error.message };
  }
}

/**
 * Check and grant referral milestone rewards for a user (Worker-compatible version)
 * This is a Worker-adapted version of the logic from referral-helper.js
 * @param {Object} env - Cloudflare environment with DB binding
 * @param {string} referrerUserId - The referrer user ID to check rewards for
 * @returns {Promise<Object>} Results of reward checking and granting
 */
async function checkAndGrantReferralRewardsInWorker(env, referrerUserId) {
  try {
    console.log(`[WORKER REFERRAL REWARDS] Checking rewards for user: ${referrerUserId}`);

    // Check if referrals are enabled
    const { results: flagResult } = await env.DB.prepare(`
      SELECT enabled FROM feature_flags WHERE key = ?
    `).bind('referrals_enabled').all();

    const referralsEnabled = flagResult.length > 0 ? flagResult[0].enabled === 1 : false;
    if (!referralsEnabled) {
      console.log(`[WORKER REFERRAL REWARDS] referrals_enabled is OFF, skipping rewards`);
      return { attempted: false, reason: 'referrals_disabled' };
    }

    // Check if referral rewards are enabled
    const { results: rewardsFlagResult } = await env.DB.prepare(`
      SELECT enabled FROM feature_flags WHERE key = ?
    `).bind('referrals_rewards_enabled').all();

    const rewardsEnabled = rewardsFlagResult.length > 0 ? rewardsFlagResult[0].enabled === 1 : false;
    if (!rewardsEnabled) {
      console.log(`[WORKER REFERRAL REWARDS] referrals_rewards_enabled is OFF, skipping rewards`);
      return { attempted: false, reason: 'rewards_disabled' };
    }

    // Normalize user ID for consistent string comparison
    const cleanReferrerUserId = String(parseInt(referrerUserId, 10));
    console.log(`[WORKER REFERRAL REWARDS] Clean referrer user ID: ${cleanReferrerUserId}`);

    // Count qualified referrals
    const { results: qualifiedCountResult } = await env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM referrals
      WHERE referrer_user_id = ? AND is_qualified = 1
    `).bind(cleanReferrerUserId).all();

    const qualifiedCount = qualifiedCountResult[0]?.count || 0;
    console.log(`[WORKER REFERRAL REWARDS] Qualified referral count: ${qualifiedCount}`);

    // NEW TIER SYSTEM: 3 referrals → 7 days Pro, 10 referrals → 30 days Pro
    // Rewards unlock once per tier, do not stack, 10-referral resets expiration

    // Define milestones for Pro-only tier system
    const milestones = [
      { count: 3, plan: "pro", days: 7 },
      { count: 10, plan: "pro", days: 30 }
    ];

    const grantedRewards = [];
    const skippedRewards = [];

    // Check each milestone
    for (const milestone of milestones) {
      console.log(`[WORKER REFERRAL REWARDS] Checking milestone: ${milestone.count} referrals`);

      // Only check if user has enough qualified referrals
      if (qualifiedCount >= milestone.count) {
        // Check if reward already granted using unlock flags
        const unlockField = milestone.count === 3 ? 'referral_3_unlocked' : 'referral_10_unlocked';
        try {
          const { results: existingUser } = await env.DB.prepare(`
            SELECT ${unlockField} FROM users WHERE id = ?
          `).bind(cleanReferrerUserId).all();

          if (existingUser.length > 0 && existingUser[0][unlockField]) {
            console.log(`[WORKER REFERRAL REWARDS] Reward for milestone ${milestone.count} already unlocked`);
            skippedRewards.push({ milestone, reason: 'already_unlocked' });
            continue;
          }
        } catch (unlockCheckError) {
          // Column may not exist yet — proceed with granting (reward write is idempotent)
          console.warn(`[WORKER REFERRAL REWARDS] ${unlockField} column check failed (non-fatal):`, unlockCheckError.message);
        }

        // Grant the reward
        const grantResult = await grantReferralRewardInWorker(env, cleanReferrerUserId, milestone);
        if (grantResult.success) {
          console.log(`[WORKER REFERRAL REWARDS] Successfully granted reward for milestone ${milestone.count}`);
          grantedRewards.push({ milestone, grantResult });
        } else {
          console.log(`[WORKER REFERRAL REWARDS] Failed to grant reward for milestone ${milestone.count}: ${grantResult.reason}`);
          skippedRewards.push({ milestone, reason: grantResult.reason });
        }
      } else {
        console.log(`[WORKER REFERRAL REWARDS] Not enough referrals for milestone ${milestone.count}`);
        skippedRewards.push({ milestone, reason: 'insufficient_referrals' });
      }
    }

    return {
      attempted: true,
      qualifiedCount,
      grantedRewards,
      skippedRewards,
      totalGranted: grantedRewards.length
    };

  } catch (error) {
    console.error('[WORKER REFERRAL REWARDS] Error checking/granting rewards:', error);
    return { attempted: true, reason: 'error', error: error.message };
  }
}

/**
 * Grant a specific referral reward to a user (Worker-compatible version)
 * This is a Worker-adapted version of the logic from referral-helper.js
 * @param {Object} env - Cloudflare environment with DB binding
 * @param {string} userId - The user ID to grant reward to
 * @param {Object} milestone - The milestone object {count, plan, days}
 * @returns {Promise<Object>} Result of reward granting
 */
async function grantReferralRewardInWorker(env, userId, milestone) {
  try {
    console.log(`[WORKER REFERRAL REWARDS] Granting reward: count=${milestone.count}, plan=${milestone.plan}, days=${milestone.days}`);

    // Calculate expiration date
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (milestone.days * 24 * 60 * 60 * 1000));
    const expiresAtISO = expiresAt.toISOString();

    // Get current user info to check subscription status
    const { results: userInfo } = await env.DB.prepare(`
      SELECT plan, subscription_status, referral_reward_plan, referral_reward_expires_at
      FROM users WHERE id = ?
    `).bind(userId).all();

    if (userInfo.length === 0) {
      return { success: false, reason: 'user_not_found' };
    }

    const currentUser = userInfo[0];
    console.log(`[WORKER REFERRAL REWARDS] Current user plan: ${currentUser.plan}, status: ${currentUser.subscription_status}`);

    // Safety checks for paid subscribers - only update referral reward fields, never billing fields
    if (currentUser.subscription_status === 'active' && currentUser.plan !== 'free') {
      console.log(`[WORKER REFERRAL REWARDS] User has active paid subscription, recording reward but not changing billing state`);
      // Still record the reward as granted but don't change their billing plan
    } else {
      // User is free or has referral reward - can safely update referral reward fields
      // NEW RULE: Overwrite expiration, do NOT extend, do NOT stack
      console.log(`[WORKER REFERRAL REWARDS] Setting referral reward: plan=${milestone.plan}, expires=${expiresAtISO}`);
      await env.DB.prepare(`
        UPDATE users
        SET referral_reward_active = 1,
            referral_reward_plan = ?,
            referral_reward_expires_at = ?
        WHERE id = ?
      `).bind(milestone.plan, expiresAtISO, userId).run();
    }

    // Set unlock flag to prevent re-granting
    const unlockField = milestone.count === 3 ? 'referral_3_unlocked' : 'referral_10_unlocked';
    try {
      await env.DB.prepare(`
        UPDATE users SET ${unlockField} = 1 WHERE id = ?
      `).bind(userId).run();
      console.log(`[WORKER REFERRAL REWARDS] Set ${unlockField} = 1`);
    } catch (unlockError) {
      // Column may not exist yet if migration hasn't been applied
      console.warn(`[WORKER REFERRAL REWARDS] Failed to set ${unlockField} (non-fatal):`, unlockError.message);
    }

    // Record the reward in referral_rewards table for tracking (non-blocking)
    const rewardId = crypto.randomUUID();
    try {
      await env.DB.prepare(`
        INSERT INTO referral_rewards (id, user_id, milestone_count, reward_plan, reward_days, granted_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        rewardId,
        userId,
        milestone.count,
        milestone.plan,
        milestone.days,
        new Date().toISOString(),
        expiresAtISO
      ).run();
      console.log(`[WORKER REFERRAL REWARDS] Recorded reward in referral_rewards table`);
    } catch (trackingError) {
      // Don't fail the grant if tracking table INSERT fails (table may not exist yet)
      console.warn(`[WORKER REFERRAL REWARDS] Failed to record in referral_rewards table (non-fatal):`, trackingError.message);
    }

    // TODO: Referral reward email notification not implemented in Worker
    // Email logic would need to be added here if/when reward emails are desired

    return {
      success: true,
      rewardId,
      expiresAt: expiresAtISO,
      plan: milestone.plan,
      days: milestone.days
    };

  } catch (error) {
    console.error('[WORKER REFERRAL REWARDS] Error granting reward:', error);
    return { success: false, reason: 'error', error: error.message };
  }
}

/**
 * Check if user has effective Pro access (paid Pro, referral Pro, or Founder)
 * @param {Object} user - User object from database
 * @returns {boolean} - true if user has effective Pro access
 */
function checkEffectiveProAccess(user) {
  if (!user) return false;

  // Priority 1: Founder access (highest priority, separate entitlement layer)
  // Founder access is permanent and overrides all other entitlements
  // Use boolean field from DB query (EXISTS check on founder_access table)
  if (user.has_founder_access === 1 || user.has_founder_access === true) {
    return true;
  }

  // Priority 2: Active paid subscription
  if (user.subscription_status === 'active') {
    return user.plan === 'pro_plus' || user.plan === 'pro';
  }

  // Priority 3: Active referral reward (NEVER grants Pro+, only Pro)
  if (user.referral_reward_active && user.referral_reward_expires_at) {
    const expirationDate = new Date(user.referral_reward_expires_at);
    if (expirationDate > new Date()) {
      // Referral rewards only grant Pro, never Pro+
      return user.referral_reward_plan === 'pro';
    }
  }

  // Priority 4: Default to free
  return false;
}

// Pages origin mapping will be set from environment variables

/**
 * Resolve link by global public_code (Phase 2: smart short links)
 * @param {Object} env - Cloudflare environment with DB binding
 * @param {string} publicCode - The 6-character public_code
 * @returns {Promise<Object|null>} - Link object with user info, or null if not found
 */
async function resolveLinkByPublicCode(env, publicCode) {
  try {
    const link = await env.DB.prepare(
      'SELECT l.*, u.id as user_id, u.username FROM links l JOIN users u ON l.user_id = u.id WHERE l.public_code = ? AND l.is_active = 1 AND u.is_active = 1'
    ).bind(publicCode).first();

    if (!link) {
      return null;
    }

    // Return user object and link info
    return {
      user: { id: link.user_id, username: link.username },
      link: { id: link.id, original_url: link.original_url, slug: link.slug }
    };
  } catch (error) {
    console.error('Error resolving link by public_code:', error.message);
    return null;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    const pathParts = url.pathname.split('/');

    // Extract subdomain for reserved checks
    const subdomain = hostname.split('.')[0];

    // Environment-aware origins - fail safe if env vars missing
    const pagesOrigin = env.PAGES_ORIGIN;
    const proDevPagesOrigin = env.PRO_DEV_PAGES_ORIGIN || "https://pro-dev.tubelinkrgit.pages.dev";
    const freeDevPagesOrigin = env.FREE_DEV_PAGES_ORIGIN || "https://free-dev.tubelinkrgit.pages.dev";
    const apiOrigin = env.API_ORIGIN;

    // Fail safe if production env vars are missing
    if (!pagesOrigin || !apiOrigin) {
      console.error('Missing required environment variables: PAGES_ORIGIN or API_ORIGIN');
      return new Response('Service configuration error', { status: 500 });
    }

    // Handle redirect entry-point subdomains (go.inlinkr.com, go.tubelinkr.com, etc.)
    if (REDIRECT_SUBDOMAINS.has(subdomain)) {
      // Phase 2: New resolution order for smart short links
      // 1. Try path as global public_code (1 or 2 segments)
      // 2. Legacy username/slug fallback is supported only on TubeLinkr domains

      const segment1 = pathParts[1] || null;
      const segment2 = pathParts[2] || null;
      const segment3 = pathParts[3] || null;

      // Case 1: Exactly 1 segment (go.tubelinkr.com/{public_code})
      if (pathParts.length === 2 && segment1) {
        const resolved = await resolveLinkByPublicCode(env, segment1);
        if (resolved) {
          // segment2 is null (no placement code)
          return handleRedirect(request, env, resolved.user, resolved.link.slug, null, url);
        }
        // If not found as public_code, fall through to legacy handling below
      }

      // Case 2: Exactly 2 segments
      // go.inlinkr.com/{public_code}/{placementCode} OR
      // go.tubelinkr.com/{public_code}/{placementCode} OR legacy {username}/{slug}
      if (pathParts.length === 3 && segment1 && segment2) {
        // First try as public_code + placementCode
        const resolved = await resolveLinkByPublicCode(env, segment1);
        if (resolved) {
          // segment2 is the placement code
          return handleRedirect(request, env, resolved.user, resolved.link.slug, segment2, url);
        }

        // Legacy username/slug fallback is only supported on TubeLinkr domains.
        // go.inlinkr.com must resolve by public_code only.
        if (!hostname.endsWith('.inlinkr.com')) {
          const user = await env.DB.prepare(
            'SELECT id FROM users WHERE username = ? AND is_active = 1'
          ).bind(segment1).first();

          if (user) {
            // segment2 is slug, segment3 is optional placement code
            return handleRedirect(request, env, user, segment2, segment3, url);
          }
        }

        return new Response('Link not found', { status: 404 });
      }

      // Case 3: 3+ segments (legacy: go.tubelinkr.com/{username}/{slug}/{placementCode})
      // go.inlinkr.com never supports this legacy format.
      if (!hostname.endsWith('.inlinkr.com') && pathParts.length >= 4 && segment1 && segment2) {
        const user = await env.DB.prepare(
          'SELECT id FROM users WHERE username = ? AND is_active = 1'
        ).bind(segment1).first();

        if (!user) {
          return new Response('User not found', { status: 404 });
        }

        // segment2 is slug, segment3 is optional placement code
        return handleRedirect(request, env, user, segment2, segment3, url);
      }

      // Invalid path format
      return new Response('Invalid redirect URL', { status: 400 });
    }

    // Handle staging and bypass subdomains (protect staging environments)
    const STAGING_SUBDOMAINS = new Set(["pro-dev", "free-dev"]);
    const BYPASS_SUBDOMAINS = new Set(["www", "api", "clerk", "support", "accounts"]);

    const isStagingSubdomain =
      hostname.endsWith(".tubelinkr.com") &&
      STAGING_SUBDOMAINS.has(subdomain);

    const isBypassSubdomain =
      hostname.endsWith(".tubelinkr.com") &&
      BYPASS_SUBDOMAINS.has(subdomain);

    if (isStagingSubdomain || isBypassSubdomain) {
      const targetUrl = new URL(request.url);

      // Map staging environments to correct Pages builds
      if (subdomain === "pro-dev") {
        targetUrl.hostname = new URL(proDevPagesOrigin).hostname;
      }

      if (subdomain === "free-dev") {
        targetUrl.hostname = new URL(freeDevPagesOrigin).hostname;
      }

      // For bypass subdomains like www/api/clerk → just pass through
      return fetch(targetUrl.toString(), request);
    }

    // Handle subdomain routing (Pro+ link hub)
    const isSubdomain = hostname.endsWith(".tubelinkr.com") && hostname !== "tubelinkr.com";

    if (isSubdomain) {
      // Proxy API requests
      if (url.pathname.startsWith("/api/")) {
        const apiUrl = new URL(url.pathname + url.search, apiOrigin);
        return fetch(apiUrl.toString(), request);
      }

      // Proxy static assets
      const isStaticAsset =
        url.pathname.startsWith("/assets/") ||
        url.pathname === "/tubelinkr-icon.png" ||
        url.pathname === "/tubelinkr.png" ||
        url.pathname === "/favicon.ico" ||
        url.pathname === "/manifest.webmanifest";

      if (isStaticAsset) {
        const assetUrl = `${pagesOrigin}${url.pathname}`;
        return fetch(assetUrl);
      }

      // Handle root path for link hub
      if (url.pathname === "/") {
        // Find user by subdomain with plan and subscription status
        const hostnameParts = hostname.split('.');
        const subdomain = hostnameParts[0];
        
        // Find user by subdomain with plan and subscription status (including founder access)
        const user = await env.DB.prepare(
          'SELECT id, plan, subscription_status, referral_reward_active, referral_reward_plan, referral_reward_expires_at, EXISTS(SELECT 1 FROM founder_access WHERE user_id = users.id) as has_founder_access FROM users WHERE subdomain = ? AND is_active = 1'
        ).bind(subdomain).first();

        // Enforce effective Pro requirement for subdomain hub (paid Pro or referral Pro)
        const hasEffectiveProAccess = checkEffectiveProAccess(user);
        if (!user) {
          return getUnavailableResponse('Hub Not Found', 404);
        }
        if (!hasEffectiveProAccess) {
          return getUnavailableResponse('Hub Unavailable', 403);
        }

        // Serve React app shell
        const res = await fetch(`${pagesOrigin}/index.html`);

        return new Response(res.body, {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
        });
      }

      // Handle branded subdomain slug redirects
      try {
        const pathParts = url.pathname.split("/").filter(Boolean);
        if (pathParts.length >= 1) {
          const slug = pathParts[0];
          const public_code = pathParts[1] || null;

          // Find user by subdomain with plan and subscription status (including founder access)
          const user = await env.DB.prepare(
            'SELECT id, plan, subscription_status, referral_reward_active, referral_reward_plan, referral_reward_expires_at, EXISTS(SELECT 1 FROM founder_access WHERE user_id = users.id) as has_founder_access FROM users WHERE subdomain = ? AND is_active = 1'
          ).bind(subdomain).first();

          // Enforce effective Pro requirement for subdomain routing (paid Pro or referral Pro)
          const hasEffectiveProAccess = checkEffectiveProAccess(user);
          if (!user) {
            return getUnavailableResponse('Hub Not Found', 404);
          }
          if (!hasEffectiveProAccess) {
            return getUnavailableResponse('Hub Unavailable', 403);
          }

          return handleRedirect(request, env, user, slug, public_code, url);
        }
      } catch (err) {
        console.error("Branded redirect error:", err);
        return new Response("Redirect error", { status: 500 });
      }

      // If we reach here, it's a branded subdomain with no matching route - serve the React app shell
      const res = await fetch(`${pagesOrigin}/index.html`);
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    }

    // InLinkr apex/root domain: proxy to marketing origin if routed here
    if (hostname === "inlinkr.com" || hostname === "www.inlinkr.com") {
      const marketingOrigin = env.INLINKR_MARKETING_ORIGIN;
      if (!marketingOrigin) {
        return new Response('Service configuration error', { status: 500 });
      }
      const proxyUrl = new URL(url.pathname + url.search, marketingOrigin);
      return fetch(proxyUrl.toString(), request);
    }

    // InLinkr branded Smart Links: username.inlinkr.com/{slug}
    if (hostname.endsWith(".inlinkr.com") && hostname !== "inlinkr.com" && !REDIRECT_SUBDOMAINS.has(subdomain)) {
      if (RESERVED_SUBDOMAINS.has(subdomain)) {
        const targetOrigin = subdomain === "app" ? env.INLINKR_APP_ORIGIN : env.INLINKR_MARKETING_ORIGIN;
        if (!targetOrigin) {
          return new Response('Service configuration error', { status: 500 });
        }
        const proxyUrl = new URL(url.pathname + url.search, targetOrigin);
        return fetch(proxyUrl.toString(), request);
      }

      // Root of a branded Smart Link domain: redirect to the marketing site.
      // The user's creator hub lives on username.tubelinkr.com, not here.
      if (pathParts.length < 2) {
        const marketingOrigin = env.INLINKR_MARKETING_ORIGIN;
        if (marketingOrigin) {
          return Response.redirect(marketingOrigin, 302);
        }
        return new Response('Invalid redirect URL', { status: 400 });
      }

      const slug = pathParts[1];
      const public_code = pathParts[2] || null;

      const user = await env.DB.prepare(
        'SELECT id FROM users WHERE (subdomain = ? OR username = ?) AND is_active = 1'
      ).bind(subdomain, subdomain).first();

      if (!user) {
        return new Response('User not found', { status: 404 });
      }

      return handleRedirect(request, env, user, slug, public_code, url);
    }

    // Extract subdomain from hostname
    const hostnameParts = hostname.split('.');

    // Handle root domain (tubelinkr.com without subdomain)
    if (hostname === "tubelinkr.com" || hostname === "www.tubelinkr.com") {
      const proxyUrl = `${pagesOrigin}${url.pathname}${url.search}`;
      const proxyRequest = new Request(proxyUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });
      return fetch(proxyRequest);
    }

    // Handle unknown subdomains as Pro user subdomains for slug routing
    if (pathParts.length < 2) {
      return new Response('Invalid redirect URL', { status: 400 });
    }

    const slug = pathParts[1];
    const public_code = pathParts[2] || null;

    // Find user by subdomain with plan and subscription status (including founder access)
    const user = await env.DB.prepare(
      'SELECT id, plan, subscription_status, referral_reward_active, referral_reward_plan, referral_reward_expires_at, EXISTS(SELECT 1 FROM founder_access WHERE user_id = users.id) as has_founder_access FROM users WHERE subdomain = ? AND is_active = 1'
    ).bind(subdomain).first();

    // Enforce effective Pro requirement for subdomain routing (paid Pro or referral Pro)
    const hasEffectiveProAccess = checkEffectiveProAccess(user);
    if (!user) {
      return getUnavailableResponse('Hub Not Found', 404);
    }
    if (!hasEffectiveProAccess) {
      return getUnavailableResponse('Hub Unavailable', 403);
    }

    return handleRedirect(request, env, user, slug, public_code, url);
  }
};

async function handleRedirect(request, env, user, slug, public_code, url) {
  try {
    if (!user) {
      return new Response('User not found', { status: 404 });
    }

    // Find the link by numeric user_id and slug
    const link = await env.DB.prepare(
      'SELECT id, original_url FROM links WHERE user_id = ? AND slug = ? AND is_active = 1'
    ).bind(user.id, slug).first();

    if (!link) {
      return new Response('Link not found', { status: 404 });
    }

    // Get source from query parameter (backward compatibility) or path-based tracking code
    let source = url.searchParams.get('source');

    // Look up matching link_usage for reusable destination attribution
    let linkUsageId = null;
    if (public_code) {
      // Resolve placement — now also reads link_usage_id directly
      const placement = await env.DB.prepare(
        'SELECT id, source_code, public_code, link_usage_id FROM placements WHERE link_id = ? AND public_code = ?'
      ).bind(link.id, public_code).first();

      if (placement) {
        source = placement.source_code;
        if (placement.link_usage_id) {
          linkUsageId = placement.link_usage_id; // Canonical path: placement → link_usage
        }
      }

      // Secondary lookup: for link_usages with their own source_code (non-legacy)
      if (!linkUsageId) {
        try {
          const linkUsage = await env.DB.prepare(
            `SELECT id FROM link_usages
             WHERE link_id = ?
             AND is_active = 1
             AND (public_code = ? OR source_code = ?)
             ORDER BY id DESC
             LIMIT 1`
          ).bind(link.id, public_code, source || '').first();
          if (linkUsage) {
            linkUsageId = linkUsage.id;
          }
        } catch (usageError) {
          // Log error but do not block redirect
          console.error('WORKER - Link usage lookup error:', usageError.message);
        }
      }
    }

    const normalizedSource = source ? source.toLowerCase().trim() : 'direct';

    // Record click event
    const now = new Date().toISOString();
    const referrer = request.headers.get('referer') || null;
    const userAgent = request.headers.get('user-agent') || null;
    const rawIp = request.headers.get('cf-connecting-ip') || null;
    const ipHash = rawIp ? await hashIpAddress(rawIp) : null;

    try {
      await env.DB.prepare(
        `INSERT INTO click_events (link_id, timestamp, referrer, user_agent, ip_hash, source, link_usage_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(link.id, now, referrer, userAgent, ipHash, normalizedSource, linkUsageId).run();

      // Check if we should send first meaningful click email
      try {
        await checkAndSendFirstMeaningfulClickEmail(env, user.id);
      } catch (emailError) {
        // Log error but do not stop redirect
        console.error('WORKER - Helper error - stage: helper_call, error:', emailError.message);
      }

      // Try to qualify referral after successful click recording
      try {
        console.log(`[WORKER REFERRAL QUALIFY] calling tryQualifyReferral for user: ${user.id}`);
        // Reuse qualification logic from referral-helper.js
        // Since this is a Worker, we need to inline the qualification logic
        // or extract it to a Worker-compatible helper
        const qualifyResult = await tryQualifyReferralInWorker(env, user.id);
        console.log(`[WORKER REFERRAL QUALIFY] tryQualifyReferral result:`, qualifyResult);
      } catch (referralError) {
        console.error('WORKER - Referral qualification check failed:', referralError);
        // Continue with redirect even if referral qualification fails
      }
    } catch (clickError) {
      console.error('WORKER - Click insert error:', clickError.message);
      // Continue with redirect even if click recording fails
    }

    // Redirect to original URL
    return Response.redirect(link.original_url, 302);

  } catch (error) {
    console.error('Redirect error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
