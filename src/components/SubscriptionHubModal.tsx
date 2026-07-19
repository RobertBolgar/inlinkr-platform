import { X } from 'lucide-react';
import { User } from '../lib/cloudflare';

interface SubscriptionHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: 'free' | 'pro' | 'pro_plus' | 'founder';
  user: User | null;
  onUpgradeToPro: () => void;
  onUpgradeToProPlus: () => void; // kept for prop compatibility
  onManageBilling: () => void;
}

export function SubscriptionHubModal({ 
  isOpen, 
  onClose, 
  plan, 
  user,
  onUpgradeToPro, 
  onManageBilling 
}: SubscriptionHubModalProps) {
  // Treat pro_plus as pro for launch — historical users get billing management
  // Founder access is separate from Stripe subscriptions
  const displayPlan = plan === 'pro_plus' ? 'pro' : plan;
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Plan-specific content */}
        {displayPlan === 'free' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">
                You're on the Free plan
              </h2>
              <p className="text-gray-300 mb-4">
                Upgrade to get more room to track:
              </p>
              <ul className="space-y-2 text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">•</span>
                  <span>More Smart Links</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">•</span>
                  <span>YouTube video insights</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">•</span>
                  <span>Better performance tracking</span>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <button
                onClick={onUpgradeToPro}
                className="w-full px-6 py-3 bg-primary hover:bg-primary text-white font-medium rounded-lg transition-colors"
              >
                Upgrade to Pro
              </button>
              <button
                onClick={onClose}
                className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
              >
                Maybe later
              </button>
            </div>
          </div>
        )}

        {displayPlan === 'pro' && (() => {
          const isPaidSubscription = user?.subscription_status === 'active' && Boolean(user?.stripe_customer_id);
          const isReferralOnly = !isPaidSubscription;
          return (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">
                    {isReferralOnly ? 'Referral Pro Active' : 'You\'re on Pro'}
                  </h2>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                    isPaidSubscription
                      ? 'bg-green-900/20 text-green-400 border border-green-700/30'
                      : 'bg-blue-900/20 text-blue-400 border border-blue-700/30'
                  }`}>
                    {isPaidSubscription ? 'Active' : 'Referral'}
                  </span>
                </div>
                <p className="text-gray-300 mb-4">
                  {isReferralOnly
                    ? 'You have temporary Pro access from referrals. Upgrade to keep it permanently.'
                    : 'Branded subdomain and hub access are included with your Pro plan.'}
                </p>
              </div>

              <div className="space-y-3">
                {isReferralOnly ? (
                  <button
                    onClick={onUpgradeToPro}
                    className="w-full px-6 py-3 bg-primary hover:bg-primary text-white font-medium rounded-lg transition-colors"
                  >
                    Upgrade to paid Pro
                  </button>
                ) : (
                  <button
                    onClick={onClose}
                    className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Keep Pro
                  </button>
                )}
              </div>

              {isPaidSubscription && (
                <div className="pt-4 border-t border-gray-800">
                  <p className="text-sm text-gray-500 mb-3">
                    Need to update payment details or cancel?
                  </p>
                  <button
                    onClick={onManageBilling}
                    className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Manage billing through Stripe
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {displayPlan === 'founder' && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">
                  Founder Access
                </h2>
                <span className="px-3 py-1 text-sm font-medium rounded-full bg-amber-900/20 text-amber-400 border border-amber-700/30">
                  Lifetime
                </span>
              </div>
              <p className="text-gray-300 mb-4">
                You have lifetime access to all Pro features, including branded subdomain and hub access.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={onClose}
                className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
