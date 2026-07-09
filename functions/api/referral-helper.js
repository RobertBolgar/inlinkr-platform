// Referral system helper functions for Cloudflare Pages Functions
// Clean model using users.referral_code, users.referred_by, and referrals table

import { logImpactEvent, upsertImpactStats } from './creator-impact-helper.js';

/**
 * Get feature flag value - fail closed
 * @param {string} key - Feature flag key
 * @param {Object} env - Cloudflare environment with DB binding
 * @returns {Promise<boolean>} Feature flag enabled status
 */
export async function getFeatureFlag(env, key) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT enabled FROM feature_flags WHERE key = ?
    `).bind(key).all();

    return results.length > 0 ? results[0].enabled === 1 : false;
  } catch (error) {
    console.error('Error getting feature flag:', error);
    return false; // Fail safe - features disabled by default
  }
}

/**
 * Generate a unique referral code and save to users.referral_code
 * @param {Object} env - Cloudflare environment with DB binding
 * @param {string} userId - The user ID to generate a code for
 * @param {string} username - Optional username for code generation
 * @returns {Promise<string|null>} Generated referral code or null if failed
 */
export async function generateReferralCode(env, userId, username = null) {
  try {
    // Check if user already has a referral code
    const { results: existing } = await env.DB.prepare(`
      SELECT referral_code FROM users WHERE id = ? AND referral_code IS NOT NULL
    `).bind(userId).all();

    if (existing.length > 0) {
      return existing[0].referral_code; // Return existing code
    }

    // Generate a 6-character alphanumeric code
    const generateCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    // Try up to 10 times to generate a unique code
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generateCode();
      
      // Check if code already exists in users table
      const { results } = await env.DB.prepare(`
        SELECT id FROM users WHERE referral_code = ?
      `).bind(code).all();

      if (results.length === 0) {
        // Update user with the new referral code
        const result = await env.DB.prepare(`
          UPDATE users SET referral_code = ? WHERE id = ?
        `).bind(code, userId).run();

        if (result.success && result.changes > 0) {
          return code;
        }
      }
    }

    return null; // Failed to generate unique code
  } catch (error) {
    console.error('Error generating referral code:', error);
    return null;
  }
}

/**
 * Validate referral code and return referrer user
 * @param {Object} env - Cloudflare environment with DB binding
 * @param {string} code - The referral code to validate
 * @returns {Promise<Object|null>} Referrer user info or null if invalid
 */
export async function validateReferralCode(env, code) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT id, username, email FROM users 
      WHERE referral_code = ? AND referral_code IS NOT NULL
      LIMIT 1
    `).bind(code).all();

    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Error validating referral code:', error);
    return null;
  }
}

/**
 * Capture referral on user signup
 * @param {Object} env - Cloudflare environment with DB binding
 * @param {string} newUserId - The newly registered user ID
 * @param {string} referralCode - The referral code used
 * @param {Request} request - Optional request for IP extraction
 * @returns {Promise<Object>} Result object with success status and reason
 */
