import { getAuthenticatedUser } from '../auth-helper.js';
import { hasEffectiveProAccess, hasFounderAccess } from '../entitlement-helper.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Get authenticated user with full Stripe billing state
    const user = await getAuthenticatedUser(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // CRITICAL: Block deletion if ANY active Stripe subscription billing state exists
    // This applies to ALL users including Founder users to prevent orphaned live subscriptions
    // Founder users WITHOUT active billing should still be allowed to delete
    const hasActiveStripeSubscription = user.subscription_status === 'active' || 
                                        user.subscription_status === 'past_due' ||
                                        user.subscription_status === 'trialing';

    // Block if user has active Stripe billing (even if they also have Founder access)
    if (hasActiveStripeSubscription) {
      return new Response(
        JSON.stringify({ 
          error: 'Cannot delete account with active Stripe billing. Please cancel your subscription in Stripe first, then wait for the cancellation to process before deleting your account.' 
        }), 
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Additional check: Block deletion for paid Pro and referral Pro users (non-Stripe billing)
    // This preserves the existing referral reward protection
    const hasEffectivePro = hasEffectiveProAccess(user);
    const isFounder = hasFounderAccess(user);

    // Block deletion for paid Pro and referral Pro users, but allow Founder users
    if (hasEffectivePro && !isFounder) {
      return new Response(
        JSON.stringify({ 
          error: 'Account deletion is currently available for free accounts only. Please cancel billing or wait for referral access to expire first.' 
        }), 
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Soft delete user account
    await env.DB.prepare(`
      UPDATE users 
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(user.id).run();

    // Disable all links for this user
    await env.DB.prepare(`
      UPDATE links 
      SET is_active = 0 
      WHERE user_id = ?
    `).bind(user.id).run();

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Account deleted successfully' 
      }), 
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error deleting account:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete account' }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
