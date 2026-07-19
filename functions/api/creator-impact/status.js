// GET /api/creator-impact/status
// Returns the authenticated user's Creator Impact stats, referral link,
// and recent referral list for use in the future Settings Creator Impact section.

import { getAuthenticatedUser } from '../auth-helper.js';
import { getConfig } from '../lib/config.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const config = getConfig(env);

  try {
    const user = await getAuthenticatedUser(request, env);
    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const userId = user.id;

    // Fetch referral code separately (not included in getAuthenticatedUser)
    const referralCodeRow = await env.DB.prepare(
      'SELECT referral_code FROM users WHERE id = ?'
    ).bind(userId).first();

    const referralCode = referralCodeRow?.referral_code || null;
    const referralUrl  = referralCode && user.username
      ? `${config.redirectBaseUrl}/${user.username}/invite`
      : null;

    // Fetch Creator Impact stats rollup
    const stats = await env.DB.prepare(
      'SELECT * FROM creator_impact_stats WHERE user_id = ?'
    ).bind(userId).first();

    // Fetch the 10 most recent referrals with attribution fields
    const { results: recentReferrals } = await env.DB.prepare(`
      SELECT
        r.id,
        r.referred_user_id,
        r.is_qualified,
        r.is_paid_conversion,
        r.is_pro_conversion,
        r.is_founder_conversion,
        r.attribution_status,
        r.captured_at,
        r.first_qualified_at,
        r.first_paid_at,
        r.first_paid_plan,
        r.latest_paid_at,
        r.latest_paid_plan,
        r.paid_conversion_count
      FROM referrals r
      WHERE r.referrer_user_id = ?
      ORDER BY COALESCE(r.captured_at, r.created_at) DESC
      LIMIT 10
    `).bind(String(userId)).all();

    // Normalise stats — return zeros when no row exists yet
    const impactStats = stats
      ? {
          total_referrals:        stats.total_referrals        || 0,
          qualified_referrals:    stats.qualified_referrals    || 0,
          paid_referrals:         stats.paid_referrals         || 0,
          pro_referrals:          stats.pro_referrals          || 0,
          founder_referrals:      stats.founder_referrals      || 0,
          rewards_granted:        stats.rewards_granted        || 0,
          first_referral_at:      stats.first_referral_at      || null,
          last_referral_at:       stats.last_referral_at       || null,
          first_paid_referral_at: stats.first_paid_referral_at || null,
          last_paid_referral_at:  stats.last_paid_referral_at  || null,
          ambassador_status:      stats.ambassador_status      || null,
          badges_json:            stats.badges_json            || null,
          updated_at:             stats.updated_at             || null
        }
      : {
          total_referrals:        0,
          qualified_referrals:    0,
          paid_referrals:         0,
          pro_referrals:          0,
          founder_referrals:      0,
          rewards_granted:        0,
          first_referral_at:      null,
          last_referral_at:       null,
          first_paid_referral_at: null,
          last_paid_referral_at:  null,
          ambassador_status:      null,
          badges_json:            null,
          updated_at:             null
        };

    return jsonResponse({
      success: true,
      data: {
        stats:          impactStats,
        referralCode,
        referralUrl,
        recentReferrals: recentReferrals || []
      }
    });
  } catch (error) {
    console.error('[CREATOR IMPACT STATUS] Error:', error);
    return jsonResponse({ error: 'Failed to fetch Creator Impact status' }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
