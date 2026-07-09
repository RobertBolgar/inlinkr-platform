import { getAuthenticatedUser } from '../auth-helper.js';
import { getFeatureFlag, generateReferralCode, checkAndGrantReferralRewards } from '../referral-helper.js';

export async function onRequest(context) {
  const { request, env } = context;

  try {
    // Get authenticated user
    const user = await getAuthenticatedUser(request, env);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check for expired referral rewards and downgrade if necessary (new model only - Phase 2C-2)
    const newModelExpired = user.referral_reward_active &&
      user.referral_reward_expires_at &&
      new Date(user.referral_reward_expires_at) < new Date();

    if (newModelExpired) {
      console.log("[REFERRAL EXPIRATION] Expired referral reward for user in status endpoint");

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

    // Check if referrals are enabled
    const referralsEnabled = await getFeatureFlag(env, 'referrals_enabled');
    
    if (!referralsEnabled) {
      return new Response(JSON.stringify({ enabled: false }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get or generate referral code for the user
    let referralCode = null;
    const { results: existingCode } = await env.DB.prepare(`
      SELECT referral_code FROM users WHERE id = ? AND referral_code IS NOT NULL
    `).bind(user.id).all();

    if (existingCode.length > 0) {
      referralCode = existingCode[0].referral_code;
    } else {
      // Generate a new referral code
      referralCode = await generateReferralCode(env, user.id);
    }

    // Get qualified referral count with string normalization
    const cleanUserId = String(parseInt(user.id, 10));
    
    let qualifiedCountValue = 0;
    try {
      const { results: qualifiedCount } = await env.DB.prepare(`
        SELECT COUNT(*) as count
        FROM referrals r
        JOIN users u ON u.id = r.referred_user_id
        WHERE r.referrer_user_id = ? 
        AND r.is_qualified = 1
        AND u.is_active = 1
      `).bind(cleanUserId).all();

      qualifiedCountValue = qualifiedCount[0]?.count || 0;
    } catch (error) {
      console.error('[REFERRAL STATUS ERROR] Error fetching qualified count:', error);
      qualifiedCountValue = 0;
    }

    // Get reward information
    const rewardsEnabled = await getFeatureFlag(env, 'referrals_rewards_enabled');
    
    // Define milestones for Pro-only tier system
    const milestones = [
      { count: 3, plan: "pro", days: 7, label: "7 days Pro" },
      { count: 10, plan: "pro", days: 30, label: "30 days Pro" }
    ];

    // Check which milestones are unlocked and granted
    // Also auto-repair: if milestone is reached but reward was never written, grant it now
    const milestoneInfo = [];
    let needsRepair = false;

    for (const milestone of milestones) {
      const unlocked = qualifiedCountValue >= milestone.count;
      let granted = false;
      
      if (unlocked && rewardsEnabled) {
        // Check if reward has been granted using unlock flags
        const unlockField = milestone.count === 3 ? 'referral_3_unlocked' : 'referral_10_unlocked';
        try {
          const { results: existingUser } = await env.DB.prepare(`
            SELECT ${unlockField} FROM users WHERE id = ?
          `).bind(cleanUserId).all();
          granted = existingUser.length > 0 && existingUser[0][unlockField];
        } catch (error) {
          console.error('[REFERRAL STATUS ERROR] Error fetching unlock flags:', error);
          granted = false;
        }

        // Also check if referral_reward_active is set (primary reward state)
        if (!granted && !user.referral_reward_active) {
          needsRepair = true;
        }
      }
      
      milestoneInfo.push({
        ...milestone,
        unlocked,
        granted
      });
    }

    // AUTO-REPAIR: If milestones are reached but reward was never written, grant now
    if (needsRepair && rewardsEnabled) {
      console.log(`[REFERRAL STATUS REPAIR] User ${cleanUserId} has reached milestones but reward was never granted. Repairing...`);
      try {
        const repairResult = await checkAndGrantReferralRewards(env, cleanUserId);
        console.log(`[REFERRAL STATUS REPAIR] Repair result:`, repairResult);

        // Re-check granted status after repair
        if (repairResult.totalGranted > 0) {
          // Refresh user state from DB after repair
          const { results: refreshedUser } = await env.DB.prepare(`
            SELECT referral_reward_active, referral_reward_plan, referral_reward_expires_at FROM users WHERE id = ?
          `).bind(cleanUserId).all();
          if (refreshedUser.length > 0) {
            user.referral_reward_active = refreshedUser[0].referral_reward_active;
            user.referral_reward_plan = refreshedUser[0].referral_reward_plan;
            user.referral_reward_expires_at = refreshedUser[0].referral_reward_expires_at;
          }

          // Update milestone granted status
          for (const mi of milestoneInfo) {
            if (mi.unlocked) {
              mi.granted = true;
            }
          }
        }
      } catch (repairError) {
        console.error('[REFERRAL STATUS REPAIR] Repair failed:', repairError);
      }
    }

    // Build tracked referral invite link
    let referralUrl = null;
    let referralClicks = 0;
    let rawReferralUrl = null;
    
    if (referralCode) {
      // Generate the raw signup URL first
      const requestUrl = request.url;
      const requestOrigin = new URL(request.url).origin;
      const originHeader = request.headers.get('Origin');
      const refererHeader = request.headers.get('Referer');
      const hostHeader = request.headers.get('Host');
      
      // Define allowed origins for referral URL generation
      const allowedOrigins = [
        // Production/staging app origins
        'https://tubelinkr.com',
        'https://www.tubelinkr.com',
        'https://pro-dev.tubelinkr.com',
        'https://free-dev.tubelinkr.com',
        // Local dev origins
        'http://localhost:5173',
        'http://localhost:8788',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:8788'
      ];
      
      // Resolution order for origin detection
      let referralBaseOrigin = 'https://tubelinkr.com'; // fallback
      
      // 1. Try request.url origin if allowed
      if (allowedOrigins.includes(requestOrigin)) {
        referralBaseOrigin = requestOrigin;
      }
      // 2. Try Origin header if allowed
      else if (originHeader && allowedOrigins.includes(originHeader)) {
        referralBaseOrigin = originHeader;
      }
      // 3. Try Referer origin if allowed
      else if (refererHeader) {
        const refererOrigin = new URL(refererHeader).origin;
        if (allowedOrigins.includes(refererOrigin)) {
          referralBaseOrigin = refererOrigin;
        }
      }
      // 4. Try Host header converted to https
      else if (hostHeader) {
        const hostOrigin = `https://${hostHeader}`;
        if (allowedOrigins.includes(hostOrigin)) {
          referralBaseOrigin = hostOrigin;
        }
      }
      // 5. Use fallback
      
      rawReferralUrl = `${referralBaseOrigin}/?ref=${encodeURIComponent(referralCode)}`;
      
      // Create or get tracked invite link
      let username = user.username;
      
      // Fallback: fetch username directly if missing from initial query
      if (!username) {
        try {
          const { results: usernameResult } = await env.DB.prepare(`
            SELECT username FROM users WHERE id = ?
          `).bind(user.id).all();
          
          if (usernameResult.length > 0 && usernameResult[0].username) {
            username = usernameResult[0].username;
          } else {
            // Don't throw - just skip link creation and return without referral URL
            referralUrl = null;
            rawReferralUrl = null;
          }
        } catch (error) {
          console.error('[REFERRAL LINK ERROR] Error fetching username:', error);
          referralUrl = null;
          rawReferralUrl = null;
        }
      }

      // Skip link creation if username is missing
      if (!username) {
        return new Response(JSON.stringify({
          enabled: true,
          referralCode,
          referralUrl: null,
          referralClicks: 0,
          rawReferralUrl: null,
          qualifiedCount: qualifiedCountValue,
          requiredForProPlus: null,
          rewards: {
            rewardsEnabled,
            milestones: milestoneInfo
          }
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      let slug = 'invite';
      let linkCreated = false;
      
      try {
        // Step 1: Check existing invite link
        const { results: existingInviteLink } = await env.DB.prepare(`
          SELECT id, original_url FROM links 
          WHERE user_id = ? AND slug = 'invite' AND is_active = 1
        `).bind(user.id).all();
      
        if (existingInviteLink.length > 0) {
          // Step 2: Invite link exists - check if it points to correct URL
          const existingLink = existingInviteLink[0];
          if (existingLink.original_url === rawReferralUrl) {
            // Reuse it (DO NOTHING)
            referralUrl = `https://go.tubelinkr.com/${username}/invite`;
          } else {
            // Update existing invite link instead of creating my-invite
            await env.DB.prepare(`
              UPDATE links
              SET original_url = ?, updated_at = datetime('now')
              WHERE id = ?
            `).bind(rawReferralUrl, existingLink.id).run();
            
            referralUrl = `https://go.tubelinkr.com/${username}/invite`;
            linkCreated = true;
          }
        } else {
          // Step 3: Invite link does not exist - create it with 'invite' slug
          
          await env.DB.prepare(`
            INSERT INTO links (
              user_id, slug, original_url, title, is_active, is_system, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 1, 1, datetime('now'), datetime('now'))
          `).bind(
            user.id,
            'invite',
            rawReferralUrl,
            'TubeLinkr Invite'
          ).run();
          
          referralUrl = `https://go.tubelinkr.com/${username}/invite`;
          linkCreated = true;
        }
        
        // Step 4: Deactivate any legacy my-invite links for this user
        await env.DB.prepare(`
          UPDATE links
          SET is_active = 0, updated_at = datetime('now')
          WHERE user_id = ? AND slug = 'my-invite' AND is_active = 1
        `).bind(user.id).run();
        
        // Get click count for the referral link
        try {
          const { results: linkIdResult } = await env.DB.prepare(`
            SELECT id FROM links 
            WHERE user_id = ? AND slug = ? AND is_active = 1
          `).bind(user.id, slug).all();
          
          if (linkIdResult.length > 0) {
            const linkId = linkIdResult[0].id;
            const { results: clickCountResult } = await env.DB.prepare(`
              SELECT COUNT(*) as count FROM click_events 
              WHERE link_id = ?
            `).bind(linkId).all();
            
            referralClicks = clickCountResult[0]?.count || 0;
          }
        } catch (error) {
          console.error('[REFERRAL LINK ERROR] Error fetching click count:', error);
          referralClicks = 0;
        }
      } catch (error) {
        console.error('[REFERRAL LINK ERROR] Error creating referral link:', error);
        referralUrl = null;
        referralClicks = 0;
      }
    }

    return new Response(JSON.stringify({
      enabled: true,
      referralCode,
      referralUrl,
      referralClicks,
      rawReferralUrl,
      qualifiedCount: qualifiedCountValue,
      requiredForProPlus: null, // Removed Pro+ referral rewards
      rewards: {
        rewardsEnabled,
        milestones: milestoneInfo,
        activeReward: user.referral_reward_active ? {
          plan: user.referral_reward_plan,
          expiresAt: user.referral_reward_expires_at
        } : null
      }
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in referral status:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
