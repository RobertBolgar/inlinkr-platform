// Creator Impact helper functions for Cloudflare Pages Functions
// Provides non-blocking event logging, stats rollup, and referral conversion stamping.
// All public functions are safe to call from any event handler — they never throw
// and never block the primary user flow.

/**
 * Log a Creator Impact event to the creator_impact_events append-only ledger.
 * @param {Object} env - Cloudflare environment with DB binding
 * @param {Object} opts
 * @param {number}  opts.userId           - Referrer user ID (owner of this impact)
 * @param {number}  [opts.referredUserId] - Referred user who triggered the event
 * @param {string}  [opts.referralId]     - FK to referrals.id
 * @param {string}  opts.eventType        - Event classification string
 * @param {string}  [opts.plan]           - Plan context ('pro', 'founder', etc.)
 * @param {Object|string} [opts.eventDataJson] - Additional event payload
 * @param {string}  [opts.eventSource]    - 'live' | 'backfill' | 'admin_repair'
 * @param {boolean} [opts.isBackfill]     - Whether this is a backfilled event
 * @param {string}  [opts.createdAt]      - ISO timestamp (defaults to now)
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
export async function logImpactEvent(env, {
  userId,
  referredUserId = null,
  referralId = null,
  eventType,
  plan = null,
  eventDataJson = null,
  eventSource = 'live',
  isBackfill = false,
  createdAt = null
}) {
  try {
    const id = crypto.randomUUID();
    const now = createdAt || new Date().toISOString();
    const dataJson = eventDataJson
      ? (typeof eventDataJson === 'string' ? eventDataJson : JSON.stringify(eventDataJson))
      : null;

    await env.DB.prepare(`
      INSERT INTO creator_impact_events (
        id, user_id, referred_user_id, referral_id, event_type,
        plan, event_data_json, event_source, is_backfill, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      userId,
      referredUserId,
      referralId,
      eventType,
      plan,
      dataJson,
      eventSource,
      isBackfill ? 1 : 0,
      now
    ).run();

    return { success: true, id };
  } catch (error) {
    console.error('[IMPACT EVENT ERROR] Failed to log impact event:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Upsert creator_impact_stats for a referrer by recomputing from the referrals table.
 * Safe to call repeatedly — always reflects current ground truth.
 * @param {Object} env - Cloudflare environment with DB binding
 * @param {string|number} referrerUserId - The referrer's user ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function upsertImpactStats(env, referrerUserId) {
  try {
    const cleanId = String(parseInt(referrerUserId, 10));
    const intId = parseInt(cleanId, 10);
    const now = new Date().toISOString();

    // Recompute referral volume from referrals table
    const stats = await env.DB.prepare(`
      SELECT
        COUNT(*)                                                         AS total_referrals,
        SUM(CASE WHEN is_qualified       = 1 THEN 1 ELSE 0 END)        AS qualified_referrals,
        SUM(CASE WHEN is_paid_conversion = 1 THEN 1 ELSE 0 END)        AS paid_referrals,
        SUM(CASE WHEN is_pro_conversion  = 1 THEN 1 ELSE 0 END)        AS pro_referrals,
        SUM(CASE WHEN is_founder_conversion = 1 THEN 1 ELSE 0 END)     AS founder_referrals,
        MIN(COALESCE(captured_at, created_at))                          AS first_referral_at,
        MAX(COALESCE(captured_at, created_at))                          AS last_referral_at,
        MIN(first_paid_at)                                              AS first_paid_referral_at,
        MAX(latest_paid_at)                                             AS last_paid_referral_at
      FROM referrals
      WHERE referrer_user_id = ?
    `).bind(cleanId).first();

    // Recount reward grants
    const rewardRow = await env.DB.prepare(`
      SELECT COUNT(*) AS rewards_granted
      FROM referral_rewards
      WHERE user_id = ?
    `).bind(cleanId).first();

    const s = stats || {};
    const rewards_granted = rewardRow?.rewards_granted || 0;

    // Upsert (INSERT OR REPLACE preserves ambassador_status and badges_json)
    const existing = await env.DB.prepare(
      'SELECT id, ambassador_status, badges_json FROM creator_impact_stats WHERE user_id = ?'
    ).bind(intId).first();

    if (existing) {
      await env.DB.prepare(`
        UPDATE creator_impact_stats
        SET
          total_referrals        = ?,
          qualified_referrals    = ?,
          paid_referrals         = ?,
          pro_referrals          = ?,
          founder_referrals      = ?,
          rewards_granted        = ?,
          first_referral_at      = ?,
          last_referral_at       = ?,
          first_paid_referral_at = ?,
          last_paid_referral_at  = ?,
          updated_at             = ?
        WHERE user_id = ?
      `).bind(
        s.total_referrals    || 0,
        s.qualified_referrals || 0,
        s.paid_referrals     || 0,
        s.pro_referrals      || 0,
        s.founder_referrals  || 0,
        rewards_granted,
        s.first_referral_at      || null,
        s.last_referral_at       || null,
        s.first_paid_referral_at || null,
        s.last_paid_referral_at  || null,
        now,
        intId
      ).run();
    } else {
      await env.DB.prepare(`
        INSERT INTO creator_impact_stats (
          id, user_id,
          total_referrals, qualified_referrals, paid_referrals,
          pro_referrals, founder_referrals, rewards_granted,
          first_referral_at, last_referral_at,
          first_paid_referral_at, last_paid_referral_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        intId,
        s.total_referrals    || 0,
        s.qualified_referrals || 0,
        s.paid_referrals     || 0,
        s.pro_referrals      || 0,
        s.founder_referrals  || 0,
        rewards_granted,
        s.first_referral_at      || null,
        s.last_referral_at       || null,
        s.first_paid_referral_at || null,
        s.last_paid_referral_at  || null,
        now
      ).run();
    }

    return { success: true };
  } catch (error) {
    console.error('[IMPACT STATS ERROR] Failed to upsert creator_impact_stats:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Stamp a referral row with paid conversion details and emit Creator Impact events.
 * Called from the Stripe webhook on Pro upgrade and Founder purchase.
 * Non-blocking: returns { success: false } on error rather than throwing.
 *
 * @param {Object} env - Cloudflare environment with DB binding
 * @param {string|number} referredUserId - The user who just converted
 * @param {string} conversionType        - 'pro' | 'pro_plus' | 'founder'
 * @param {Object} [opts]
 * @param {string} [opts.conversionDate] - ISO timestamp (defaults to now)
 * @param {Object} [opts.metadata]       - Extra fields to store in metadata_json
 * @returns {Promise<{success: boolean, referralId?: string, referrerUserId?: string, reason?: string, error?: string}>}
 */