export async function captureReferralOnSignup(env, newUserId, referralCode, request = null) {
  try {
    if (!referralCode) {
      return { success: true, reason: 'no_referral_code' };
    }

    // Validate referral code and get referrer
    const referrer = await validateReferralCode(env, referralCode);
    if (!referrer) {
      console.log(`[REFERRAL DEBUG] Invalid referral code: ${referralCode}`);
      return { success: false, reason: 'invalid_referral_code' };
    }

    // Prevent self-referral
    if (referrer.id === newUserId) {
      console.log(`[REFERRAL DEBUG] Self-referral prevented: user ${newUserId} trying to refer to themselves`);
      return { success: false, reason: 'self_referral_prevented' };
    }

    console.log(`[REFERRAL DEBUG] Referrer found: ${referrer.id} for user ${newUserId}`);

    // Get IP hash from request if available
    let ipHash = null;
    if (request) {
      const clientIP = request.headers.get('CF-Connecting-IP') || 
                      request.headers.get('X-Forwarded-For') || 
                      request.headers.get('X-Real-IP');
      if (clientIP) {
        ipHash = await hashIpAddress(clientIP);
      }
    }

    // Update new user with referral info - ensure clean string storage
    const cleanReferrerId = String(parseInt(referrer.id, 10));
    const userUpdateResult = await env.DB.prepare(`
      UPDATE users SET referred_by = ?, signup_ip_hash = ? WHERE id = ?
    `).bind(cleanReferrerId, ipHash, newUserId).run();

    if (!userUpdateResult.success || userUpdateResult.changes === 0) {
      console.log(`[REFERRAL DEBUG] Failed to update user ${newUserId} with referral info`);
      return { success: false, reason: 'user_update_failed' };
    }

    // Create referral relationship - ensure clean string storage
    const referralId = crypto.randomUUID();
    const cleanReferredUserId = String(parseInt(newUserId, 10));
    
    // Additional defensive guard: prevent self-referral at insert time
    if (cleanReferrerId === cleanReferredUserId) {
      console.warn(`[REFERRAL WARN] Self-referral prevented at insert: referrer ${cleanReferrerId} == referred ${cleanReferredUserId}`);
      return { success: false, reason: 'self_referral_prevented' };
    }
    
    const capturedAt = new Date().toISOString();
    const referralInsertResult = await env.DB.prepare(`
      INSERT INTO referrals (
        id, referrer_user_id, referred_user_id,
        referral_code_used, captured_at, capture_source, attribution_status
      )
      VALUES (?, ?, ?, ?, ?, 'signup', 'pending')
    `).bind(referralId, cleanReferrerId, cleanReferredUserId, referralCode, capturedAt).run();

    if (!referralInsertResult.success || referralInsertResult.changes === 0) {
      console.log(`[REFERRAL DEBUG] Failed to insert referral relationship`);
      return { success: false, reason: 'referral_insert_failed' };
    }

    console.log(`[REFERRAL DEBUG] Referral captured successfully: referrer ${referrer.id} -> user ${newUserId}`);

    // Log Creator Impact event (non-blocking — never fails the capture)
    try {
      await logImpactEvent(env, {
        userId:         parseInt(cleanReferrerId, 10),
        referredUserId: parseInt(cleanReferredUserId, 10),
        referralId,
        eventType:      'referral_captured',
        eventDataJson:  { referral_code: referralCode, capture_source: 'signup' }
      });
      await upsertImpactStats(env, cleanReferrerId);
    } catch (impactError) {
      console.warn('[REFERRAL DEBUG] Creator Impact logging failed (non-fatal):', impactError.message);
    }

    return { success: true, reason: 'referral_captured', referrerId: referrer.id };
  } catch (error) {
    console.error('[REFERRAL DEBUG] Error capturing referral on signup:', error);
    return { success: false, reason: 'error', error: error.message };
  }
}

/**
 * Check if referral can be qualified based on 2-click logic and IP check
 * @param {Object} env - Cloudflare environment with DB binding
 * @param {string} referredUserId - The user ID to check qualification for
 * @returns {Promise<boolean>} True if can qualify
 */
