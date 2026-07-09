import { Copy, Rocket } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getEffectivePlan } from '../lib/plan';
import { Link } from 'react-router-dom';

interface ReferralStatus {
  enabled: boolean;
  referralCode: string | null;
  referralUrl: string | null;
  referralClicks: number;
  rawReferralUrl: string | null;
  qualifiedCount: number;
  rewards?: {
    rewardsEnabled: boolean;
    milestones: Array<{
      count: number;
      plan: string;
      days: number;
      label: string;
      unlocked: boolean;
      granted: boolean;
    }>;
    activeReward?: {
      plan: string;
      expiresAt: string;
    } | null;
  };
}

interface ReferralCardProps {
  status: ReferralStatus | null;
  loading?: boolean;
  copyReferralLink: () => Promise<boolean>;
  copySuccess: boolean;
  compact?: boolean;
}

export function ReferralCard({ status, loading = false, copyReferralLink, copySuccess, compact = false }: ReferralCardProps) {
  const { user } = useAuth();

  // Use milestones from API response or fallback to hardcoded for new 3/10 tier system
  const rawMilestones = status?.rewards?.milestones || [
    { count: 3, label: "7 days Pro", unlocked: false, granted: false },
    { count: 10, label: "30 days Pro", unlocked: false, granted: false }
  ];

  const milestones = rawMilestones.filter(m => m.count === 3 || m.count === 10);

  // Hide card for PAID Pro users and Founder users — referral Pro users must see countdown
  const effectivePlan = getEffectivePlan(user);
  const isPaidPro = user?.subscription_status === 'active';
  const isFounder = effectivePlan === 'founder';

  if (isPaidPro || isFounder) {
    return null;
  }

  // Check if user has active referral reward
  const hasActiveReferralReward =
    !isPaidPro &&
    user?.referral_reward_active &&
    user?.referral_reward_expires_at &&
    new Date(user.referral_reward_expires_at) > new Date();

  // Hide card if loading
  if (loading) {
    return null;
  }

  // Compact variant for dashboard priority slot
  if (compact) {
    const qualifiedCount = status?.qualifiedCount ?? 0;
    const nextMilestone = milestones.find(m => !m.unlocked) || milestones[milestones.length - 1];
    const progressText = `${qualifiedCount} / ${nextMilestone.count}`;

    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-lg">
        <div className="flex items-center gap-2 mb-3">
          <Rocket className="w-5 h-5 text-purple-500" />
          <h2 className="text-base font-bold text-white">
            🚀 Unlock Pro Free
          </h2>
        </div>

        <p className="text-sm text-gray-300 mb-4">
          Invite creators and earn Pro access.
        </p>

        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-400">
            <span className="text-white font-semibold">{progressText}</span> qualified referrals
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyReferralLink}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Copy className="w-4 h-4" />
            {copySuccess ? 'Copied!' : 'Copy Link'}
          </button>
          <Link
            to="/rewards"
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
          >
            View Rewards
          </Link>
        </div>
      </div>
    );
  }

  // When referral system is OFF:
  // - If user HAS active reward: show informational-only card (no CTAs, no milestones)
  // - If user does NOT have active reward: completely hide the card
  const isSystemEnabled = status?.enabled ?? false;
  if (!isSystemEnabled) {
    if (!hasActiveReferralReward) {
      return null;
    }
    // Render informational-only card for users with active rewards when system is disabled
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-2 sm:p-3 shadow-lg h-full">
        <div className="flex items-center gap-2 mb-2">
          <Rocket className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
          <h2 className="text-base sm:text-lg font-bold text-white">
            🚀 Referral Rewards Paused
          </h2>
        </div>
        
        <div className="space-y-3">
          <div className="text-sm text-gray-300">
            Referral rewards are temporarily paused while we improve the system for launch. Existing unlocked rewards will continue working normally.
          </div>

          {/* Reward status microcopy */}
          {user && (() => {
            const expiresAt = user?.referral_reward_expires_at;
            const now = new Date();
            const expiryDate = new Date(expiresAt || '');
            const timeRemaining = expiryDate.getTime() - now.getTime();
            const daysRemaining = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
            const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
            
            let headerText = '';
            let subtitleText = '';
            let containerClass = '';
            let headerClass = '';
            
            if (hoursRemaining <= 24) {
              headerText = `Your free Pro access expires in ${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''}`;
              subtitleText = 'Upgrade to keep Pro access.';
              containerClass = 'bg-red-900/20 border-2 border-red-500/50';
              headerClass = 'text-red-400';
            } else if (daysRemaining <= 3) {
              headerText = `Your free Pro access expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`;
              subtitleText = 'Upgrade to keep Pro access.';
              containerClass = 'bg-yellow-900/20 border-2 border-yellow-500/50';
              headerClass = 'text-yellow-400';
            } else {
              headerText = `Your free Pro access expires in ${daysRemaining} days`;
              subtitleText = 'Upgrade to keep Pro access.';
              containerClass = 'bg-blue-900/10 border border-blue-700/30';
              headerClass = 'text-blue-300';
            }
            
            return (
              <div className={`rounded-lg p-2.5 ${containerClass}`}>
                <p className={`text-xs font-semibold ${headerClass}`}>{headerText}</p>
                <p className="text-xs text-gray-400 mt-0.5">{subtitleText}</p>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // Calculate progress message based on qualified count
  const getProgressMessage = () => {
    const qualifiedCount = status?.qualifiedCount ?? 0;
    if (qualifiedCount < 3) {
      return `${qualifiedCount} of 3 qualified referrals`;
    } else if (qualifiedCount < 10) {
      return `${qualifiedCount} of 10 qualified referrals`;
    } else {
      return `${qualifiedCount} of 10 qualified referrals`;
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-2 sm:p-3 shadow-lg h-full">
      <div className="flex items-center gap-2 mb-2">
        <Rocket className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
        <h2 className="text-base sm:text-lg font-bold text-white">
          🚀 Unlock Pro for Free
        </h2>
      </div>
      
      <div className="space-y-3">
        <div className="text-sm text-gray-300">
          Help creators get their first real clicks and unlock Pro rewards.
        </div>

        <div className="space-y-2">
          {/* Unlocked state message — distinguish milestone reached vs reward active */}
          {(() => {
            const threeReferralMilestone = milestones.find(m => m.count === 3);
            const tenReferralMilestone = milestones.find(m => m.count === 10);
            const activeReward = status?.rewards?.activeReward;
            const hasActiveReward = activeReward && activeReward.expiresAt && new Date(activeReward.expiresAt) > new Date();
            
            if (hasActiveReward) {
              return (
                <div className="text-xs text-green-400 bg-green-900/20 border border-green-700/30 rounded p-1.5">
                  ✅ Referral Pro Active
                </div>
              );
            }
            if (threeReferralMilestone?.unlocked && !tenReferralMilestone?.unlocked) {
              return (
                <div className="text-xs text-blue-400 bg-blue-900/20 border border-blue-700/30 rounded p-1.5">
                  🎯 3-referral milestone reached — reward pending
                </div>
              );
            }
            if (tenReferralMilestone?.unlocked) {
              return (
                <div className="text-xs text-blue-400 bg-blue-900/20 border border-blue-700/30 rounded p-1.5">
                  🎯 10-referral milestone reached — reward pending
                </div>
              );
            }
            return null;
          })()}

          {/* Next target message */}
          {(() => {
            const tenReferralMilestone = milestones.find(m => m.count === 10);
            if (tenReferralMilestone?.unlocked) {
              return (
                <div className="text-xs text-gray-300 bg-purple-900/20 border border-purple-700/30 rounded p-1.5">
                  You've unlocked all current referral rewards 🎉
                </div>
              );
            }
            const qualifiedCount = status?.qualifiedCount ?? 0;
            const remaining = 10 - qualifiedCount;
            return (
              <div className="text-xs text-purple-300 bg-purple-900/20 border border-purple-700/30 rounded p-1.5">
                {remaining > 0 ? `${remaining} more referrals unlock 30 days of Pro` : '0 more referrals unlock 30 days of Pro'}
              </div>
            );
          })()}

          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{getProgressMessage()}</span>
            <span>Milestones</span>
          </div>
          
          {/* Future rewards message after 10 referrals */}
          {(status?.qualifiedCount ?? 0) >= 10 && (
            <div className="text-xs text-gray-400 bg-purple-900/20 border border-purple-700/30 rounded p-1.5">
              More rewards coming soon.
            </div>
          )}
          
          {/* Reward status microcopy */}
          {user && (() => {
            const isPaid = user?.subscription_status === "active";
            const hasActiveReferralReward =
              !isPaid &&
              user?.referral_reward_active &&
              user?.referral_reward_expires_at &&
              new Date(user.referral_reward_expires_at) > new Date();
            
            if (!hasActiveReferralReward) return null;
            
            const expiresAt = user?.referral_reward_expires_at;
            const now = new Date();
            const expiryDate = new Date(expiresAt || '');
            const timeRemaining = expiryDate.getTime() - now.getTime();
            const daysRemaining = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
            const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
            
            let headerText = '';
            let subtitleText = '';
            let containerClass = '';
            let headerClass = '';
            
            if (hoursRemaining <= 24) {
              headerText = `Your free Pro access expires in ${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''}`;
              subtitleText = 'Refer more creators or upgrade to keep Pro access.';
              containerClass = 'bg-red-900/20 border-2 border-red-500/50';
              headerClass = 'text-red-400';
            } else if (daysRemaining <= 3) {
              headerText = `Your free Pro access expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`;
              subtitleText = 'Refer more creators or upgrade to keep Pro access.';
              containerClass = 'bg-yellow-900/20 border-2 border-yellow-500/50';
              headerClass = 'text-yellow-400';
            } else {
              headerText = `Your free Pro access expires in ${daysRemaining} days`;
              subtitleText = 'Refer more creators or upgrade to keep Pro access.';
              containerClass = 'bg-blue-900/10 border border-blue-700/30';
              headerClass = 'text-blue-300';
            }
            
            return (
              <div className={`rounded-lg p-2.5 ${containerClass}`}>
                <p className={`text-xs font-semibold ${headerClass}`}>{headerText}</p>
                <p className="text-xs text-gray-400 mt-0.5">{subtitleText}</p>
              </div>
            );
          })()}
          
          <div className="space-y-1.5">
            {milestones.map((milestone, index) => {
              const isUnlocked = milestone.unlocked;
              const isGranted = milestone.granted;
              const isNext = !isUnlocked && (index === 0 || milestones[index - 1].unlocked);
              const isTenMilestone = milestone.count === 10;
              
              return (
                <div 
                  key={index}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    isGranted 
                      ? 'bg-green-900/20 border border-green-700/30' 
                      : isUnlocked 
                        ? 'bg-green-900/20 border border-green-700/30' 
                        : isNext 
                          ? 'bg-purple-900/20 border border-purple-700/30' 
                          : 'bg-gray-800/50 border border-gray-700/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${
                      isUnlocked || isGranted
                        ? 'text-green-400' 
                        : isNext 
                          ? 'text-purple-400' 
                          : 'text-gray-500'
                    }`}>
                      {isUnlocked || isGranted ? '✅' : isNext && isTenMilestone ? '🎯' : '•'}
                    </span>
                    <span className={`text-sm font-medium ${
                      isUnlocked || isGranted
                        ? 'text-green-300' 
                        : isNext 
                          ? 'text-purple-300' 
                          : 'text-gray-400'
                    }`}>
                      {milestone.count} creators
                    </span>
                  </div>
                  <span className={`text-xs ${
                    isUnlocked || isGranted
                      ? 'text-green-400' 
                      : isNext 
                        ? 'text-purple-400' 
                        : 'text-gray-500'
                  }`}>
                    {isUnlocked || isGranted ? 'unlocked' : isNext && isTenMilestone ? 'next reward' : milestone.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={copyReferralLink}
            className="flex-1 bg-purple-500/60 hover:bg-purple-600/80 text-white px-4 py-1 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Copy className="w-4 h-4" />
            {copySuccess ? 'Copied!' : 'Copy referral link'}
          </button>
        </div>

        {/* Qualified referral count display */}
        <div className="text-xs text-gray-400 text-center">
          {status?.qualifiedCount ?? 0} {(status?.qualifiedCount ?? 0) === 1 ? 'qualified referral' : 'qualified referrals'} earned
        </div>

        <div className="text-xs text-gray-500">
          A referral counts after signup, creating a link, and 2 tracked clicks.
        </div>
      </div>
    </div>
  );
}
