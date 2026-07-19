import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { TrendingUp, Play, Video, Copy, Zap, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PublicNav } from '../components/PublicNav';

export function HomePage() {
  const { user, loading } = useAuth();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText('https://go-dev.inlinkr.com/3o7wnt');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // If user is authenticated, redirect based on their state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (user) {
    // User exists, redirect based on state
    if (!user.username) {
      return <Navigate to="/setup-username" replace />;
    }
    
    // User is fully set up, go to dashboard
    return <Navigate to="/dashboard" replace />;
  }
  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">

      <PublicNav />

      <div className="max-w-5xl mx-auto px-4 pt-8 pb-16 sm:px-6 lg:px-8 overflow-x-hidden">

        <div className="space-y-16 sm:space-y-20">

          {/* Dual Hero */}
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16 text-center lg:text-left">
            {/* Left: Headline + CTA */}
            <div className="flex-1 space-y-6">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
                Know Which YouTube Videos
                Drive Your Clicks.
              </h1>

              <p className="text-lg sm:text-xl text-gray-400 leading-relaxed">
                Stop guessing. Track exactly which videos, descriptions, pinned comments, and placements drive your clicks.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start pt-2">
                <Link
                  to="/signup"
                  className="px-8 py-3 bg-primary hover:bg-primary text-white font-medium rounded-lg transition-colors text-center"
                >
                  Start Free
                </Link>
                <Link
                  to="/b"
                  className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
                >
                  See it in action →
                </Link>
              </div>

              <div className="flex flex-wrap justify-center lg:justify-start gap-4 text-xs text-gray-500 mt-2">
                <span className="flex items-center gap-1">
                  <Check className="w-3 h-3 text-green-500" />
                  Free forever
                </span>
                <span className="flex items-center gap-1">
                  <Check className="w-3 h-3 text-green-500" />
                  Connect YouTube in minutes
                </span>
                <span className="flex items-center gap-1">
                  <Check className="w-3 h-3 text-green-500" />
                  Upgrade when you need more
                </span>
              </div>
            </div>

            {/* Right: App Screenshot */}
            <div className="flex-1 flex justify-center lg:justify-end">
              <img
                src="/hero-app-screenshot.png"
                alt="InLinkr analytics dashboard"
                className="w-full max-w-sm sm:max-w-md lg:max-w-lg drop-shadow-2xl"
              />
            </div>
          </div>

          <div className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-6 sm:p-8 max-w-3xl mx-auto shadow-xl">
            <div className="space-y-4 sm:space-y-5">
              <div className="text-left">
                <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Your smart link</div>
                <div className="bg-gray-950 border border-blue-900/60 rounded-lg px-4 py-3 text-sm sm:text-base text-blue-400 font-mono flex items-center justify-between">
                  <span>go-dev.inlinkr.com/3o7wnt</span>
                  <button onClick={handleCopy} className="flex items-center gap-1 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer">
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-4 sm:pt-5 border-t border-gray-800">
                <div className="text-left">
                  <div className="text-xs text-gray-500 mb-3 uppercase tracking-wide">Reuse across videos</div>
                  <div className="space-y-3">
                    <div className="bg-gray-950/80 border border-gray-800/60 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Play className="w-4 h-4 text-red-500" />
                        <span className="text-sm font-semibold text-white">Video A: "Best Affiliate Tips 2024"</span>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <span className="bg-gray-800 text-gray-300 px-2 py-1 rounded">/d → description</span>
                        <span className="bg-gray-800 text-gray-300 px-2 py-1 rounded">/p → pinned</span>
                      </div>
                    </div>
                    <div className="bg-gray-950/80 border border-gray-800/60 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Play className="w-4 h-4 text-red-500" />
                        <span className="text-sm font-semibold text-white">Video B: "Product Review Deep Dive"</span>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <span className="bg-gray-800 text-gray-300 px-2 py-1 rounded">/d2 → description</span>
                        <span className="bg-gray-800 text-gray-300 px-2 py-1 rounded">/p2 → pinned</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 sm:pt-5 border-t border-gray-800">
                <div className="text-left">
                  <div className="text-xs text-gray-500 mb-3 uppercase tracking-wide">What you'll discover</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-red-500" />
                        <span className="text-sm font-semibold text-white">Video A drives 72% of your traffic</span>
                      </div>
                      <span className="text-base font-bold text-white">2,847 clicks</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm text-gray-300">Pinned comments outperform descriptions 3:1</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <p className="text-xs text-gray-400 italic">
                      Most creators never realize which video actually drives their traffic.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-6 hover:border-gray-700/60 transition-colors">
                <div className="text-primary mb-4">
                  <Video className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">Video Attribution</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Know exactly which YouTube video generated every click.
                </p>
              </div>

              <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-6 hover:border-gray-700/60 transition-colors">
                <div className="text-green-500 mb-4">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">Placement Performance</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  See whether descriptions, pinned comments, Shorts, or bios perform best.
                </p>
              </div>

              <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-6 hover:border-gray-700/60 transition-colors">
                <div className="text-orange-500 mb-4">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">Reusable Smart Links</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Use one Smart Link across every video and track everything automatically.
                </p>
              </div>
          </div>

          <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-6 sm:p-8 max-w-2xl mx-auto text-center">
              <h3 className="text-lg font-semibold text-white mb-3">Know Which Videos
              Drive Your Clicks.</h3>
              <p className="text-sm text-gray-400 mb-6">
                Start tracking your YouTube traffic in minutes.
              </p>
              <div className="flex justify-center pt-2">
                <Link
                  to="/signup"
                  className="px-8 py-3 bg-primary hover:bg-primary text-white font-medium rounded-lg transition-colors text-center"
                >
                  Start Free
                </Link>
              </div>
          </div>
        </div>

        <footer className="pt-8 sm:pt-12 pb-6 text-center">
          <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
            <Link to="/privacy" className="hover:text-gray-400 transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-gray-400 transition-colors">
              Terms
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
