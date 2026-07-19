import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { analytics } from '../lib/analytics';
import { getEffectivePlan } from '../lib/plan';

export function SuccessPage() {
  const { user, refreshUser } = useAuth();
  const [verificationState, setVerificationState] = useState<'verifying' | 'success' | 'timeout'>('verifying');

  useEffect(() => {
    // Track checkout return on page load
    analytics.trackCheckoutReturned(user?.plan);
  }, [user?.plan]);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    let timeoutId: NodeJS.Timeout;

    const startPolling = async () => {
      // Poll every 2.5 seconds for up to 15 seconds
      const pollCount = Math.floor(15000 / 2500);
      let currentPoll = 0;

      pollInterval = setInterval(async () => {
        currentPoll++;
        
        try {
          await refreshUser();
          
          // Check if subscription is now active OR founder access is granted
          const effectivePlan = getEffectivePlan(user);
          if (user?.subscription_status === 'active' || effectivePlan === 'founder') {
            setVerificationState('success');
            clearInterval(pollInterval);
            clearTimeout(timeoutId);
          }
        } catch (error) {
          console.error('Error polling user status:', error);
        }

        // If we've reached max polls, timeout
        if (currentPoll >= pollCount) {
          setVerificationState('timeout');
          clearInterval(pollInterval);
        }
      }, 2500);
    };

    // Set overall timeout
    timeoutId = setTimeout(() => {
      setVerificationState('timeout');
      clearInterval(pollInterval);
    }, 15000);

    startPolling();

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeoutId);
    };
  }, [user?.subscription_status, refreshUser]);

  const renderContent = () => {
    switch (verificationState) {
      case 'verifying':
        return (
          <>
            <div className="mb-8 flex justify-center">
              <div className="bg-blue-500/20 rounded-full p-6">
                <Loader2 className="w-16 h-16 text-primary animate-spin" />
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Verifying your subscription...
            </h1>

            <p className="text-lg text-gray-400 mb-8">
              Please wait while we confirm your payment and activate your plan.
            </p>

            <div className="space-y-4">
              <div className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-gray-800 text-gray-400 font-medium rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </div>
            </div>
          </>
        );

      case 'success':
        return (
          <>
            <div className="mb-8 flex justify-center">
              <div className="bg-green-500/20 rounded-full p-6">
                <CheckCircle2 className="w-16 h-16 text-green-500" />
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              You're upgraded!
            </h1>

            <p className="text-lg text-gray-400 mb-8">
              Your InLinkr plan is now active.
            </p>

            <div className="space-y-4">
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-primary hover:bg-primary text-white font-medium rounded-lg transition-colors"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                to="/links"
                className="inline-flex items-center justify-center w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
              >
                View your links
              </Link>
            </div>
          </>
        );

      case 'timeout':
        return (
          <>
            <div className="mb-8 flex justify-center">
              <div className="bg-yellow-500/20 rounded-full p-6">
                <Loader2 className="w-16 h-16 text-yellow-500 animate-spin" />
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              We're still processing...
            </h1>

            <p className="text-lg text-gray-400 mb-8">
              We're still processing your subscription. Refresh in a moment to see your updated plan.
            </p>

            <div className="space-y-4">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-primary hover:bg-primary text-white font-medium rounded-lg transition-colors"
              >
                Refresh Page
                <ArrowRight className="w-4 h-4" />
              </button>

              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
              >
                Go to Dashboard
              </Link>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          {renderContent()}
        </div>
      </div>
    </Layout>
  );
}