export async function canQualifyReferral(env, referredUserId) {
  try {
    // Check if referrals are enabled
    const referralsEnabled = await getFeatureFlag(env, 'referrals_enabled');
    if (!referralsEnabled) return false;

    // Find referral relationship
    const { results: referral } = await env.DB.prepare(`
      SELECT referrer_user_id FROM referrals WHERE referred_user_id = ? AND is_qualified = 0
    `).bind(referredUserId).all();

    if (referral.length === 0) return false; // No unqualified referral found

    const referrerUserId = referral[0].referrer_user_id;

    // Check if referred user has at least 1 link
    const { results: linkCheck } = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM links WHERE user_id = ?
    `).bind(referredUserId).all();

    if (linkCheck[0]?.count < 1) return false;

    // Check if referred user has >= 2 click events
    const { results: clickCheck } = await env.DB.prepare(`
      SELECT COUNT(*) as count 
      FROM click_events ce
      JOIN links l ON ce.link_id = l.id
      WHERE l.user_id = ?
    `).bind(referredUserId).all();

    if (clickCheck[0]?.count < 2) return false;

    // IP check if enabled
    const ipCheckEnabled = await getFeatureFlag(env, 'referrals_ip_check_enabled');
    if (ipCheckEnabled) {
      // Get referrer signup IP hash
      const { results: referrerIp } = await env.DB.prepare(`
        SELECT signup_ip_hash FROM users WHERE id = ?
      `).bind(referrerUserId).all();

      if (referrerIp.length > 0 && referrerIp[0].signup_ip_hash) {
        // Get click event IP hashes for referred user
        const { results: clickIps } = await env.DB.prepare(`
          SELECT DISTINCT ip_hash 
          FROM click_events ce
          JOIN links l ON ce.link_id = l.id
          WHERE l.user_id = ? AND ip_hash IS NOT NULL
        `).bind(referredUserId).all();

        // Require at least one click from different IP than referrer signup
        const hasDifferentIp = clickIps.some(click => 
          click.ip_hash !== referrerIp[0].signup_ip_hash
        );

        if (!hasDifferentIp) return false;
      }
      // If referrer signup IP is missing, skip IP check safely
    }

    return true; // All checks passed
  } catch (error) {
    console.error('Error checking referral qualification:', error);
    return false;
  }
}

/**
 * Try to qualify a referral if conditions are met
 * @param {Object} env - Cloudflare environment with DB binding
 * @param {string} referredUserId - The user ID to qualify
 * @returns {Promise<Object>} Result object with qualification status and details
 */
export async function tryQualifyReferral(env, referredUserId) {
  try {
    // Normalize user ID for consistent string comparison
    const cleanReferredUserId = String(parseInt(referredUserId, 10));
    console.log(`[REFERRAL QUALIFY DEBUG] tryQualifyReferral for user: ${referredUserId} -> clean: ${cleanReferredUserId}`);
    
    // Check if referrals are enabled
    const referralsEnabled = await getFeatureFlag(env, 'referrals_enabled');
    if (!referralsEnabled) {
      console.log(`[REFERRAL QUALIFY DEBUG] referrals_enabled flag is OFF`);
      return { attempted: true, qualified: false, reason: 'flag_off' };
    }

    // Check if referral relationship exists
    const { results: referral } = await env.DB.prepare(`
      SELECT id, referrer_user_id, is_qualified FROM referrals WHERE referred_user_id = ?
    `).bind(cleanReferredUserId).all();
    
    console.log(`[REFERRAL QUALIFY DEBUG] referral lookup result:`, referral);

    if (referral.length === 0) {
      console.log(`[REFERRAL QUALIFY DEBUG] no referral row found for user ${cleanReferredUserId}`);
      return { attempted: true, qualified: false, reason: 'no_referral_row' };
    }

    if (referral[0].is_qualified === 1) {
      console.log(`[REFERRAL QUALIFY DEBUG] user ${cleanReferredUserId} already qualified`);
      return { attempted: true, qualified: false, reason: 'already_qualified' };
    }

    // Check if referred user has at least 1 link
    const { results: linkCheck } = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM links WHERE user_id = ?
    `).bind(cleanReferredUserId).all();
    
    const linkCount = linkCheck[0]?.count || 0;
    console.log(`[REFERRAL QUALIFY DEBUG] link count for user ${cleanReferredUserId}: ${linkCount}`);

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
    console.log(`[REFERRAL QUALIFY DEBUG] click count for user ${cleanReferredUserId}: ${clickCount}`);

    if (clickCount < 2) {
      return { attempted: true, qualified: false, reason: 'not_enough_clicks', linkCount, clickCount };
    }

    // IP check if enabled
    const ipCheckEnabled = await getFeatureFlag(env, 'referrals_ip_check_enabled');
    if (ipCheckEnabled) {
      console.log(`[REFERRAL QUALIFY DEBUG] IP check enabled, performing validation`);
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

        // Require at least one click from different IP than referrer signup
        const hasDifferentIp = clickIps.some(click => 
          click.ip_hash !== referrerIp[0].signup_ip_hash
        );

        if (!hasDifferentIp) {
          console.log(`[REFERRAL QUALIFY DEBUG] IP check failed - all clicks from same IP`);
          return { attempted: true, qualified: false, reason: 'ip_check_failed', linkCount, clickCount };
        }
      }
    }

    // Update referral as qualified — also stamp first_qualified_at and attribution_status
    const qualifiedNow = new Date().toISOString();
    const result = await env.DB.prepare(`
      UPDATE referrals
      SET is_qualified      = 1,
          qualified_at      = CURRENT_TIMESTAMP,
          first_qualified_at = CASE WHEN first_qualified_at IS NULL THEN ? ELSE first_qualified_at END,
          attribution_status = 'qualified'
      WHERE referred_user_id = ?
    `).bind(qualifiedNow, cleanReferredUserId).run();

    console.log(`[REFERRAL QUALIFY DEBUG] qualification update result:`, result);

    if (result.success && result.changes > 0) {
      console.log(`[REFERRAL QUALIFY DEBUG] user ${cleanReferredUserId} successfully qualified!`);
      
      // Get referrer_user_id and referral id to check rewards and log events
      const { results: referralInfo } = await env.DB.prepare(`
        SELECT id, referrer_user_id FROM referrals WHERE referred_user_id = ?
      `).bind(cleanReferredUserId).all();
      
      if (referralInfo.length > 0) {
        const referrerUserId = referralInfo[0].referrer_user_id;
        const qualifiedReferralId = referralInfo[0].id;
        console.log(`[REFERRAL QUALIFY DEBUG] Checking rewards for referrer: ${referrerUserId}`);
        
        // Check and grant rewards (non-blocking)
        try {
          const rewardResult = await checkAndGrantReferralRewards(env, referrerUserId);
          console.log(`[REFERRAL QUALIFY DEBUG] Reward check result:`, rewardResult);
        } catch (rewardError) {
          console.error('[REFERRAL QUALIFY DEBUG] Reward check failed:', rewardError);
          // Don't fail qualification if reward check fails
        }

        // Log Creator Impact event (non-blocking)
        try {
          await logImpactEvent(env, {
            userId:         parseInt(referrerUserId, 10),
            referredUserId: parseInt(cleanReferredUserId, 10),
            referralId:     qualifiedReferralId,
            eventType:      'referral_qualified'
          });
          await upsertImpactStats(env, referrerUserId);
        } catch (impactError) {
          console.warn('[REFERRAL QUALIFY DEBUG] Creator Impact logging failed (non-fatal):', impactError.message);
        }
      }
      
      return { attempted: true, qualified: true, reason: 'qualified', linkCount, clickCount };
    } else {
      console.log(`[REFERRAL QUALIFY DEBUG] qualification update failed for user ${cleanReferredUserId}`);
      return { attempted: true, qualified: false, reason: 'update_failed', linkCount, clickCount };
    }
  } catch (error) {
    console.error('[REFERRAL QUALIFY DEBUG] Error qualifying referral:', error);
    return { attempted: true, qualified: false, reason: 'error', error: error.message };
  }
}

