import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { QrCode, ArrowRight, Check, TrendingUp, BarChart3, Eye, Share2, HelpCircle } from 'lucide-react';
import { PublicNav } from '../components/PublicNav';
import { analytics } from '../lib/analytics';
import { updateCanonicalTag, updateMetaTag } from '../lib/og-metadata';

// TODO: Replace with actual QRLinkr production URL when known
const QRLINKR_URL = "https://qrlinkr.app";

export function QRCodeTrackingPage() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Update page metadata
    document.title = 'QR Code Tracking for QRLinkr Users | InLinkr';
    updateMetaTag('og:title', 'QR Code Tracking for QRLinkr Users | InLinkr');
    updateMetaTag('og:description', 'Create a free QR code with QRLinkr, then use InLinkr Smart Links to track QR traffic, clicks, placements, and Traffic Proof.');
    updateMetaTag('twitter:title', 'QR Code Tracking for QRLinkr Users | InLinkr');
    updateMetaTag('twitter:description', 'Create a free QR code with QRLinkr, then use InLinkr Smart Links to track QR traffic, clicks, placements, and Traffic Proof.');
    updateCanonicalTag('/qr-code-tracking');

    // Add FAQ schema
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Do I need InLinkr to use QRLinkr?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No. QRLinkr is free and works on its own. InLinkr is for users who want tracking, Smart Links, and Traffic Proof."
          }
        },
        {
          "@type": "Question",
          "name": "How does QR tracking work?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Instead of putting your final destination directly into the QR code, you put a InLinkr Smart Link in the QR code. InLinkr records visits and clicks to the Smart Link, then sends visitors to the destination."
          }
        },
        {
          "@type": "Question",
          "name": "Can I use this for printed QR codes?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. This is especially useful for printed materials because you can track traffic after the QR code has already been shared or printed."
          }
        },
        {
          "@type": "Question",
          "name": "Can I compare different QR placements?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Create separate Smart Links for different placements, such as flyers, posters, table cards, or business cards."
          }
        },
        {
          "@type": "Question",
          "name": "Is QRLinkr still free?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. QRLinkr remains free for creating QR codes. TubeLinkr is the advanced tracking layer."
          }
        }
      ]
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(faqSchema);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText('go-dev.inlinkr.com/qr-demo');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartFreeClick = () => {
    analytics.track('qrlinkr_landing_start_free_click');
  };

  const handleCreateQRClick = () => {
    analytics.track('qrlinkr_landing_create_qr_click');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNav />

      <div className="max-w-6xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        
        {/* Hero Section */}
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16 mb-20">
          <div className="flex-1 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center">
              <span className="px-3 py-1 bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-medium rounded-full">
                For QRLinkr users
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
              Track What Happens After Someone Scans Your QR Code.
            </h1>
            <p className="text-lg sm:text-xl text-gray-400 leading-relaxed">
              QRLinkr helps you create the QR code. InLinkr helps you track the traffic behind it. Create a Smart Link, place it inside your QR code, and see visits, clicks, placements, and proof.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start pt-2">
              <Link
                to="/signup"
                onClick={handleStartFreeClick}
                className="px-8 py-3 bg-primary hover:bg-primary text-white font-medium rounded-lg transition-colors text-center"
              >
                Start Free
              </Link>
              <a
                href={QRLINKR_URL}
                onClick={handleCreateQRClick}
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-medium rounded-lg transition-colors text-center"
              >
                Create Free QR Code
              </a>
            </div>
          </div>

          {/* Dashboard Visual */}
          <div className="flex-1 flex justify-center lg:justify-end">
            <div className="space-y-4 w-full max-w-md">
              {/* Visual Flow */}
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <span className="px-2 py-1 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-md">QRLinkr QR Code</span>
                <ArrowRight className="w-3 h-3" />
                <span className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-md">InLinkr Smart Link</span>
                <ArrowRight className="w-3 h-3" />
                <span className="px-2 py-1 bg-green-500/10 border border-green-500/20 text-green-400 rounded-md">Traffic Proof</span>
              </div>
              
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-2xl shadow-blue-900/10">
                <div className="flex items-center gap-3 mb-4">
                  <QrCode className="w-5 h-5 text-orange-500" />
                  <span className="text-sm font-medium text-gray-400">Smart Link Demo</span>
                </div>
              
                <div className="bg-gray-950 border border-blue-900/60 rounded-lg px-4 py-3 mb-4">
                <div className="text-sm text-blue-400 font-mono flex items-center justify-between">
                  <span>go-dev.inlinkr.com/qr-demo</span>
                  <button onClick={handleCopy} className="flex items-center gap-1 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer">
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-950/90 border border-gray-800/80 rounded-lg p-4">
                  <div className="text-2xl font-bold text-white">248</div>
                  <div className="text-xs text-gray-500 mt-1">QR visits</div>
                </div>
                <div className="bg-gray-950/90 border border-gray-800/80 rounded-lg p-4">
                  <div className="text-2xl font-bold text-white">91</div>
                  <div className="text-xs text-gray-500 mt-1">Clicks</div>
                </div>
                <div className="bg-gray-950/90 border border-gray-800/80 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-400">36.7%</div>
                  <div className="text-xs text-gray-500 mt-1">Click-through</div>
                </div>
                <div className="bg-gray-950/90 border border-gray-800/80 rounded-lg p-4">
                  <div className="text-sm font-bold text-white">2 min ago</div>
                  <div className="text-xs text-gray-500 mt-1">Latest scan</div>
                </div>
              </div>

              <div className="border-t border-gray-800 pt-4">
                <div className="text-xs text-gray-500 mb-3 uppercase tracking-wide">Top Sources</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">Restaurant table card</span>
                    <span className="text-white font-medium">45%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">Flyer</span>
                    <span className="text-white font-medium">28%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">Business card</span>
                    <span className="text-white font-medium">18%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">Event poster</span>
                    <span className="text-white font-medium">9%</span>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Why normal QR codes are blind */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              A QR code can send traffic. It cannot explain traffic.
            </h2>
            <p className="text-lg text-gray-400 max-w-3xl mx-auto">
              Most free QR codes send people directly to a website or message. That works, but once the code is printed, shared, or posted, you have no easy way to know whether people scanned it, which placement performed best, or whether the traffic actually clicked through. InLinkr tracks traffic when the QR code uses an InLinkr Smart Link as the destination.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-6 hover:border-gray-700/60 transition-colors">
              <div className="text-orange-500 mb-4">
                <Eye className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-3">No scan visibility</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                You know where the QR code points, but not whether anyone used it.
              </p>
            </div>

            <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-6 hover:border-gray-700/60 transition-colors">
              <div className="text-orange-500 mb-4">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-3">No placement comparison</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                A flyer, sign, table card, and business card may all use the same link. InLinkr helps you separate performance.
              </p>
            </div>

            <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-6 hover:border-gray-700/60 transition-colors">
              <div className="text-orange-500 mb-4">
                <Share2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-3">No proof</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                When something works, Traffic Proof gives you a shareable snapshot of the results.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: How InLinkr fits with QRLinkr */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Use QRLinkr for the code. Use InLinkr for the tracking.
            </h2>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="space-y-6 relative">
              {/* Connecting line for desktop */}
              <div className="hidden lg:block absolute left-5 top-10 bottom-10 w-0.5 bg-gradient-to-b from-blue-600 via-orange-500 to-blue-600 opacity-30" />
              
              <div className="flex items-start gap-4 relative">
                <div className="flex-shrink-0 w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold z-10">
                  1
                </div>
                <div className="flex-1 bg-gray-900/60 border border-gray-800/60 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Create a Smart Link in InLinkr</h3>
                  <p className="text-sm text-gray-400">
                    Use a short, reusable link that can route traffic to your destination.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 relative">
                <div className="flex-shrink-0 w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold z-10">
                  2
                </div>
                <div className="flex-1 bg-gray-900/60 border border-gray-800/60 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Generate your QR code in QRLinkr</h3>
                  <p className="text-sm text-gray-400">
                    Paste the Smart Link into QRLinkr and download your QR code.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 relative">
                <div className="flex-shrink-0 w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold z-10">
                  3
                </div>
                <div className="flex-1 bg-gray-900/60 border border-gray-800/60 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Track the results</h3>
                  <p className="text-sm text-gray-400">
                    See visits, clicks, placements, and proof from your InLinkr dashboard.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Best use cases */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Perfect for any QR code you actually care about.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: 'Flyers', desc: 'Know which flyer designs drive the most scans.' },
              { name: 'Restaurant menus', desc: 'Track which menu items get the most interest.' },
              { name: 'Business cards', desc: 'See if your card QR code actually gets used.' },
              { name: 'Event posters', desc: 'Measure event promotion effectiveness.' },
              { name: 'Product packaging', desc: 'Track which products get the most engagement.' },
              { name: 'Real estate signs', desc: 'Know which properties generate the most leads.' },
              { name: 'YouTube channel promos', desc: 'See which offline promo drives subscribers.' },
              { name: 'Local service ads', desc: 'Measure which ad placements perform best.' },
            ].map((useCase) => (
              <div key={useCase.name} className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-5 hover:border-gray-700/60 transition-colors">
                <h3 className="text-base font-semibold text-white mb-2">{useCase.name}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {useCase.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Traffic Proof angle */}
        <div className="mb-20">
          <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-xl p-8 sm:p-12 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-primary" />
              </div>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Show proof when your QR campaign works.
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
              InLinkr does more than count clicks. Traffic Proof creates a timestamped snapshot you can save or share, so you can show that a QR campaign generated real activity.
            </p>
            <Link
              to="/signup"
              onClick={handleStartFreeClick}
              className="inline-flex items-center gap-2 px-8 py-3 bg-primary hover:bg-primary text-white font-medium rounded-lg transition-colors"
            >
              Start Tracking QR Traffic
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Section 5: FAQ */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 flex items-center justify-center gap-3">
              <HelpCircle className="w-8 h-8 text-gray-500" />
              Frequently Asked Questions
            </h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {[
              {
                q: "Do I need InLinkr to use QRLinkr?",
                a: "No. QRLinkr is free and works on its own. InLinkr is for users who want tracking, Smart Links, and Traffic Proof."
              },
              {
                q: "How does QR tracking work?",
                a: "Instead of putting your final destination directly into the QR code, you put a InLinkr Smart Link in the QR code. InLinkr records visits and clicks to the Smart Link, then sends visitors to the destination."
              },
              {
                q: "Can I use this for printed QR codes?",
                a: "Yes. This is especially useful for printed materials because you can track traffic after the QR code has already been shared or printed."
              },
              {
                q: "Can I compare different QR placements?",
                a: "Yes. Create separate Smart Links for different placements, such as flyers, posters, table cards, or business cards."
              },
              {
                q: "Is QRLinkr still free?",
                a: "Yes. QRLinkr remains free for creating QR codes. InLinkr is the advanced tracking layer."
              },
            ].map((faq, index) => (
              <div key={index} className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-6">
                <h3 className="text-base font-semibold text-white mb-2">{faq.q}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center">
          <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-10 sm:p-14 max-w-2xl mx-auto shadow-xl shadow-blue-900/5">
            <h3 className="text-2xl font-bold text-white mb-3">
              Turn your free QR code into trackable traffic.
            </h3>
            <p className="text-sm text-gray-400 mb-6">
              Start with a free QR code. Upgrade the link behind it when you want tracking, clicks, placements, and proof.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
              <Link
                to="/signup"
                onClick={handleStartFreeClick}
                className="px-8 py-3 bg-primary hover:bg-primary text-white font-medium rounded-lg transition-colors text-center"
              >
                Start Free
              </Link>
              <a
                href={QRLINKR_URL}
                onClick={handleCreateQRClick}
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-medium rounded-lg transition-colors text-center"
              >
                Create a Free QR Code →
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="pt-16 pb-8 text-center">
          <div className="flex items-center justify-center gap-6 text-sm text-gray-500 mb-4 flex-wrap">
            <Link to="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-gray-400 transition-colors">Terms</Link>
            <Link to="/support" className="hover:text-gray-400 transition-colors">Support</Link>
            <Link to="/pricing" className="hover:text-gray-400 transition-colors">Pricing</Link>
          </div>
          <p className="text-xs text-gray-600">
            InLinkr — Track QR traffic, clicks, and placements with Smart Links.
          </p>
        </footer>
      </div>
    </div>
  );
}
