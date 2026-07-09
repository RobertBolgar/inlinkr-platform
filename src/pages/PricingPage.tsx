import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getCheckoutIntentUrl, CheckoutPlan, clearPendingRedirect } from '../lib/pending-redirect';
import { PublicNav } from '../components/PublicNav';
import { useFounderStats } from '../lib/hooks/useFounderStats';

export function PricingPage() {
  const [billingInterval, setBillingInterval] = useState('yearly');
  const { isSignedIn } = useAuth();
  const { isSoldOut, displayText } = useFounderStats();

  const checkoutLink = (planKey: CheckoutPlan) => {
    return getCheckoutIntentUrl(planKey, isSignedIn ?? false);
  };

  const proKey = billingInterval === 'yearly' ? 'pro_yearly' : 'pro_monthly';

  // Clear stale pending redirect if user is already signed in and visits pricing directly
  useEffect(() => {
    if (isSignedIn) {
      clearPendingRedirect();
    }
  }, [isSignedIn]);

  const plans = [
    {
      name: 'Free',
      price: '$0',
      features: [
        '5 Smart Links',
        'Connect your YouTube channel',
        'Placement tracking',
        'Placement analytics',
        'No credit card required',
        'No expiration',
      ],
      isBestValue: false,
      creatorChoice: false,
      cta: { text: 'Start Free', link: isSignedIn ? '/dashboard' : '/signup', primary: false }
    },
    {
      name: 'Pro',
      price: billingInterval === 'yearly' ? '$197/year' : '$19/mo',
      priceNote: billingInterval === 'yearly' ? 'just $16/mo, billed annually' : '',
      savings: billingInterval === 'yearly' ? 'Save $31/year' : undefined,
      features: [
        'Unlimited links',
        'Branded subdomain: username.tubelinkr.com',
        'Creator hub',
        'Proof pages',
        'Real-time analytics',
        'Proof pages for sponsor outreach',
      ],
      isBestValue: true,
      creatorChoice: true,
      cta: { text: billingInterval === 'yearly' ? 'Start Pro — $197/year' : 'Start Pro — $19/mo', link: checkoutLink(proKey), primary: true }
    },
    {
      name: 'Founder Access',
      price: '$97',
      priceNote: 'One-time founder access',
      badge: 'First 50 creators',
      features: [
        'Lifetime Pro access — pay once, never again',
        'Founder badge — permanent early supporter recognition',
        'Lock in Pro pricing for life',
        'Direct input on the product roadmap',
        'Limited to first 50 paid founders',
      ],
      isBestValue: false,
      creatorChoice: false,
      isFounder: true,
      cta: { text: 'Claim Founder Access — $97 Once', link: checkoutLink('founder'), primary: true, urgency: '50 spots total. Closes permanently when full.' }
    }
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNav />

      <div className="max-w-6xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Stop Guessing Which Videos Make You Money.
          </h1>
          <p className="text-lg text-gray-400 mb-8 max-w-2xl mx-auto">
            Free gets you started. Pro shows you exactly what's working.
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`bg-gray-900 border rounded-lg p-6 relative ${
                plan.isBestValue
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
                </h3>
                <p className="text-2xl font-bold text-white">{plan.price}</p>
                {plan.priceNote && (
                  <p className="text-sm text-gray-500 mt-1">{plan.priceNote}</p>
                )}
                {plan.isFounder && (
                  <p className="text-xs text-gray-600 mt-2">
                    {displayText}
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

              {plan.isFounder && isSoldOut ? (
                <>
                  <button
                    disabled
                    className="w-full px-6 py-3 font-medium rounded-lg transition-colors text-center block bg-gray-700 text-gray-400 cursor-not-allowed"
                  >
                    All 50 Spots Claimed
                  </button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    <Link to={isSignedIn ? '/upgrade' : '/signup'} className="text-blue-400 hover:text-blue-300">
                      Upgrade to Pro to get started →
                    </Link>
                  </p>
                </>
              ) : (
                <Link
                  to={plan.cta.link}
                  className={`w-full px-6 py-3 font-medium rounded-lg transition-colors text-center block ${
                    plan.cta.primary
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-800 hover:bg-gray-700 text-white'
                  }`}
                >
                  {plan.cta.text}
                </Link>
              )}
              {plan.cta.urgency && !isSoldOut && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  {plan.cta.urgency}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 mb-2">
            Connect your channel and start tracking in minutes.
          </p>
          <p className="text-sm text-gray-500">
            Your branded link is active while your Pro plan is active.
            Your standard TubeLinkr link always remains available.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800/40 pb-8 pt-8 text-center">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-center gap-6 text-sm text-gray-500 mb-4 flex-wrap">
            <Link to="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-gray-400 transition-colors">Terms</Link>
            <Link to="/support" className="hover:text-gray-400 transition-colors">Support</Link>
            <Link to="/login" className="hover:text-gray-400 transition-colors">Sign In</Link>
          </div>
          <p className="text-xs text-gray-600">
            TubeLinkr — YouTube attribution for creators who are done guessing.
          </p>
        </div>
      </footer>
    </div>
  );
}
