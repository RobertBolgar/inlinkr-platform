import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Check, X, Play, Copy, Zap, Video, TrendingUp, Users, BarChart3, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAuth as useClerkAuth } from '../lib/auth/clerk';
import { getCheckoutIntentUrl } from '../lib/pending-redirect';
import { PublicNav } from '../components/PublicNav';
import { useFounderStats } from '../lib/hooks/useFounderStats';

export function HomePageB() {
  const { user, loading } = useAuth();
  const { isSignedIn } = useClerkAuth();
  const [clickCounts, setClickCounts] = useState({ videoA: 1284, videoB: 312 });
  const [copied, setCopied] = useState(false);
  const { displayText, isSoldOut } = useFounderStats();

  const handleCopy = () => {
    navigator.clipboard.writeText('https://go-dev.inlinkr.com/i8yy84');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setClickCounts((prev) => ({
        videoA: prev.videoA + (Math.random() > 0.4 ? 1 : 0),
        videoB: prev.videoB + (Math.random() > 0.7 ? 1 : 0),
      }));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (user) {
    if (!user.username) return <Navigate to="/setup-username" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  const totalClicks = clickCounts.videoA + clickCounts.videoB;

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">

      <PublicNav />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* HERO */}
        <section className="pt-16 pb-20 text-center space-y-6">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight max-w-3xl mx-auto">
            Know Exactly Which YouTube Videos Make You Money.
          </h1>
          <p className="text-lg text-gray-400 leading-relaxed max-w-2xl mx-auto">
            Stop guessing which videos, descriptions, and pinned comments are driving clicks.
          </p>
          <p className="text-lg text-gray-400 leading-relaxed max-w-2xl mx-auto">
            InLinkr shows you exactly where every click came from—so you can double down on what works.
          </p>
          <div className="pt-4 flex flex-col items-center gap-3">
            <Link
              to="/signup"
              className="px-8 py-4 bg-primary hover:bg-primary text-white font-semibold rounded-xl transition-colors text-lg"
            >
              Start Tracking Free
            </Link>
            <p className="text-sm text-gray-500">
              Free forever. No credit card required.
            </p>
          </div>
        </section>

        {/* PROBLEM */}
        <section className="py-16 border-t border-gray-800/60">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center">
              YouTube tells you people watched.
            </h2>
            <h3 className="text-2xl sm:text-3xl font-bold mb-10 text-center text-gray-400">
              It never tells you what made them click.
            </h3>
            <div className="space-y-5 text-gray-300 leading-relaxed text-base sm:text-lg">
              <p>
                Imagine having:
              </p>
              <ul className="space-y-2 ml-6">
                <li>• 80 videos</li>
                <li>• one affiliate link</li>
                <li>• one merch store</li>
                <li>• one course</li>
              </ul>
              <p>
                You know people clicked.
              </p>
              <p className="text-white font-semibold">
                But...
              </p>
              <ul className="space-y-2 ml-6">
                <li>• Which video?</li>
                <li>• Which placement?</li>
                <li>• Description?</li>
                <li>• Pinned comment?</li>
                <li>• Channel bio?</li>
              </ul>
              <p className="text-white font-semibold">
                You have no idea.
              </p>
              <p>
                Every upload becomes another guess.
              </p>
            </div>
          </div>
        </section>

        {/* SOLUTION */}
        <section className="py-16 border-t border-gray-800/60">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center">
            InLinkr connects every click back to its source.
          </h2>
          <p className="text-gray-400 text-center mb-12 text-lg max-w-2xl mx-auto">
            InLinkr doesn't replace your workflow.
            <br />It sits on top of it.
          </p>

          {/* Smart Links Workflow Graphic */}
          <div className="flex justify-center mb-12">
            <img
              src="/TubeLinkr-SmartLinks.png"
              alt="Smart Links workflow showing two-phone tracking"
              className="w-full max-w-5xl drop-shadow-2xl"
            />
          </div>

          {/* Simple Feature Row */}
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div className="space-y-2">
                <div className="text-2xl mb-2">⚡</div>
                <h3 className="text-base font-semibold text-white">One Smart Link</h3>
                <p className="text-sm text-gray-400">One link works across every video.</p>
              </div>
              <div className="space-y-2">
                <div className="text-2xl mb-2">📊</div>
                <h3 className="text-base font-semibold text-white">Track every click</h3>
                <p className="text-sm text-gray-400">Know exactly where every click came from.</p>
              </div>
              <div className="space-y-2">
                <div className="text-2xl mb-2">🎯</div>
                <h3 className="text-base font-semibold text-white">See what actually works</h3>
                <p className="text-sm text-gray-400">Compare placements and stop guessing.</p>
              </div>
            </div>
          </div>

          {/* Visual Explanation */}
          <div className="mt-12 bg-gray-900/80 border border-gray-800/60 rounded-xl p-6 sm:p-8 max-w-2xl mx-auto shadow-xl">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Your smart link</div>
            <div className="bg-gray-950 border border-blue-900/60 rounded-lg px-4 py-3 text-sm text-blue-400 font-mono flex items-center justify-between mb-6">
              <span>go-dev.inlinkr.com/i8yy84</span>
              <button onClick={handleCopy} className="flex items-center gap-1 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer">
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="space-y-3">
              <div className="bg-gray-950/80 border border-gray-800/60 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-semibold text-white">Video A</span>
                    <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded font-mono">/d</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white tabular-nums">{clickCounts.videoA.toLocaleString()}</span>
                    <span className="text-xs text-green-400">clicks</span>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  </div>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-700"
                    style={{ width: `${Math.round((clickCounts.videoA / totalClicks) * 100)}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1.5 text-right">
                  {Math.round((clickCounts.videoA / totalClicks) * 100)}% of traffic
                </div>
              </div>
              <div className="bg-gray-950/80 border border-gray-800/60 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-semibold text-white">Video B</span>
                    <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded font-mono">/d</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white tabular-nums">{clickCounts.videoB.toLocaleString()}</span>
                    <span className="text-xs text-green-400">clicks</span>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  </div>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-700"
                    style={{ width: `${Math.round((clickCounts.videoB / totalClicks) * 100)}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1.5 text-right">
                  {Math.round((clickCounts.videoB / totalClicks) * 100)}% of traffic
                </div>
              </div>
            </div>
            <p className="text-xs text-center text-gray-500 mt-5">
              go-dev.inlinkr.com/i8yy84 — one link, tracked everywhere
            </p>
          </div>
        </section>

        {/* ANALYTICS */}
        <section className="py-16 border-t border-gray-800/60">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center">
              Your dashboard answers the questions YouTube can't.
            </h2>
            <div className="mt-12 flex flex-col lg:flex-row items-center gap-12">
              <div className="flex-1 space-y-4 text-left max-w-lg">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-300">Which video generated the click</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-300">Which placement converted</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-300">Which content deserves another promotion</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-300">Which videos are quietly making money</span>
                </div>
              </div>
              <div className="flex-1 flex justify-center">
                <img
                  src="/TubeLinkr-Dashboard.png"
                  alt="InLinkr dashboard showing analytics on iPhone"
                  className="w-full max-w-sm drop-shadow-2xl"
                />
              </div>
            </div>
          </div>
        </section>

        {/* PROOF SECTION */}
        <section className="py-16 border-t border-gray-800/60">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center">
              Stop telling sponsors.
            </h2>
            <h3 className="text-2xl sm:text-3xl font-bold mb-10 text-center text-gray-400">
              Start showing them.
            </h3>
            <div className="mt-12 flex flex-col lg:flex-row items-center gap-12">
              <div className="flex-1 flex justify-center">
                <img
                  src="/TubeLinkr-Analytics.png"
                  alt="InLinkr analytics showing click attribution on iPhone"
                  className="w-full max-w-sm drop-shadow-2xl"
                />
              </div>
              <div className="flex-1 bg-gray-900/60 border border-gray-800 rounded-xl p-6 sm:p-8 text-left">
                <p className="text-gray-300 leading-relaxed mb-5">
                  Anyone can claim they generate clicks.
                </p>
                <p className="text-white font-semibold mb-5">
                  InLinkr gives creators a professional Proof Page showing:
                </p>
                <ul className="space-y-3 mb-6">
                  {[
                    'Verified clicks',
                    'Originating video',
                    'Placement',
                    'Destination',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-gray-400 mb-2">
                  Live Proof Pages update in real time. Snapshot Proof Pages lock in your numbers at peak performance.
                </p>
                <p className="text-sm text-white font-medium">
                  Sponsor-safe sharing.
                </p>
              </div>
            </div>
          </div>
        </section>


        {/* FEATURE GRID */}
        <section className="py-16 border-t border-gray-800/60">
          <h2 className="text-3xl sm:text-4xl font-bold mb-2 text-center">
            Built for creators who want answers.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
            {[
              {
                icon: <Video className="w-5 h-5" />,
                color: 'text-primary',
                title: 'Know Which Videos Matter',
                desc: "Find the videos actually generating clicks.",
              },
              {
                icon: <BarChart3 className="w-5 h-5" />,
                color: 'text-green-500',
                title: 'Find Your Best Placement',
                desc: "Descriptions, pinned comments, bios, custom placements. Know which one wins.",
              },
              {
                icon: <Zap className="w-5 h-5" />,
                color: 'text-yellow-500',
                title: 'One Smart Link',
                desc: "Update one destination. Every video stays updated.",
              },
              {
                icon: <Users className="w-5 h-5" />,
                color: 'text-purple-500',
                title: 'Creator Hub',
                desc: "Your branded creator page with built-in analytics.",
              },
              {
                icon: <Shield className="w-5 h-5" />,
                color: 'text-red-500',
                title: 'Share Proof',
                desc: "Show sponsors verified performance.",
              },
              {
                icon: <TrendingUp className="w-5 h-5" />,
                color: 'text-orange-500',
                title: 'Live Analytics',
                desc: "Know what's working right now.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-6 hover:border-gray-700/60 transition-colors"
              >
                <div className={`${feature.color} mb-4`}>{feature.icon}</div>
                <h3 className="text-base font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* COMPARISON TABLE */}
        <section className="py-16 border-t border-gray-800/60">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-center">
            YouTube measures attention.
          </h2>
          <h3 className="text-2xl sm:text-3xl font-bold mb-10 text-center text-gray-400">
            InLinkr measures results.
          </h3>
          <div className="max-w-2xl mx-auto overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 pr-4 font-normal w-1/2" />
                  <th className="text-center py-3 px-4 text-gray-400 font-medium whitespace-nowrap">YouTube Studio</th>
                  <th className="text-center py-3 px-4 text-gray-400 font-medium">Bitly</th>
                  <th className="text-center py-3 px-4 text-blue-400 font-semibold">InLinkr</th>
                </tr>
              </thead>
              <tbody>
                {[
                  'Which video generated the click',
                  'Which placement converted',
                  'Reusable Smart Links',
                  'Proof Pages',
                  'Creator Hub',
                  'Built specifically for YouTube creators',
                ].map((row) => (
                  <tr key={row} className="border-b border-gray-800/50">
                    <td className="py-3.5 pr-4 text-gray-300 text-sm">{row}</td>
                    <td className="text-center py-3.5 px-4">
                      <X className="w-4 h-4 text-red-500 mx-auto" />
                    </td>
                    <td className="text-center py-3.5 px-4">
                      <X className="w-4 h-4 text-red-500 mx-auto" />
                    </td>
                    <td className="text-center py-3.5 px-4">
                      <Check className="w-4 h-4 text-green-500 mx-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* PRICING */}
        <section className="py-16 border-t border-gray-800/60">
          <h2 className="text-3xl sm:text-4xl font-bold mb-2 text-center">
            Start Free. Upgrade When You're Ready.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10 max-w-4xl mx-auto">
            {/* Free */}
            <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-6 flex flex-col">
              <div className="text-lg font-bold text-white mb-1">Free</div>
              <div className="text-3xl font-bold text-white mb-5">$0</div>
              <ul className="space-y-2.5 mb-4 flex-1">
                {[
                  '5 Smart Links',
                  'YouTube connection',
                  'Placement tracking',
                  'Real-time analytics',
                  'No credit card',
                  'No expiration',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-400">
                    <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 italic mb-6">
                Enough to see exactly what you've been missing.
              </p>
              <Link
                to={isSignedIn ? "/dashboard" : "/signup"}
                className="block text-center px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors border border-gray-700"
              >
                Start Free
              </Link>
            </div>

            {/* Pro */}
            <div className="bg-gray-900/60 border border-blue-800/50 rounded-xl p-6 flex flex-col">
              <div className="text-lg font-bold text-white mb-1">Pro</div>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-3xl font-bold text-white">$19</span>
                <span className="text-gray-400 text-sm mb-1">/mo</span>
              </div>
              <div className="text-xs text-gray-500 mb-5">or $197/year</div>
              <ul className="space-y-2.5 mb-4 flex-1">
                {[
                  'Unlimited links',
                  'Branded subdomain',
                  'Creator Hub',
                  'Proof pages',
                  'Everything a serious creator needs',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-400">
                    <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mb-6" />
              <Link
                to={getCheckoutIntentUrl('pro_yearly', isSignedIn ?? false)}
                className="block text-center px-4 py-2.5 bg-primary hover:bg-primary text-white text-sm font-medium rounded-lg transition-colors"
              >
                Start Pro — $197/year
              </Link>
            </div>

            {/* Founder Access */}
            <div className="bg-gray-900/60 border border-yellow-800/50 rounded-xl p-6 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0">
                <div className="bg-yellow-500 text-gray-900 text-xs font-bold px-3 py-1 rounded-bl-lg">
                  ⚡ LIMITED
                </div>
              </div>
              <div className="text-lg font-bold text-white mb-1">Founder Access</div>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-3xl font-bold text-yellow-400">$97</span>
                <span className="text-gray-400 text-sm mb-1">one time</span>
              </div>
              <div className="text-xs text-yellow-500 font-medium mb-5">
                Lifetime Pro · {displayText}
              </div>
              <ul className="space-y-2.5 mb-4 flex-1">
                {[
                  'Lifetime Pro access',
                  'All current features',
                  'All future features',
                  "Closes when it fills",
                  "Won't reopen",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-400">
                    <Check className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mb-6" />
              {isSoldOut ? (
                <>
                  <button
                    disabled
                    className="block text-center px-4 py-2.5 bg-gray-700 text-gray-400 text-sm font-medium rounded-lg cursor-not-allowed w-full"
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
                  to={getCheckoutIntentUrl('founder', isSignedIn ?? false)}
                  className="block text-center px-4 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-gray-900 text-sm font-bold rounded-lg transition-colors"
                >
                  Claim Founder Access — $97 Once
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="py-16 border-t border-gray-800/60 pb-20">
          <div className="bg-gray-900/40 border border-gray-800/40 rounded-2xl p-8 sm:p-12 text-center max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold mb-5 leading-tight">
              Every creator gets clicks.
            </h2>
            <h3 className="text-2xl sm:text-3xl font-bold mb-10 text-gray-400">
              The best creators know why.
            </h3>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto leading-relaxed">
              Know which videos deserve another upload.
            </p>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto leading-relaxed">
              Know which placements deserve another test.
            </p>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto leading-relaxed">
              Know exactly what makes your audience take action.
            </p>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-primary hover:bg-primary text-white font-semibold rounded-xl transition-colors text-lg"
            >
              Start Tracking Free
            </Link>
            <p className="text-sm text-gray-500 mt-4">
              No credit card required. Setup takes less than one minute.
            </p>
          </div>
        </section>

      </div>

      {/* FOOTER */}
      <footer className="border-t border-gray-800/40 pb-8 pt-8 text-center">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-center gap-6 text-sm text-gray-500 mb-4 flex-wrap">
            <Link to="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-gray-400 transition-colors">Terms</Link>
            <Link to="/support" className="hover:text-gray-400 transition-colors">Support</Link>
            {/* Sign In explicitly redirects to /dashboard to prevent redirecting to Stripe checkout from stored pending redirect */}
            <Link to="/login?redirectUrl=%2Fdashboard" className="hover:text-gray-400 transition-colors">Sign In</Link>
          </div>
          <p className="text-xs text-gray-600">
            InLinkr — YouTube attribution for creators who are done guessing.
          </p>
        </div>
      </footer>

    </div>
  );
}