export async function stampReferralConversion(env, referredUserId, conversionType, {
  conversionDate = null,
  metadata = null
} = {}) {
  try {
    const cleanReferredUserId = String(parseInt(referredUserId, 10));
    const now = conversionDate || new Date().toISOString();

    // Find the referral row for this referred user
    const referral = await env.DB.prepare(`
      SELECT id, referrer_user_id,
             is_paid_conversion, is_pro_conversion, is_founder_conversion,
             first_paid_at, first_pro_at, first_founder_at, paid_conversion_count
      FROM referrals
      WHERE referred_user_id = ?
    `).bind(cleanReferredUserId).first();

    if (!referral) {
      // User was not referred — nothing to stamp, not an error
      return { success: true, reason: 'not_referred' };
    }

    const isPro     = conversionType === 'pro' || conversionType === 'pro_plus';
    const isFounder = conversionType === 'founder';

    // Build the set of fields to update
    const updates = {
      is_paid_conversion:    1,
      latest_paid_at:        now,
      latest_paid_plan:      conversionType,
      paid_conversion_count: (referral.paid_conversion_count || 0) + 1,
      attribution_status:    'paid'
    };

    // Only write first_paid_* if not already recorded
    if (!referral.first_paid_at) {
      updates.first_paid_at   = now;
      updates.first_paid_plan = conversionType;
    }

    if (isPro) {
      updates.is_pro_conversion = 1;
      if (!referral.first_pro_at) {
        updates.first_pro_at = now;
      }
    }

    if (isFounder) {
      updates.is_founder_conversion = 1;
      if (!referral.first_founder_at) {
        updates.first_founder_at = now;
      }
    }

    if (metadata) {
      updates.metadata_json = typeof metadata === 'string'
        ? metadata
        : JSON.stringify(metadata);
    }

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values     = Object.values(updates);

    await env.DB.prepare(
      `UPDATE referrals SET ${setClauses} WHERE id = ?`
    ).bind(...values, referral.id).run();

    // Emit Creator Impact event
    const eventType = isFounder ? 'founder_converted' : 'pro_converted';
    await logImpactEvent(env, {
      userId:         parseInt(referral.referrer_user_id, 10),
      referredUserId: parseInt(cleanReferredUserId, 10),
      referralId:     referral.id,
      eventType,
      plan:           conversionType,
      eventDataJson:  metadata || null
    });

    // Refresh stats rollup for the referrer
    await upsertImpactStats(env, referral.referrer_user_id);

    return {
      success:       true,
      referralId:    referral.id,
      referrerUserId: referral.referrer_user_id,
      eventType
    };
  } catch (error) {
    console.error('[IMPACT STAMP ERROR] Failed to stamp referral conversion:', error);
    return { success: false, error: error.message };
  }
}
