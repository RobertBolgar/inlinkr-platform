import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Share2, Users, TrendingUp, Award, Crown, Calendar, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getEffectivePlan } from '../lib/plan';
import { getInviteUrl } from '../lib/invite-url';

interface CreatorImpactStats {
  total_referrals: number;
  qualified_referrals: number;
  paid_referrals: number;
  pro_referrals: number;
  founder_referrals: number;
  rewards_granted: number;
  first_referral_at: string | null;
  last_referral_at: string | null;
  first_paid_referral_at: string | null;
  last_paid_referral_at: string | null;
  ambassador_status: string | null;
  badges_json: string | null;
  updated_at: string | null;
}

interface CreatorImpactData {
  stats: CreatorImpactStats;
  referralCode: string | null;
  referralUrl: string | null;
  recentReferrals: any[];
}

interface CreatorImpactCardProps {
  data: CreatorImpactData | null;
  loading: boolean;
  error: string | null;
}

export function CreatorImpactCard({ data, loading, error }: CreatorImpactCardProps) {
  const { user } = useAuth();
  const [copySuccess, setCopySuccess] = useState(false);
  const effectivePlan = getEffectivePlan(user);
  const isFounder = effectivePlan === 'founder';
  const isPro = effectivePlan === 'pro' || effectivePlan === 'pro_plus';

  const handleCopyLink = async () => {
    if (!data?.referralUrl) return;
    
    try {
      await navigator.clipboard.writeText(data.referralUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShareLink = async () => {
    if (!data?.referralUrl) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join InLinkr',
          text: 'Check out InLinkr - a tool for YouTube creators to manage their links and track clicks.',
          url: data.referralUrl,
        });
      } catch (err) {
        console.error('Failed to share:', err);
      }
    } else {
      // Fallback to copy if share not available
      handleCopyLink();
    }
  };

  const canShare = typeof navigator.share !== 'undefined';

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Creator Impact</div>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-800 rounded w-3/4"></div>
          <div className="h-3 bg-gray-800 rounded w-1/2"></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-16 bg-gray-800 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Creator Impact</div>
        <div className="px-3 py-2 bg-red-900/20 border border-red-800/50 rounded-lg">
          <p className="text-sm text-red-400">Unable to load Creator Impact data</p>
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const referralCount = stats?.qualified_referrals || stats?.total_referrals || 0;
  const referralUrl = getInviteUrl({
    username: user?.username,
    isPro,
    isFounder,
    apiReferralUrl: data?.referralUrl
  });

  // Calculate progress toward free Pro (3 qualified referrals)
  const qualifiedCount = stats?.qualified_referrals || 0;

  // Creator Since date
  const creatorSince = user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null;

  // Determine which stat cards to show
  const showProReferrals = (stats?.pro_referrals || 0) > 0;
  const showFounderReferrals = (stats?.founder_referrals || 0) > 0;

  // Calculate next milestone based on user type
  const getNextMilestone = () => {
    if (isFounder) {
      // Founder milestones
      const founderMilestones = [
        { count: 5, label: 'Founder Supporter' },
        { count: 25, label: 'Founder Advocate' },
        { count: 50, label: 'Founder Ambassador' },
        { count: 100, label: 'Founder Pioneer' }
      ];
      const nextMilestone = founderMilestones.find(m => qualifiedCount < m.count);
      if (nextMilestone) {
        return {
          label: 'Next Founder Milestone',
          message: `${nextMilestone.count - qualifiedCount} more qualified referral${(nextMilestone.count - qualifiedCount) !== 1 ? 's' : ''} to reach ${nextMilestone.label}`
        };
      }
      return {
        label: 'Founder Milestone',
        message: "You've reached the highest current Founder milestone."
      };
    } else if (isPro) {
      // Pro milestones
      const proMilestones = [
        { count: 5, label: 'Creator Supporter' },
        { count: 10, label: 'Creator Advocate' },
        { count: 25, label: 'Creator Ambassador' },
        { count: 50, label: 'Top Referrer' }
      ];
      const nextMilestone = proMilestones.find(m => qualifiedCount < m.count);
      if (nextMilestone) {
        return {
          label: 'Next Creator Impact Milestone',
          message: `${nextMilestone.count - qualifiedCount} more qualified referral${(nextMilestone.count - qualifiedCount) !== 1 ? 's' : ''} to reach ${nextMilestone.label}`
        };
      }
      return {
        label: 'Creator Impact Milestone',
        message: "You've reached the highest current Creator Impact milestone."
      };
    } else {
      // Free user reward milestones (existing behavior)
      const freeMilestones = [
        { count: 3, label: '7 days Pro' },
        { count: 10, label: '30 days Pro' }
      ];
      const nextMilestone = freeMilestones.find(m => qualifiedCount < m.count);
      if (nextMilestone) {
        return {
          label: 'Next Reward',
          message: `${nextMilestone.count - qualifiedCount} more qualified referral${(nextMilestone.count - qualifiedCount) !== 1 ? 's' : ''} to unlock ${nextMilestone.label}`
        };
      }
      return {
        label: 'Reward',
        message: "You've unlocked Pro access through referrals!"
      };
    }
  };

  const milestone = getNextMilestone();

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Creator Impact</div>

      {/* Main emotional line */}
      <div className="mb-2">
        <p className="text-base sm:text-lg font-semibold text-white">
          You've helped <span className="text-purple-400">{referralCount}</span> creator{referralCount !== 1 ? 's' : ''} discover InLinkr.
        </p>
        <p className="text-sm text-gray-500 mt-1">Thank you for helping grow the creator community.</p>
      </div>

      {/* User state-specific message */}
      <div className="mb-4">
        {isFounder ? (
          <div className="px-3 py-2 bg-amber-900/15 border border-amber-700/30 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-4 h-4 text-amber-400" />
              <p className="text-sm font-semibold text-amber-300">Founder Impact</p>
            </div>
            <p className="text-xs text-gray-400">Your lifetime Creator Impact is permanently tracked and may unlock future Founder benefits.</p>
          </div>
        ) : isPro ? (
          <div className="px-3 py-2 bg-blue-900/15 border border-blue-700/30 rounded-xl">
            <p className="text-sm text-blue-300">You're on Pro — keep sharing to support the creator community.</p>
          </div>
        ) : null}
      </div>

      {/* Milestone section - different for each user type */}
      <div className="mb-4 px-3 py-2 bg-purple-900/15 border border-purple-700/30 rounded-xl">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{milestone.label}</p>
        <p className="text-sm text-purple-300">{milestone.message}</p>
      </div>

      {/* Creator Since metadata */}
      {creatorSince && (
        <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
          <Calendar className="w-3.5 h-3.5" />
          <span>Creator Since {creatorSince}</span>
        </div>
      )}

      {/* Lifetime stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        <StatCard
          icon={<Users className="w-4 h-4" />}
          label="Total Referrals"
          value={stats?.total_referrals || 0}
          color="text-gray-400"
          bgColor="bg-gray-800/50"
          borderColor="border-gray-700/40"
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Qualified"
          value={stats?.qualified_referrals || 0}
          color="text-green-400"
          bgColor="bg-green-900/15"
          borderColor="border-green-700/30"
        />
        <StatCard
          icon={<Award className="w-4 h-4" />}
          label="Paid Conversions"
          value={stats?.paid_referrals || 0}
          color="text-blue-400"
          bgColor="bg-blue-900/15"
          borderColor="border-blue-700/30"
        />
        {showProReferrals && (
          <StatCard
            icon={<Award className="w-4 h-4" />}
            label="Pro Referrals"
            value={stats?.pro_referrals || 0}
            color="text-purple-400"
            bgColor="bg-purple-900/15"
            borderColor="border-purple-700/30"
          />
        )}
        {showFounderReferrals && (
          <StatCard
            icon={<Crown className="w-4 h-4" />}
            label="Founder Referrals"
            value={stats?.founder_referrals || 0}
            color="text-amber-400"
            bgColor="bg-amber-900/15"
            borderColor="border-amber-700/30"
          />
        )}
      </div>

      {/* Referral link section */}
      {referralUrl && (
        <div className="space-y-3">
          <label className="block text-xs text-gray-500 uppercase tracking-wide">Your Referral Link</label>
          <div className="px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-gray-300 break-all">
            {referralUrl}
          </div>
          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={handleCopyLink}
              className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium text-gray-300"
            >
              <Copy className="w-4 h-4" />
              {copySuccess ? 'Copied!' : 'Copy Link'}
            </button>
            {canShare && (
              <button
                onClick={handleShareLink}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium text-gray-300"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            )}
          </div>
          <Link
            to="/rewards"
            className="block w-full py-2.5 bg-purple-600 hover:bg-purple-700 border border-purple-700 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium text-white"
          >
            View Rewards Progress
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  bgColor: string;
  borderColor: string;
}

function StatCard({ icon, label, value, color, bgColor, borderColor }: StatCardProps) {
  return (
    <div className={`${bgColor} border ${borderColor} rounded-xl px-3 py-2`}>
      <div className="flex items-center gap-1.5 mb-1">
        <div className={color}>{icon}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}
