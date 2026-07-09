import { Layout } from '../components/Layout';
import { Check } from 'lucide-react';
import { useAuth as useAppAuth } from '../contexts/AuthContext';
import { useAuth as useClerkAuth } from '../lib/auth/clerk';
import { useState, useEffect } from 'react';
import { SubscriptionHubModal } from '../components/SubscriptionHubModal';
import { PlanChangeConfirmModal } from '../components/PlanChangeConfirmModal';
import { useNavigate } from 'react-router-dom';
import { analytics } from '../lib/analytics';
import { getEffectivePlan } from '../lib/plan';

export function UpgradePage() {
  const { user } = useAppAuth();
  const { getToken } = useClerkAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [billingInterval, setBillingInterval] = useState('yearly');
  const [billingLoading, setBillingLoading] = useState(false);
  const [showSubscriptionHub, setShowSubscriptionHub] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [showPlanChangeConfirm, setShowPlanChangeConfirm] = useState(false);
  const [pendingPlanChange, setPendingPlanChange] = useState<string>('');
  const [founderSoldOut, setFounderSoldOut] = useState(false);
  const [founderClaimed, setFounderClaimed] = useState<number | null>(null);

  // Use effective plan to determine current plan (includes referral rewards and founder access)
  const effectivePlan = getEffectivePlan(user);

  // Paid Pro: active Stripe subscription with a customer ID
  const isActivePaid = user?.subscription_status === 'active' && Boolean(user?.stripe_customer_id);
  const isPaidPro = isActivePaid && (user?.plan === 'pro' || user?.plan === 'pro_plus');
  // Referral Pro: has effective pro access but is NOT a paid subscriber
  const isReferralPro = effectivePlan === 'pro' && !isPaidPro;
  // Founder Access: has founder access (separate entitlement layer)
  const isFounder = effectivePlan === 'founder';

  // Fetch founder stats on mount (lightweight, no polling)
  useEffect(() => {
    const fetchFounderStats = async () => {
      try {
        const response = await fetch('/api/founder-stats');
        if (response.ok) {
          const data = await response.json();
          setFounderClaimed(data.claimed);
        }
      } catch (error) {
        // Silent fail - fallback to static copy only
        console.error('Failed to fetch founder stats:', error);
      }
    };

    fetchFounderStats();
  }, []);

  const plans = [
    {
      name: 'Free',
      price: '$0',
      features: [
        '5 Smart Links',
        'Connect your YouTube channel',
        'Placement tracking',
        'Placement analytics'
      ],
      isCurrent: effectivePlan === 'free',
      isBestValue: false,
      creatorChoice: false
    },
    {
      name: 'Pro',
      price: billingInterval === 'yearly' ? '$16.42/mo' : '$19/mo',
      priceNote: billingInterval === 'yearly' ? 'Billed yearly at $197' : '',
      savings: billingInterval === 'yearly' ? 'Save $31/year' : undefined,
      features: [
        'Unlimited links',
        'Branded subdomain: username.tubelinkr.com',
        'Creator hub',
        'Professional creator toolkit'
      ],
      isCurrent: isPaidPro,
      isBestValue: true,
      creatorChoice: true
    },
    {
      name: 'Founder Access',
      price: '$97',
      priceNote: 'One-time founder access',
      badge: 'First 50 creators',
      features: [
        'Lifetime access to TubeLinkr Pro for early supporters helping shape the future of creator placement analytics',
        'Founder badge & early supporter status',
        'Lock in early creator access',
        'Help shape future creator attribution tools',
        'Limited to first 50 paid founders'
      ],
      isCurrent: isFounder,
      isBestValue: false,
      creatorChoice: false,
      isFounder: true
    }
  ];

  const displayPlans = plans;

  const handleUpgradeClick = (planName: string) => {
    if (!user?.email || !user?.id) {
      setCheckoutError('You must be logged in to upgrade');
      return;
    }

    // Founder checkout goes directly without confirmation modal
    if (planName === 'Founder Access') {
      executeCheckout('founder');
      return;
    }

    // Check if user is an existing paid user
    const isPaidUser = user.subscription_status === 'active' && user.plan === 'pro';

    if (isPaidUser) {
      // Show confirmation modal for paid users
      setPendingPlanChange(planName);
      setShowPlanChangeConfirm(true);
    } else {
      // Direct checkout for free users
      executeCheckout(planName);
    }
  };

  const executeCheckout = async (planName: string) => {
    if (!user?.email || !user?.id) {
      setCheckoutError('You must be logged in to upgrade');
      return;
    }

    // Clear any previous error and sold out state
    setCheckoutError('');
    setFounderSoldOut(false);
    setLoading(true);

    try {
      const plan = planName.toLowerCase();
      const isFounder = plan === 'founder';

      const token = await getToken();
      if (!token) {
        setCheckoutError('Authentication failed. Please log in again.');
        return;
      }

      // Founder checkout doesn't use billing interval
      const body = isFounder
        ? { plan }
        : { plan: 'pro', billingInterval };

      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle founder sold out specifically
        if (response.status === 409 && isFounder) {
          setFounderSoldOut(true);
          setCheckoutError('Founder Access is sold out. Only the first 50 paid founders are accepted.');
          return;
        }
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        analytics.trackCheckoutOpened(plan, isFounder ? 'one-time' : billingInterval);
        window.location.href = data.url;
      } else {
        throw new Error('No URL returned');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      setCheckoutError(error.message || 'Failed to start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanChangeConfirm = () => {
    setShowPlanChangeConfirm(false);
    executeCheckout(pendingPlanChange);
  };

  const handleManageBilling = async () => {
    if (!user?.id) {
      alert('You must be logged in to manage billing');
      return;
    }

    // Guard: only paid active subscribers may open the billing portal
    const hasPaidSubscription = user?.subscription_status === 'active' && user?.stripe_customer_id;
    if (!hasPaidSubscription) {
      return;
    }

    analytics.trackPortalOpened('upgrade_page');
    setBillingLoading(true);

    try {
      const token = await getToken();
      if (!token) {
        alert('Authentication failed. Please log in again.');
        return;
      }

      const response = await fetch('/api/stripe/create-billing-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create billing portal session');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No billing portal URL returned');
      }
    } catch (error: any) {
      console.error('Billing portal error:', error);
      alert(error.message || 'Failed to open billing portal. Please try again.');
    } finally {
      setBillingLoading(false);
    }
  };

  const handleUpgradeToProPlus = () => {
    setShowSubscriptionHub(false);
    navigate('/upgrade');
  };

  const handleUpgradeToPro = () => {
    setShowSubscriptionHub(false);
    navigate('/upgrade');
  };
  const handleOpenSubscriptionHub = () => {
    setShowSubscriptionHub(true);
  };

  const getButtonForPlan = (plan: any) => {
    if (plan.name === 'Free') {
      return { text: '', disabled: true, show: false, isBilling: false };
    }

    if (plan.name === 'Pro') {
      // Paid active Pro: show billing management actions
      if (isPaidPro) {
        if (user?.subscription_status === 'canceled') {
          return { text: 'Resubscribe', disabled: false, show: true, isBilling: false };
        }
        if (user?.subscription_status === 'past_due') {
          return { text: 'Change plan or cancel', disabled: false, show: true, isBilling: true };
        }
        // active paid
        return { text: 'Change plan or cancel', disabled: false, show: true, isBilling: true };
      }

      // Referral Pro: temporary access — offer upgrade to paid
      if (isReferralPro) {
        return { text: 'Upgrade to paid Pro', disabled: false, show: true, isBilling: false };
      }

      // Free user upgrading to Pro
      return { text: 'Upgrade to Pro', disabled: false, show: true, isBilling: false };
    }

    if (plan.name === 'Founder Access') {
      // Founder Access: one-time payment
      if (isFounder) {
        return { text: 'Founder Access granted', disabled: true, show: true, isBilling: false };
      }

      if (founderSoldOut) {
        return { text: 'Sold out', disabled: true, show: true, isBilling: false };
      }

      return { text: 'Claim founder access', disabled: false, show: true, isBilling: false };
    }

    return { text: '', disabled: true, show: false, isBilling: false };
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Upgrade when you're ready for more.
          </h1>
          <p className="text-lg text-gray-400 mb-8">
            Free gets you started. Pro gives you unlimited tracking, branded links, and your creator hub.
          </p>

          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setBillingInterval('monthly')}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                billingInterval === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('yearly')}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                billingInterval === 'yearly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Yearly
            </button>
          </div>
        </div>

        {checkoutError && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-8">
            <p className="text-red-400">{checkoutError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {displayPlans.map((plan) => {
            const buttonConfig = getButtonForPlan(plan);
            return (
              <div
                key={plan.name}
                className={`bg-gray-900 border rounded-lg p-6 relative ${
                  plan.isCurrent
                    ? 'border-blue-500 ring-2 ring-blue-500/20'
                    : plan.isBestValue
                    ? 'border-purple-500 ring-2 ring-purple-500/20'
                    : 'border-gray-800'
                }`}
              >
                {plan.isBestValue && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-purple-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      Best Value
                    </span>
                  </div>
                )}
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-amber-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      {plan.badge}
                    </span>
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {plan.name}
                    {plan.isCurrent && (
                      <span className="ml-2 text-sm text-blue-400">(Current)</span>
                    )}
                  </h3>
                  <p className="text-2xl font-bold text-white">{plan.price}</p>
                  {plan.priceNote && (
                    <p className="text-sm text-gray-500 mt-1">{plan.priceNote}</p>
                  )}
                  {plan.isFounder && (
                    <p className="text-xs text-gray-600 mt-2">
                      Limited to 50 paid founders{founderClaimed !== null && ` • ${founderClaimed} already claimed`}
                    </p>
                  )}
                </div>
                {plan.savings && (
                  <div className="text-center mb-4">
                    <span className="bg-green-600 text-white text-xs font-semibold px-3 py-1 rounded-full inline-block">
                      {plan.savings}
                    </span>
                  </div>
                )}
                {plan.creatorChoice && (
                  <div className="text-center mb-4">
                    <span className="bg-orange-600 text-white text-xs font-semibold px-3 py-1 rounded-full inline-block">
                      🔥 Most creators choose Pro
                    </span>
                  </div>
                )}

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {buttonConfig.show && (
                  <button
                    disabled={buttonConfig.disabled || loading || billingLoading}
                    onClick={() => buttonConfig.isBilling ? handleOpenSubscriptionHub() : handleUpgradeClick(plan.name)}
                    className={`w-full px-6 py-3 font-medium rounded-lg transition-colors ${
                      buttonConfig.disabled || loading || billingLoading
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : buttonConfig.isBilling
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {billingLoading ? 'Opening...' : loading ? 'Processing...' : buttonConfig.text}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 mb-2">
            Connect your channel and start tracking in minutes.
          </p>
          <p className="text-sm text-gray-500">
            Your branded link is active while your Pro plan is active.
            Your standard TubeLinkr link always remains available.
          </p>
          {user?.plan === 'pro' && user?.subscription_status === 'active' && (
            <p className="text-sm text-gray-500 mt-2">
              You can update payment details, switch plans, or cancel through Stripe.
            </p>
          )}
        </div>
      </div>

      <PlanChangeConfirmModal
        isOpen={showPlanChangeConfirm}
        onClose={() => setShowPlanChangeConfirm(false)}
        onConfirm={handlePlanChangeConfirm}
        currentPlan={user?.plan || 'free'}
        newPlan={pendingPlanChange.toLowerCase()}
        billingInterval={billingInterval}
        isProToProPlus={false}
      />

      <SubscriptionHubModal
        isOpen={showSubscriptionHub}
        onClose={() => setShowSubscriptionHub(false)}
        plan={effectivePlan}
        user={user}
        onUpgradeToPro={handleUpgradeToPro}
        onUpgradeToProPlus={handleUpgradeToProPlus}
        onManageBilling={handleManageBilling}
      />
    </Layout>
  );
}
