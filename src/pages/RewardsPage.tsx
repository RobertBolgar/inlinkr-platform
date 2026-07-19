import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import { Copy, Check, Rocket, Gift, Users, Zap, Clock, Crown, TrendingUp, Calendar } from 'lucide-react';
import { getRewardTimeRemaining } from '../lib/referral-reward';
import { getEffectivePlan } from '../lib/plan';
import { getInviteUrl } from '../lib/invite-url';

interface Milestone {
  count: number;
  plan: string;
  days: number;
  label: string;
  unlocked: boolean;
  granted: boolean;
}

interface ReferralStatus {
  enabled: boolean;
  referralCode: string | null;
  referralUrl: string | null;
  rawReferralUrl: string | null;
  referralClicks: number;
  qualifiedCount: number;
  rewards?: {
    rewardsEnabled: boolean;
    milestones: Milestone[];
    activeReward?: {
      plan: string;
      expiresAt: string;
    } | null;
  };
}

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

export function RewardsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<ReferralStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [impactData, setImpactData] = useState<CreatorImpactData | null>(null);

  useEffect(() => {
    fetchReferralStatus();
    fetchCreatorImpact();
  }, [user]);

  const fetchCreatorImpact = async () => {
    if (!user) return;
    try {
      const clerk = (window as any).Clerk;
      let headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (clerk && clerk.session) {
        const token = await clerk.session.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch('/api/creator-impact/status', {
        method: 'GET',
        headers,
      });
      if (response.ok) {
        const data = await response.json();
        setImpactData(data.data);
      }
    } catch (error) {
      console.error('Error fetching Creator Impact:', error);
    }
  };

  const fetchReferralStatus = async () => {
    if (!user) return;
    try {
      const clerk = (window as any).Clerk;
      let headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (clerk && clerk.session) {
        const token = await clerk.session.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch('/api/referrals/status', {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      if (response.ok) {
        const data: ReferralStatus = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Error fetching referral status:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy referral link:', err);
    }
  };

  const isPaidPro = user?.subscription_status === 'active';
  const effectivePlan = getEffectivePlan(user);
  const isPro = effectivePlan === 'pro' || effectivePlan === 'pro_plus';
  const isFounder = effectivePlan === 'founder';

  const hasActiveReferralReward =
    !isPaidPro &&
    user?.referral_reward_active &&
    user?.referral_reward_expires_at &&
    new Date(user.referral_reward_expires_at) > new Date();

  const isSystemEnabled = status?.enabled ?? false;

  // Define milestones based on user role
  const getMilestones = () => {
    if (isFounder) {
      return [
        { count: 5, plan: 'founder', days: 0, label: 'Founder Supporter', unlocked: false, granted: false },
        { count: 10, plan: 'founder', days: 0, label: 'Founder Advocate', unlocked: false, granted: false },
        { count: 25, plan: 'founder', days: 0, label: 'Founder Ambassador', unlocked: false, granted: false },
        { count: 50, plan: 'founder', days: 0, label: 'Founder Champion', unlocked: false, granted: false },
      ];
    } else if (isPro) {
      return [
        { count: 5, plan: 'pro', days: 0, label: 'Creator Supporter', unlocked: false, granted: false },
        { count: 10, plan: 'pro', days: 0, label: 'Creator Advocate', unlocked: false, granted: false },
        { count: 25, plan: 'pro', days: 0, label: 'Creator Ambassador', unlocked: false, granted: false },
        { count: 50, plan: 'pro', days: 0, label: 'Creator Champion', unlocked: false, granted: false },
      ];
    } else {
      // Free users keep existing Pro reward milestones
      return (status?.rewards?.milestones || [
        { count: 3, plan: 'pro', days: 7, label: '7 days Pro', unlocked: false, granted: false },
        { count: 10, plan: 'pro', days: 30, label: '30 days Pro', unlocked: false, granted: false },
      ]).filter((m) => m.count === 3 || m.count === 10);
    }
  };

  const milestones = getMilestones();

  const qualifiedCount = status?.qualifiedCount ?? 0;
  const referralUrl = getInviteUrl({
    username: user?.username,
    isPro,
    isFounder,
    apiReferralUrl: status?.referralUrl || status?.rawReferralUrl
  }) || '';

  const getNextMilestone = () => {
    for (const m of milestones) {
      if (!m.unlocked) return m;
    }
    return null;
  };

  const nextMilestone = getNextMilestone();
  const timeRemaining = hasActiveReferralReward
    ? getRewardTimeRemaining(user?.referral_reward_expires_at || undefined)
    : null;

  if (loading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-12 flex items-center justify-center min-h-[40vh]">
          <div className="text-gray-500 text-sm">Loading rewards...</div>
        </div>
      </Layout>
    );
  }

  // When referral system is OFF:
  // - If user HAS active reward: show only status + expiration, hide everything else
  // - If user does NOT have active reward: show clean paused-state card
  if (!isSystemEnabled) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10 sm:px-6 overflow-x-hidden space-y-5">
          {hasActiveReferralReward ? (
            <>
              {/* Show only active reward status + expiration */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-900/40 border border-purple-700/40 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Rocket className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">Creator Rewards</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Unlock Pro access by inviting creators to InLinkr.</p>
                  </div>
                </div>

                {/* Paused state message */}
                <div className="flex items-center gap-2.5 px-4 py-3 bg-yellow-900/15 border border-yellow-700/30 rounded-xl mb-5">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full flex-shrink-0" />
                  <span className="text-sm text-yellow-300 font-medium">
                    Referral rewards are temporarily paused while we improve the system for launch. Existing unlocked rewards will continue working normally.
                  </span>
                </div>

                {/* Active reward status */}
                {timeRemaining && (
                  <div className={`flex items-center justify-between px-4 py-3 rounded-xl border mb-5 ${timeRemaining.isExpiringSoon ? 'bg-orange-900/15 border-orange-500/40' : 'bg-green-900/10 border-green-700/30'}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Clock className={`w-4 h-4 flex-shrink-0 ${timeRemaining.isExpiringSoon ? 'text-orange-400' : 'text-green-400'}`} />
                      <span className={`text-sm font-semibold ${timeRemaining.isExpiringSoon ? 'text-orange-300' : 'text-green-300'}`}>
                        Referral Pro active
                      </span>
                      <span className={`text-sm ${timeRemaining.isExpiringSoon ? 'text-orange-400' : 'text-gray-400'}`}>
                        — {timeRemaining.label}
                      </span>
                    </div>
                    {timeRemaining.isExpiringSoon && (
                      <Link
                        to="/upgrade"
                        className="flex-shrink-0 text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg transition-colors font-medium ml-3"
                      >
                        Keep Pro
                      </Link>
                    )}
                  </div>
                )}

                {/* Historical qualified count */}
                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-gray-800/50 border border-gray-700/40 rounded-xl px-3 py-4 text-center">
                    <div className="text-3xl font-bold text-white leading-none">{qualifiedCount}</div>
                    <div className="text-xs text-gray-500 mt-1.5 font-medium">Qualified Referrals (Historical)</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Clean paused-state card for users without active rewards */
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 sm:p-12 text-center">
              <div className="w-16 h-16 bg-purple-900/30 border border-purple-700/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Rocket className="w-8 h-8 text-purple-400" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">Creator Rewards</h1>
              <p className="text-gray-400 text-base mb-6">
                Referral rewards are temporarily unavailable during launch preparation.
              </p>
              <p className="text-gray-500 text-sm">
                Existing unlocked rewards remain active.
              </p>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10 sm:px-6 overflow-x-hidden space-y-5">

        {/* ── SECTION 1: Hero / Status ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:p-6">
          {/* Title row */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 ${isFounder ? 'bg-amber-900/40 border-amber-700/40' : isPro ? 'bg-blue-900/40 border-blue-700/40' : 'bg-purple-900/40 border-purple-700/40'} rounded-xl flex items-center justify-center flex-shrink-0`}>
              {isFounder ? <Crown className="w-5 h-5 text-amber-400" /> : <Rocket className="w-5 h-5 text-purple-400" />}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                {isFounder ? 'Founder Impact' : isPro ? 'Creator Impact' : 'Creator Rewards'}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {isFounder 
                  ? 'Build your lifetime Founder Impact.'
                  : isPro 
                  ? 'Build your Creator Impact.'
                  : 'Unlock Pro access by inviting creators to InLinkr.'}
              </p>
            </div>
          </div>

          {/* Status banner */}
          {isFounder ? (
            <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-900/15 border border-amber-700/30 rounded-xl mb-5">
              <div className="w-2 h-2 bg-amber-400 rounded-full flex-shrink-0" />
              <span className="text-sm text-amber-300 font-medium">
                You've helped {qualifiedCount} creator{qualifiedCount !== 1 ? 's' : ''} discover InLinkr.
              </span>
            </div>
          ) : isPro ? (
            <div className="flex items-center gap-2.5 px-4 py-3 bg-blue-900/15 border border-blue-700/30 rounded-xl mb-5">
              <div className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0" />
              <span className="text-sm text-blue-300 font-medium">
                You've helped {qualifiedCount} creator{qualifiedCount !== 1 ? 's' : ''} discover InLinkr.
              </span>
            </div>
          ) : isPaidPro ? (
            <div className="flex items-center gap-2.5 px-4 py-3 bg-blue-900/15 border border-blue-700/30 rounded-xl mb-5">
              <div className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0" />
              <span className="text-sm text-blue-300 font-medium">You're on a paid Pro plan — keep sharing to support the community</span>
            </div>
          ) : hasActiveReferralReward && timeRemaining ? (
            <div className={`flex items-center justify-between px-4 py-3 rounded-xl border mb-5 ${timeRemaining.isExpiringSoon ? 'bg-orange-900/15 border-orange-500/40' : 'bg-green-900/10 border-green-700/30'}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <Clock className={`w-4 h-4 flex-shrink-0 ${timeRemaining.isExpiringSoon ? 'text-orange-400' : 'text-green-400'}`} />
                <span className={`text-sm font-semibold ${timeRemaining.isExpiringSoon ? 'text-orange-300' : 'text-green-300'}`}>
                  Referral Pro active
                </span>
                <span className={`text-sm ${timeRemaining.isExpiringSoon ? 'text-orange-400' : 'text-gray-400'}`}>
                  — {timeRemaining.label}
                </span>
              </div>
              {timeRemaining.isExpiringSoon && (
                <Link
                  to="/upgrade"
                  className="flex-shrink-0 text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg transition-colors font-medium ml-3"
                >
                  Keep Pro
                </Link>
              )}
            </div>
          ) : nextMilestone ? (
            <div className="flex items-center gap-2.5 px-4 py-3 bg-purple-900/15 border border-purple-700/30 rounded-xl mb-5">
              <div className="w-2 h-2 bg-purple-400 rounded-full flex-shrink-0" />
              <span className="text-sm text-purple-300">
                {nextMilestone.count - qualifiedCount > 0
                  ? `${nextMilestone.count - qualifiedCount} more ${nextMilestone.count - qualifiedCount === 1 ? 'referral' : 'referrals'} to unlock ${nextMilestone.label}`
                  : `${nextMilestone.label} milestone reached — reward pending`}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-4 py-3 bg-green-900/10 border border-green-700/30 rounded-xl mb-5">
              <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0" />
              <span className="text-sm text-green-300">All current milestones unlocked 🎉</span>
            </div>
          )}

          {/* Stats row */}
          {(isPro || isFounder) ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-800/50 border border-gray-700/40 rounded-xl px-3 py-4 text-center">
                <div className="text-3xl font-bold text-white leading-none">{impactData?.stats?.total_referrals ?? 0}</div>
                <div className="text-xs text-gray-500 mt-1.5 font-medium">Total Referrals</div>
              </div>
              <div className="bg-green-900/15 border border-green-700/30 rounded-xl px-3 py-4 text-center">
                <div className="text-3xl font-bold text-green-400 leading-none">{impactData?.stats?.qualified_referrals ?? qualifiedCount}</div>
                <div className="text-xs text-gray-500 mt-1.5 font-medium">Qualified</div>
              </div>
              <div className="bg-blue-900/15 border border-blue-700/30 rounded-xl px-3 py-4 text-center">
                <div className="text-3xl font-bold text-blue-400 leading-none">{impactData?.stats?.paid_referrals ?? 0}</div>
                <div className="text-xs text-gray-500 mt-1.5 font-medium">Paid Conversions</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-800/50 border border-gray-700/40 rounded-xl px-3 py-4 text-center">
                <div className="text-3xl font-bold text-white leading-none">{qualifiedCount}</div>
                <div className="text-xs text-gray-500 mt-1.5 font-medium">Qualified</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700/40 rounded-xl px-3 py-4 text-center">
                <div className="text-3xl font-bold text-white leading-none">{status?.referralClicks ?? 0}</div>
                <div className="text-xs text-gray-500 mt-1.5 font-medium">Link clicks</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700/40 rounded-xl px-3 py-4 text-center">
                <div className="text-3xl font-bold text-white leading-none">
                  {milestones.filter(m => m.unlocked).length}
                </div>
                <div className="text-xs text-gray-500 mt-1.5 font-medium">Unlocked</div>
              </div>
            </div>
          )}

          {/* Subtext for Pro/Founder users */}
          {(isPro || isFounder) && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  {isFounder 
                    ? 'Your lifetime Creator Impact is permanently tracked and may unlock future Founder benefits.'
                    : 'Keep sharing to grow your Creator Impact.'}
                </p>
                {user?.created_at && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Creator since {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── SECTION 2: Milestones ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:p-6">
          <h2 className="text-base font-semibold text-white mb-2">
            {isFounder ? 'Founder Milestones' : isPro ? 'Creator Impact Milestones' : 'Milestones'}
          </h2>
          {(isPro || isFounder) && (
            <p className="text-xs text-gray-500 mb-4">
              {isFounder
                ? 'Founder milestones recognize the creators you\'ve helped bring into the InLinkr community.'
                : 'Creator Impact milestones recognize the creators you\'ve helped discover InLinkr.'}
            </p>
          )}
          {!isPro && !isFounder && <div className="mb-4"></div>}
          <div className="space-y-3">
            {milestones.map((milestone, index) => {
              const isUnlocked = milestone.unlocked || milestone.granted;
              const isNext = !isUnlocked && (index === 0 || milestones[index - 1]?.unlocked);
              const progress = Math.min(qualifiedCount, milestone.count);
              const pct = Math.round((progress / milestone.count) * 100);
              const remaining = milestone.count - qualifiedCount;

              return (
                <div
                  key={milestone.count}
                  className={`rounded-xl p-4 border transition-all ${
                    isUnlocked
                      ? 'bg-green-900/10 border-green-600/40 shadow-[0_0_0_1px_rgba(34,197,94,0.08)]'
                      : isNext
                      ? 'bg-gradient-to-br from-purple-900/20 to-gray-900/60 border-purple-600/40'
                      : 'bg-gray-800/30 border-gray-700/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl flex-shrink-0">
                        {isUnlocked ? '✅' : isNext ? '🎯' : '•'}
                      </span>
                      <div className="min-w-0">
                        <div className={`text-sm font-bold ${isUnlocked ? 'text-green-300' : isNext ? 'text-purple-200' : 'text-gray-400'}`}>
                          {milestone.count} qualified referral{milestone.count !== 1 ? 's' : ''}
                        </div>
                        <div className={`text-xs mt-0.5 ${isUnlocked ? 'text-green-500' : isNext ? 'text-purple-400' : 'text-gray-600'}`}>
                          {milestone.label}
                        </div>
                        {/* Helper text for next milestone */}
                        {isNext && !isUnlocked && remaining > 0 && (
                          <div className="text-xs text-purple-400/80 mt-1">
                            {remaining} more {remaining === 1 ? 'creator' : 'creators'} to unlock
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      isUnlocked
                        ? 'bg-green-700/30 text-green-400 border border-green-600/30'
                        : isNext
                        ? 'bg-purple-700/30 text-purple-300 border border-purple-600/30'
                        : 'bg-gray-800 text-gray-600 border border-gray-700/30'
                    }`}>
                      {isUnlocked ? '✓ Unlocked' : `${progress} / ${milestone.count}`}
                    </div>
                  </div>
                  {/* Progress bar — only for non-unlocked */}
                  {!isUnlocked && (
                    <div className="h-2 bg-gray-800/80 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isNext ? 'bg-purple-500' : 'bg-gray-600'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {((isPro || isFounder) && qualifiedCount >= 50) || (!isPro && !isFounder && qualifiedCount >= 10) ? (
            <div className="mt-3 text-xs text-gray-500 text-center">More milestones coming soon.</div>
          ) : null}
        </div>

        {/* ── SECTION 3: Share / Invite ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-blue-400" />
            <h2 className="text-base font-semibold text-white">
              {(isPro || isFounder) ? 'Your Branded Invite Link' : 'Share Your Invite Link'}
            </h2>
          </div>

          {referralUrl ? (
            <>
              <div className="font-mono text-xs text-blue-300 bg-gray-950 border border-blue-900/40 rounded-xl px-4 py-3.5 break-all mb-4 select-all leading-relaxed">
                {referralUrl}
              </div>
              <button
                onClick={copyReferralLink}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-purple-900/30"
              >
                {copySuccess ? (
                  <><Check className="w-4 h-4" /> Copied to clipboard!</>
                ) : (
                  <><Copy className="w-4 h-4" /> Copy referral link</>
                )}
              </button>
            </>
          ) : null}

          <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-800/80">
            <div className="text-sm text-gray-500">
              <span className="text-white font-semibold">{qualifiedCount}</span> qualified {qualifiedCount === 1 ? 'referral' : 'referrals'}
            </div>
            <div className="text-sm text-gray-500">
              <span className="text-white font-semibold">{status?.referralClicks ?? 0}</span> link clicks
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-2.5">
            A referral qualifies after signup, creating a link, and 2 tracked clicks.
          </p>
        </div>

        {/* ── SECTION 4: How It Works ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:p-6">
          <h2 className="text-base font-semibold text-white mb-4">How It Works</h2>
          <div className="space-y-4">
            {(isPro || isFounder
              ? [
                  { icon: <Users className="w-4 h-4" />, step: '1', title: 'Invite creators', desc: 'Share your unique link with other YouTube creators.' },
                  { icon: <Zap className="w-4 h-4" />, step: '2', title: 'Creators qualify', desc: 'They sign up, create Smart Links, and receive tracked clicks.' },
                  { icon: <TrendingUp className="w-4 h-4" />, step: '3', title: isFounder ? 'Build your Founder Impact' : 'Build your Creator Impact', desc: isFounder ? 'Every qualified referral grows your lifetime Founder Impact.' : 'Every qualified referral grows your Creator Impact.' },
                ]
              : [
                  { icon: <Users className="w-4 h-4" />, step: '1', title: 'Invite creators', desc: 'Share your unique link with other YouTube creators.' },
                  { icon: <Zap className="w-4 h-4" />, step: '2', title: 'They create Smart Links', desc: 'They sign up and create at least one Smart Link with 2 clicks.' },
                  { icon: <Gift className="w-4 h-4" />, step: '3', title: 'You unlock Pro rewards', desc: '3 creators = 7 days Pro · 10 creators = 30 days Pro.' },
                ]
            ).map((item) => (
              <div key={item.step} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-900/30 border border-purple-700/30 rounded-xl flex items-center justify-center text-purple-400">
                  {item.icon}
                </div>
                <div className="min-w-0 pt-0.5">
                  <div className="text-sm font-semibold text-white">{item.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Paid Pro appreciation message — Free users only */}
        {isPaidPro && !isPro && !isFounder && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:p-6 text-center">
            <div className="text-3xl mb-3">💙</div>
            <div className="text-base font-semibold text-white mb-1">Thanks for supporting InLinkr</div>
            <div className="text-sm text-gray-500">
              You're on a paid Pro plan. Share your referral link to help other creators discover InLinkr.
            </div>
          </div>
        )}

        {/* No referrals empty state CTA — Free users only */}
        {!isPaidPro && !isPro && !isFounder && !hasActiveReferralReward && qualifiedCount === 0 && (
          <div className="bg-purple-900/10 border border-purple-700/20 rounded-xl p-5 sm:p-6 text-center">
            <div className="text-3xl mb-3">🚀</div>
            <div className="text-base font-semibold text-white mb-1.5">Invite creators to unlock free Pro</div>
            <div className="text-sm text-gray-500 mb-4">
              Share your link. When 3 creators join and get tracked clicks, you unlock 7 days of Pro — free.
            </div>
            {referralUrl && (
              <button
                onClick={copyReferralLink}
                className="inline-flex items-center gap-2 text-sm bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white px-6 py-3 rounded-xl transition-colors font-bold shadow-lg shadow-purple-900/30"
              >
                {copySuccess ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy invite link</>}
              </button>
            )}
          </div>
        )}

      </div>
    </Layout>
  );
}