/**
 * Hash IP address for anti-abuse protection (SHA-256)
 * @param {string} ipAddress - The IP address to hash
 * @returns {Promise<string>} Hashed IP address
 */
export async function hashIpAddress(ipAddress) {
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

// Legacy functions kept for compatibility but not used in core path
export async function getUserReferralCode(userId, env) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT referral_code FROM users WHERE id = ? AND referral_code IS NOT NULL
    `).bind(userId).all();

    return results.length > 0 ? results[0].referral_code : null;
  } catch (error) {
    console.error('Error getting user referral code:', error);
    return null;
  }
}

export async function getUserReferralInfo(userId, env) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT r.referrer_user_id, r.is_qualified, r.qualified_at, u.referral_code
      FROM referrals r
      JOIN users u ON r.referrer_user_id = u.id
      WHERE r.referred_user_id = ?
      LIMIT 1
    `).bind(userId).all();

    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Error getting user referral info:', error);
    return null;
  }
}

/**
 * Check and grant referral milestone rewards for a user
 * @param {Object} env - Cloudflare environment with DB binding
 * @param {string} referrerUserId - The referrer user ID to check rewards for
 * @returns {Promise<Object>} Results of reward checking and granting
 */
export async function checkAndGrantReferralRewards(env, referrerUserId) {
  try {
    console.log(`[REFERRAL REWARDS DEBUG] Checking rewards for user: ${referrerUserId}`);
    
    // Check if referrals are enabled
    const referralsEnabled = await getFeatureFlag(env, 'referrals_enabled');
    if (!referralsEnabled) {
      console.log(`[REFERRAL REWARDS DEBUG] referrals_enabled is OFF, skipping rewards`);
      return { attempted: false, reason: 'referrals_disabled' };
    }

    // Check if referral rewards are enabled
    const rewardsEnabled = await getFeatureFlag(env, 'referrals_rewards_enabled');
    if (!rewardsEnabled) {
      console.log(`[REFERRAL REWARDS DEBUG] referrals_rewards_enabled is OFF, skipping rewards`);
      return { attempted: false, reason: 'rewards_disabled' };
    }

    // Normalize user ID for consistent string comparison
    const cleanReferrerUserId = String(parseInt(referrerUserId, 10));
    console.log(`[REFERRAL REWARDS DEBUG] Clean referrer user ID: ${cleanReferrerUserId}`);

    // Count qualified referrals
    const { results: qualifiedCountResult } = await env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM referrals
      WHERE referrer_user_id = ? AND is_qualified = 1
    `).bind(cleanReferrerUserId).all();

    const qualifiedCount = qualifiedCountResult[0]?.count || 0;
    console.log(`[REFERRAL REWARDS DEBUG] Qualified referral count: ${qualifiedCount}`);

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
      console.log(`[REFERRAL REWARDS DEBUG] Checking milestone: ${milestone.count} referrals`);

      // Only check if user has enough qualified referrals
      if (qualifiedCount >= milestone.count) {
        // Check if reward already granted using unlock flags
        const unlockField = milestone.count === 3 ? 'referral_3_unlocked' : 'referral_10_unlocked';
        try {
          const { results: existingUser } = await env.DB.prepare(`
            SELECT ${unlockField} FROM users WHERE id = ?
          `).bind(cleanReferrerUserId).all();

          if (existingUser.length > 0 && existingUser[0][unlockField]) {
            console.log(`[REFERRAL REWARDS DEBUG] Reward for milestone ${milestone.count} already unlocked`);
            skippedRewards.push({ milestone, reason: 'already_unlocked' });
            continue;
          }
        } catch (unlockCheckError) {
          // Column may not exist yet — proceed with granting (reward write is idempotent)
          console.warn(`[REFERRAL REWARDS DEBUG] ${unlockField} column check failed (non-fatal):`, unlockCheckError.message);
        }

        // Grant the reward
        const grantResult = await grantReferralReward(env, cleanReferrerUserId, milestone);
        if (grantResult.success) {
          console.log(`[REFERRAL REWARDS DEBUG] Successfully granted reward for milestone ${milestone.count}`);
          grantedRewards.push({ milestone, grantResult });
        } else {
          console.log(`[REFERRAL REWARDS DEBUG] Failed to grant reward for milestone ${milestone.count}: ${grantResult.reason}`);
          skippedRewards.push({ milestone, reason: grantResult.reason });
        }
      } else {
        console.log(`[REFERRAL REWARDS DEBUG] Not enough referrals for milestone ${milestone.count}`);
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
    console.error('[REFERRAL REWARDS DEBUG] Error checking/granting rewards:', error);
    return { attempted: true, reason: 'error', error: error.message };
  }
}

/**
 * Grant a specific referral reward to a user
 * @param {Object} env - Cloudflare environment with DB binding
 * @param {string} userId - The user ID to grant reward to
 * @param {Object} milestone - The milestone object {count, plan, days}
 * @returns {Promise<Object>} Result of reward granting
 */
async function grantReferralReward(env, userId, milestone) {
  try {
    console.log(`[REFERRAL REWARDS DEBUG] Granting reward: count=${milestone.count}, plan=${milestone.plan}, days=${milestone.days}`);

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
    console.log(`[REFERRAL REWARDS DEBUG] Current user plan: ${currentUser.plan}, status: ${currentUser.subscription_status}`);

    // Safety checks for paid subscribers - only update referral reward fields, never billing fields
    if (currentUser.subscription_status === 'active' && currentUser.plan !== 'free') {
      console.log(`[REFERRAL REWARDS DEBUG] User has active paid subscription, recording reward but not changing billing state`);
      // Still record the reward as granted but don't change their billing plan
    } else {
      // User is free or has referral reward - can safely update referral reward fields
      // NEW RULE: Overwrite expiration, do NOT extend, do NOT stack
      console.log(`[REFERRAL REWARDS DEBUG] Setting referral reward: plan=${milestone.plan}, expires=${expiresAtISO}`);
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
      console.log(`[REFERRAL REWARDS DEBUG] Set ${unlockField} = 1`);
    } catch (unlockError) {
      // Column may not exist yet if migration hasn't been applied
      console.warn(`[REFERRAL REWARDS DEBUG] Failed to set ${unlockField} (non-fatal):`, unlockError.message);
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
      console.log(`[REFERRAL REWARDS DEBUG] Recorded reward in referral_rewards table`);
    } catch (trackingError) {
      // Don't fail the grant if tracking table INSERT fails (table may not exist yet)
      console.warn(`[REFERRAL REWARDS DEBUG] Failed to record in referral_rewards table (non-fatal):`, trackingError.message);
    }

    // Log Creator Impact reward event and refresh stats (non-blocking)
    try {
      await logImpactEvent(env, {
        userId:       parseInt(userId, 10),
        eventType:    'reward_granted',
        plan:         milestone.plan,
        eventDataJson: {
          milestone_count: milestone.count,
          reward_days:     milestone.days,
          expires_at:      expiresAtISO
        }
      });
      await upsertImpactStats(env, userId);
    } catch (impactError) {
      console.warn('[REFERRAL REWARDS DEBUG] Creator Impact logging failed (non-fatal):', impactError.message);
    }

    return { 
      success: true, 
      rewardId,
      expiresAt: expiresAtISO,
      plan: milestone.plan,
      days: milestone.days
    };

  } catch (error) {
    console.error('[REFERRAL REWARDS DEBUG] Error granting reward:', error);
    return { success: false, reason: 'error', error: error.message };
  }
}

/**
 * Update user's subscription plan safely
 * @param {Object} env - Cloudflare environment with DB binding
 * @param {string} userId - The user ID to update
 * @param {string} plan - The new plan
 * @param {string} status - The subscription status
 * @param {string} expiresAt - The expiration date
 */
async function updateUserPlan(env, userId, plan, status, expiresAt) {
  try {
    let updateQuery, updateParams;
    
    if (status === 'referral_reward') {
      // For referral rewards, write only new fields (Phase 2C-1) - never update plan
      updateQuery = `
        UPDATE users 
        SET referral_reward_active = 1,
            referral_reward_plan = ?,
            referral_reward_expires_at = ?
        WHERE id = ?
      `;
      updateParams = [plan, expiresAt, userId];
    } else {
      // For non-reward updates, preserve referral reward fields if they exist
      updateQuery = `
        UPDATE users 
        SET plan = ?, subscription_status = ?, subscription_current_period_end = ?
        WHERE id = ?
      `;
      updateParams = [plan, status, expiresAt, userId];
    }
    
    const { results: updateResult } = await env.DB.prepare(updateQuery).bind(...updateParams).all();

    console.log(`[REFERRAL REWARDS DEBUG] Updated user plan: ${plan}, status: ${status}, expires: ${expiresAt}`);
    return updateResult.length > 0;
  } catch (error) {
    console.error('[REFERRAL REWARDS DEBUG] Error updating user plan:', error);
    return false;
  }
}
